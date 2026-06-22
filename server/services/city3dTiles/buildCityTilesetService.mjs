import fs from 'node:fs'
import { getProductionPool } from '../../db/postgisPool.mjs'
import { upsertCity3dTilesetRecord } from '../../db/productionTwinStore/city3dTilesetRepository.mjs'
import { buildExtrudedBuildingGlb, regionBoundingVolume } from './glbBuilder.mjs'
import {
  threeDTilesTilesetUrl,
  writeThreeDTilesPackage,
} from './assetStore.mjs'

const DEFAULT_BUILDING_LIMIT = 1000
const MAX_BUILDING_LIMIT = 25000

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function versionStamp(value) {
  const explicit = String(value ?? '').trim()
  if (explicit) return explicit
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function normalizeFeature(row) {
  return {
    objectId: row.object_id,
    label: row.label,
    semanticClass: row.semantic_class,
    heightMeters: row.height_m == null ? null : Number(row.height_m),
    floors: row.floors == null ? null : Number(row.floors),
    buildingType: row.building_type,
    authorityStatus: row.authority_status,
    confidence: row.confidence,
    provider: row.provider,
    sourceFormat: row.source_format,
    sourceFamily: row.source_family,
    sourceCoverageStatus: row.source_coverage_status,
    footprintAreaM2: row.footprint_area_m2 == null ? null : Number(row.footprint_area_m2),
    lon: row.lon == null ? null : Number(row.lon),
    lat: row.lat == null ? null : Number(row.lat),
    geometry: parseJson(row.geometry, null),
  }
}

async function loadBuildingFeatures(client, { cityId, limit }) {
  const result = await client.query(`
    SELECT
      object_id,
      label,
      semantic_class,
      height_m,
      floors,
      building_type,
      authority_status,
      confidence,
      provider,
      source_format,
      source_family,
      source_coverage_status,
      footprint_area_m2,
      ST_X(ST_PointOnSurface(geom)) AS lon,
      ST_Y(ST_PointOnSurface(geom)) AS lat,
      ST_AsGeoJSON(ST_MakeValid(geom), 6)::jsonb AS geometry
    FROM ldt_query.city_objects
    WHERE city_id = $1
      AND semantic_class = 'buildings'
      AND geom IS NOT NULL
      AND NOT ST_IsEmpty(geom)
      AND GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
    ORDER BY
      COALESCE(height_m, floors * 3.2, 8) DESC NULLS LAST,
      footprint_area_m2 DESC NULLS LAST,
      object_id ASC
    LIMIT $2
  `, [cityId, limit])

  return result.rows.map(normalizeFeature).filter((feature) => feature.geometry)
}

function buildTilesetJson({ features, boundingVolume, glbStats, sourceQuery }) {
  const rootGeometricError = Math.max(0, Number(sourceQuery.limit ?? 0) > 5000 ? 180 : 90)
  return {
    asset: {
      version: '1.1',
      generator: 'Twin Base Studio city-3d-tiles-builder-v0',
    },
    geometricError: rootGeometricError,
    root: {
      boundingVolume: {
        region: boundingVolume.region,
      },
      geometricError: 0,
      refine: 'ADD',
      content: {
        uri: 'buildings.glb',
      },
      metadata: {
        class: 'city_building_tileset',
        properties: {
          semanticClasses: ['buildings'],
          featureCount: features.length,
          vertexCount: glbStats.vertexCount,
          triangleCount: glbStats.triangleCount,
        },
      },
    },
    extras: {
      twinBaseStudio: {
        transport: '3d-tiles',
        semanticClasses: ['buildings'],
        sourceQuery,
        limitations: [
          'Initial single-tile package; production LOD subdivision is planned before city-scale delivery.',
          'Building heights use source height or levels when present, otherwise a conservative default extrusion.',
        ],
      },
    },
  }
}

function buildManifest({ cityId, tilesetKey, version, features, boundingVolume, glbStats, sourceQuery }) {
  return {
    cityId,
    tilesetKey,
    version,
    generatedAt: new Date().toISOString(),
    transport: '3d-tiles',
    source: {
      view: 'ldt_query.city_objects',
      semanticClasses: ['buildings'],
      query: sourceQuery,
    },
    content: {
      mode: 'single-tile-building-extrusion',
      featureCount: features.length,
      vertexCount: glbStats.vertexCount,
      triangleCount: glbStats.triangleCount,
      boundingVolume,
    },
    standards: {
      package: 'OGC 3D Tiles 1.1 / glTF 2.0',
      identifierStrategy: 'features.json sidecar maps rendered geometry back to ldt_query.city_objects.object_id',
    },
    nextSteps: [
      'Split large cities into spatial tiles and LODs.',
      'Add batch metadata for object picking once the viewer consumes this package directly.',
      'Move runtime-data/3d-tiles to object storage in production deployments.',
    ],
  }
}

export async function buildCity3dBuildingTileset(options = {}) {
  const cityId = String(options.cityId ?? '').trim()
  if (!cityId) throw new Error('CITY_ID_REQUIRED')

  const tilesetKey = String(options.tilesetKey ?? 'base-buildings').trim()
  const version = versionStamp(options.version)
  const limit = clampInteger(
    options.limit ?? process.env.TWIN_STUDIO_3D_TILES_BUILDING_LIMIT,
    DEFAULT_BUILDING_LIMIT,
    1,
    MAX_BUILDING_LIMIT,
  )
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')

  const client = await pool.connect()
  try {
    const features = await loadBuildingFeatures(client, { cityId, limit })
    if (!features.length) throw new Error('NO_BUILDING_FEATURES_FOR_TILESET')

    const sourceQuery = {
      language: 'twinql-json',
      cityId,
      classes: ['buildings'],
      scope: { key: 'city' },
      render: { transport: '3d-tiles', mode: 'package', maxFeatures: limit },
      limit,
    }
    const boundingVolume = regionBoundingVolume(features)
    const glbStats = buildExtrudedBuildingGlb(features, {
      metadata: {
        cityId,
        tilesetKey,
        version,
        sourceQuery,
      },
    })
    const tileset = buildTilesetJson({
      features,
      boundingVolume,
      glbStats,
      sourceQuery,
    })
    const manifest = buildManifest({
      cityId,
      tilesetKey,
      version,
      features,
      boundingVolume,
      glbStats,
      sourceQuery,
    })
    const featureIndex = {
      cityId,
      tilesetKey,
      version,
      generatedAt: manifest.generatedAt,
      features: glbStats.featureIndex,
    }

    const packageResult = writeThreeDTilesPackage({
      cityId,
      tilesetKey,
      version,
      files: {
        'tileset.json': Buffer.from(`${JSON.stringify(tileset, null, 2)}\n`, 'utf8'),
        'buildings.glb': glbStats.glb,
        'features.json': Buffer.from(`${JSON.stringify(featureIndex, null, 2)}\n`, 'utf8'),
        'manifest.json': Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
      },
    })

    const tilesetPath = packageResult.written['tileset.json']
    const record = await upsertCity3dTilesetRecord({
      cityId,
      tilesetKey,
      version,
      status: 'ready',
      contentState: 'generated',
      sourceQuery,
      semanticClasses: ['buildings'],
      assetRoot: packageResult.packageDir,
      tilesetUrl: threeDTilesTilesetUrl({ cityId, tilesetKey, version }),
      tilesetPath,
      featureCount: glbStats.featureIndex.length,
      objectCount: new Set(glbStats.featureIndex.map((entry) => entry.objectId)).size,
      byteSize: packageResult.byteSize,
      geometricError: tileset.geometricError,
      boundingVolume: { region: boundingVolume.region, degrees: boundingVolume.degrees },
      metadata: {
        files: Object.fromEntries(Object.entries(packageResult.written).map(([assetName, filePath]) => [
          assetName,
          {
            path: filePath,
            bytes: fs.statSync(filePath).size,
          },
        ])),
        glb: {
          vertexCount: glbStats.vertexCount,
          triangleCount: glbStats.triangleCount,
        },
      },
    }, { client })

    return {
      ok: true,
      cityId,
      tilesetKey,
      version,
      record,
      packageDir: packageResult.packageDir,
      tilesetUrl: record.tilesetUrl,
      files: {
        tilesetPath,
        glbPath: packageResult.written['buildings.glb'],
        manifestPath: packageResult.written['manifest.json'],
        featuresPath: packageResult.written['features.json'],
      },
      counts: {
        loadedFeatures: features.length,
        renderedFeatures: glbStats.featureIndex.length,
        objects: record.objectCount,
        vertices: glbStats.vertexCount,
        triangles: glbStats.triangleCount,
        bytes: packageResult.byteSize,
      },
    }
  } finally {
    client.release()
  }
}

