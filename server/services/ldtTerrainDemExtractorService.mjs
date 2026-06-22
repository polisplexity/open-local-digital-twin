import crypto from 'node:crypto'
import sharp from 'sharp'

import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import { refreshLdtObjectObservationSummary } from './ldtObservationSummaryService.mjs'

const DEFAULT_CITY_IDS = ['kharkiv']
const DEFAULT_SCENARIO_KEY = 'baseline'
const DEFAULT_TERRAIN_GRID_RESOLUTION_M = 250
const DEFAULT_TILE_ZOOM = 13
const DEFAULT_SAMPLE_OFFSET_M = 125
const DEFAULT_SAMPLE_CONCURRENCY = 16
const DEFAULT_RUN_LIMIT = 25
const TERRAIN_SAMPLE_INSERT_BATCH_SIZE = 2000
const MAX_TILE_ZOOM = 14
const MIN_TILE_ZOOM = 8
const TILE_SIZE = 256
const TERRARIUM_TEMPLATE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TERRAIN_DATASET_SOURCE_URL = 'https://registry.opendata.aws/terrain-tiles/'
const TERRARIUM_FORMAT_URL = 'https://github.com/tilezen/joerd/blob/master/docs/formats.md'

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function numberValue(value, fallback, min, max) {
  const number = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function terrainGridKeyFromResolution(resolutionM = DEFAULT_TERRAIN_GRID_RESOLUTION_M) {
  const meters = integerValue(resolutionM, DEFAULT_TERRAIN_GRID_RESOLUTION_M, 100, 5000)
  return `terrain-dem-${meters}m`
}

function clampLatitude(lat) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat))
}

function tileCoordinate(lon, lat, zoom) {
  const z = integerValue(zoom, DEFAULT_TILE_ZOOM, MIN_TILE_ZOOM, MAX_TILE_ZOOM)
  const n = 2 ** z
  const safeLat = clampLatitude(lat)
  const latRad = safeLat * Math.PI / 180
  const xFloat = ((lon + 180) / 360) * n
  const yFloat = (1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * n
  const x = Math.max(0, Math.min(n - 1, Math.floor(xFloat)))
  const y = Math.max(0, Math.min(n - 1, Math.floor(yFloat)))
  const pixelX = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((xFloat - x) * TILE_SIZE)))
  const pixelY = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((yFloat - y) * TILE_SIZE)))
  return { z, x, y, pixelX, pixelY, key: `${z}/${x}/${y}` }
}

function formatTileUrl(template, { z, x, y }) {
  return template
    .replaceAll('{z}', String(z))
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y))
}

function offsetPoint(lon, lat, eastMeters, northMeters) {
  const latMeters = 111_320
  const lonMeters = Math.max(1, 111_320 * Math.cos(lat * Math.PI / 180))
  return {
    lon: lon + eastMeters / lonMeters,
    lat: lat + northMeters / latMeters,
  }
}

class TerrariumTileSampler {
  constructor({
    tileTemplate = TERRARIUM_TEMPLATE,
    zoom = DEFAULT_TILE_ZOOM,
    fetchTimeoutMs = 15_000,
  } = {}) {
    this.tileTemplate = compactText(tileTemplate, TERRARIUM_TEMPLATE)
    this.zoom = integerValue(zoom, DEFAULT_TILE_ZOOM, MIN_TILE_ZOOM, MAX_TILE_ZOOM)
    this.fetchTimeoutMs = integerValue(fetchTimeoutMs, 15_000, 1000, 60_000)
    this.cache = new Map()
    this.pending = new Map()
    this.tileUrls = new Map()
  }

  async sample(lon, lat) {
    const tile = tileCoordinate(lon, lat, this.zoom)
    const image = await this.loadTile(tile)
    if (!image) return null
    const offset = (tile.pixelY * image.info.width + tile.pixelX) * image.info.channels
    const r = image.data[offset]
    const g = image.data[offset + 1]
    const b = image.data[offset + 2]
    if (![r, g, b].every(Number.isFinite)) return null
    // Terrarium DEM encoding: elevation = (red * 256 + green + blue / 256) - 32768.
    const elevationM = (r * 256 + g + b / 256) - 32768
    return {
      elevationM,
      tileKey: tile.key,
      tileUrl: this.tileUrls.get(tile.key),
      pixel: { x: tile.pixelX, y: tile.pixelY },
    }
  }

  tileKeys() {
    return Array.from(this.cache.keys()).sort()
  }

  tileManifest() {
    return this.tileKeys().map((key) => ({
      key,
      url: this.tileUrls.get(key),
    }))
  }

  async loadTile(tile) {
    if (this.cache.has(tile.key)) return this.cache.get(tile.key)
    if (this.pending.has(tile.key)) return await this.pending.get(tile.key)
    const url = formatTileUrl(this.tileTemplate, tile)
    this.tileUrls.set(tile.key, url)
    const pending = this.fetchTile(url, tile.key)
    this.pending.set(tile.key, pending)
    try {
      return await pending
    } finally {
      this.pending.delete(tile.key)
    }
  }

  async fetchTile(url, cacheKey) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs)
    try {
      const response = await fetch(url, {
        headers: { Accept: 'image/png' },
        signal: controller.signal,
      })
      if (!response.ok) {
        this.cache.set(cacheKey, null)
        return null
      }
      const input = Buffer.from(await response.arrayBuffer())
      const decoded = await sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const image = {
        data: decoded.data,
        info: decoded.info,
      }
      this.cache.set(cacheKey, image)
      return image
    } finally {
      clearTimeout(timeout)
    }
  }
}

async function listCityIds(client, requestedCityIds) {
  const normalized = requestedCityIds.map((cityId) => compactText(cityId)).filter(Boolean)
  if (normalized.length > 0) return normalized
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function loadGridCells(client, cityId, gridKey) {
  const result = await client.query(
    `
      SELECT
        cell_id,
        ST_X(ST_PointOnSurface(geom))::double precision AS lon,
        ST_Y(ST_PointOnSurface(geom))::double precision AS lat
      FROM ldt_viewer.density_grids
      WHERE city_id = $1
        AND grid_key = $2
      ORDER BY cell_id
    `,
    [cityId, gridKey],
  )
  return result.rows.map((row) => ({
    cellId: row.cell_id,
    lon: Number(row.lon),
    lat: Number(row.lat),
  })).filter((row) => Number.isFinite(row.lon) && Number.isFinite(row.lat))
}

async function ensureTerrainSamplingGrid(client, cityId, {
  gridKey,
  resolutionM = DEFAULT_TERRAIN_GRID_RESOLUTION_M,
} = {}) {
  const cellSizeM = integerValue(resolutionM, DEFAULT_TERRAIN_GRID_RESOLUTION_M, 100, 5000)
  const resolvedGridKey = compactText(gridKey, terrainGridKeyFromResolution(cellSizeM))
  await client.query(
    'DELETE FROM ldt_viewer.density_grids WHERE city_id = $1 AND grid_key = $2',
    [cityId, resolvedGridKey],
  )
  const result = await client.query(
    `
      WITH boundary AS (
        SELECT ST_UnaryUnion(ST_Collect(ST_MakeValid(geom))) AS geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      projected AS (
        SELECT ST_Transform(geom, 3857) AS geom
        FROM boundary
        WHERE geom IS NOT NULL
          AND NOT ST_IsEmpty(geom)
      ),
      grid AS (
        SELECT
          g.i,
          g.j,
          ST_CollectionExtract(
            ST_MakeValid(ST_Intersection(g.geom, projected.geom)),
            3
          ) AS geom
        FROM projected
        CROSS JOIN LATERAL ST_SquareGrid($3::double precision, projected.geom) AS g
        WHERE ST_Intersects(g.geom, projected.geom)
      ),
      dumped AS (
        SELECT
          i,
          j,
          d.path,
          d.geom
        FROM grid
        CROSS JOIN LATERAL ST_Dump(geom) AS d
      ),
      clipped AS (
        SELECT
          'terrain-' || $3::int || 'm-' || i::text || '-' || j::text || '-' || COALESCE(path[1], 1)::text AS cell_id,
          ST_Transform(geom, 4326)::geometry(Polygon, 4326) AS geom
        FROM dumped
        WHERE geom IS NOT NULL
          AND NOT ST_IsEmpty(geom)
      ),
      valid AS (
        SELECT cell_id, geom
        FROM clipped
        WHERE ST_Area(geom::geography) > 25
      )
      INSERT INTO ldt_viewer.density_grids (
        city_id,
        grid_key,
        zoom_hint,
        cell_id,
        geom,
        metrics,
        refreshed_at
      )
      SELECT
        $1,
        $2,
        13,
        cell_id,
        geom,
        jsonb_build_object(
          'gridType', 'terrain-dem-sampling',
          'resolutionM', $3::int,
          'source', 'city-boundary-square-grid',
          'purpose', 'source-backed terrain DEM sampling'
        ),
        now()
      FROM valid
      ON CONFLICT (city_id, grid_key, cell_id) DO UPDATE SET
        geom = EXCLUDED.geom,
        metrics = EXCLUDED.metrics,
        refreshed_at = now()
      RETURNING cell_id
    `,
    [cityId, resolvedGridKey, cellSizeM],
  )
  if (result.rowCount === 0) throw new Error(`TERRAIN_DEM_GRID_EMPTY:${cityId}:${resolvedGridKey}`)
  return {
    gridKey: resolvedGridKey,
    resolutionM: cellSizeM,
    cells: result.rowCount,
  }
}

async function sampleTerrainForCells(cells, {
  tileTemplate = TERRARIUM_TEMPLATE,
  tileZoom = DEFAULT_TILE_ZOOM,
  sampleOffsetM = DEFAULT_SAMPLE_OFFSET_M,
  concurrency = DEFAULT_SAMPLE_CONCURRENCY,
  onProgress,
} = {}) {
  const sampler = new TerrariumTileSampler({ tileTemplate, zoom: tileZoom })
  const offsetM = numberValue(sampleOffsetM, DEFAULT_SAMPLE_OFFSET_M, 50, 2000)
  const workerCount = integerValue(concurrency, DEFAULT_SAMPLE_CONCURRENCY, 1, 64)
  const samples = []
  const failures = []
  let cursor = 0
  let completed = 0

  async function sampleCell(cell) {
    const center = await sampler.sample(cell.lon, cell.lat)
    const eastPoint = offsetPoint(cell.lon, cell.lat, offsetM, 0)
    const westPoint = offsetPoint(cell.lon, cell.lat, -offsetM, 0)
    const northPoint = offsetPoint(cell.lon, cell.lat, 0, offsetM)
    const southPoint = offsetPoint(cell.lon, cell.lat, 0, -offsetM)
    const east = await sampler.sample(eastPoint.lon, eastPoint.lat)
    const west = await sampler.sample(westPoint.lon, westPoint.lat)
    const north = await sampler.sample(northPoint.lon, northPoint.lat)
    const south = await sampler.sample(southPoint.lon, southPoint.lat)
    const neighborhood = [center, east, west, north, south].filter(Boolean)
    if (!center || neighborhood.length < 3) {
      return { failure: cell.cellId }
    }
    const dzdx = east && west ? (east.elevationM - west.elevationM) / (2 * offsetM) : 0
    const dzdy = north && south ? (north.elevationM - south.elevationM) / (2 * offsetM) : 0
    const slopeDeg = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI
    const tileKeys = Array.from(new Set(neighborhood.map((entry) => entry.tileKey))).sort()
    return {
      cellId: cell.cellId,
      lon: cell.lon,
      lat: cell.lat,
      elevationM: Number(center.elevationM.toFixed(2)),
      slopeDeg: Number(slopeDeg.toFixed(3)),
      sampleCount: neighborhood.length,
      tileKeys,
      centerTileKey: center.tileKey,
      centerPixel: center.pixel,
    }
  }

  async function worker() {
    while (cursor < cells.length) {
      const index = cursor
      cursor += 1
      const result = await sampleCell(cells[index])
      if (result?.failure) failures.push(result.failure)
      else if (result) samples.push(result)
      completed += 1
      if (typeof onProgress === 'function' && (completed === cells.length || completed % 250 === 0)) {
        onProgress({
          completed,
          total: cells.length,
          samples: samples.length,
          failures: failures.length,
          tileCount: sampler.tileManifest().length,
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(workerCount, cells.length) }, () => worker()))
  samples.sort((a, b) => a.cellId.localeCompare(b.cellId))
  failures.sort()
  return {
    samples,
    failures,
    tileManifest: sampler.tileManifest(),
    tileTemplate: sampler.tileTemplate,
    tileZoom: sampler.zoom,
    sampleOffsetM: offsetM,
  }
}

async function ensureTerrainDataset(client, cityId, {
  tileZoom,
  tileTemplate,
  tileManifest,
  scenarioKey,
}) {
  const identifier = `${cityId}:mapzen-terrain-tiles-dem:z${tileZoom}`
  const metadata = {
    extractorKey: 'terrain-dem',
    scenarioKey,
    source: 'Mapzen Terrain Tiles on AWS Open Data',
    sourceUrl: TERRAIN_DATASET_SOURCE_URL,
    formatReference: TERRARIUM_FORMAT_URL,
    tileTemplate,
    tileZoom,
    tileCount: tileManifest.length,
    posture: 'open-data-native',
    rawRasterStoredInPostgis: false,
    runtimeReadsTilesDirectly: false,
  }
  const dataset = await client.query(
    `
      INSERT INTO ldt_catalog.datasets (
        city_id,
        identifier,
        title,
        description,
        publisher,
        license,
        access_rights,
        update_frequency,
        issued_at,
        modified_at,
        metadata,
        updated_at
      ) VALUES (
        $1,
        $2,
        'Mapzen Terrain Tiles DEM sample',
        'Open terrain DEM tiles sampled onto the city environmental grid for elevation and slope.',
        'AWS Open Data / Mapzen Terrain Tiles',
        'Open terrain source with source-specific attribution',
        'public-open-data',
        'source-dependent',
        now(),
        now(),
        $3::jsonb,
        now()
      )
      ON CONFLICT (identifier) DO UPDATE SET
        city_id = EXCLUDED.city_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        publisher = EXCLUDED.publisher,
        license = EXCLUDED.license,
        access_rights = EXCLUDED.access_rights,
        update_frequency = EXCLUDED.update_frequency,
        modified_at = EXCLUDED.modified_at,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id, identifier
    `,
    [cityId, identifier, JSON.stringify(metadata)],
  )
  const datasetId = dataset.rows[0].id
  await client.query('DELETE FROM ldt_catalog.dataset_distributions WHERE dataset_id = $1 AND title = $2', [datasetId, 'Terrarium tile template'])
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_distributions (
        dataset_id,
        title,
        format,
        media_type,
        access_url,
        download_url,
        metadata
      ) VALUES (
        $1,
        'Terrarium tile template',
        'PNG Terrarium tile',
        'image/png',
        $2,
        $2,
        $3::jsonb
      )
    `,
    [
      datasetId,
      tileTemplate,
      JSON.stringify({
        sourceUrl: TERRAIN_DATASET_SOURCE_URL,
        formatReference: TERRARIUM_FORMAT_URL,
        tileManifest,
      }),
    ],
  )
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_licenses (
        dataset_id,
        license_name,
        license_url,
        attribution_required,
        obligations
      ) VALUES (
        $1,
        'Mapzen Terrain Tiles attribution',
        $2,
        true,
        $3::jsonb
      )
      ON CONFLICT (dataset_id, license_name) DO UPDATE SET
        license_url = EXCLUDED.license_url,
        attribution_required = EXCLUDED.attribution_required,
        obligations = EXCLUDED.obligations
    `,
    [
      datasetId,
      TERRAIN_DATASET_SOURCE_URL,
      JSON.stringify({
        note: 'Respect source-specific attribution and license terms from the terrain tile dataset.',
      }),
    ],
  )
  await client.query('DELETE FROM ldt_catalog.dataset_spatial_extents WHERE dataset_id = $1 AND extent_role = $2', [datasetId, 'city-sampled-coverage'])
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_spatial_extents (
        dataset_id,
        extent_role,
        geom,
        bbox
      )
      SELECT
        $1,
        'city-sampled-coverage',
        ST_UnaryUnion(ST_Collect(geom)),
        jsonb_build_object(
          'minLon', ST_XMin(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'minLat', ST_YMin(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'maxLon', ST_XMax(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'maxLat', ST_YMax(ST_Envelope(ST_UnaryUnion(ST_Collect(geom))))
        )
      FROM ldt_core.city_boundaries
      WHERE city_id = $2
    `,
    [datasetId, cityId],
  )
  return dataset.rows[0]
}

async function ensureTerrainRun(client, cityId, {
  datasetId,
  scenarioKey,
  gridKey,
  tileZoom,
  tileTemplate,
  tileManifest,
  sampleOffsetM,
  sampledCells,
  failedCells,
  cellsWritten,
  objectObservations,
}) {
  const definition = await client.query(
    `
      SELECT id
      FROM ldt_environment.extractor_definitions
      WHERE extractor_key = 'terrain-dem'
      LIMIT 1
    `,
  )
  if (definition.rowCount === 0) throw new Error('TERRAIN_DEM_EXTRACTOR_DEFINITION_MISSING')
  const runVersion = `mapzen-z${tileZoom}-${gridKey}`
  const runKey = `terrain-dem:${scenarioKey}:${runVersion}`
  const inputSummary = {
    source: 'Mapzen Terrain Tiles on AWS Open Data',
    sourceUrl: TERRAIN_DATASET_SOURCE_URL,
    tileTemplate,
    tileZoom,
    gridKey,
    sampleOffsetM,
    requestedLayers: ['terrain_elevation_m', 'terrain_slope_deg'],
    rawRasterStoredInPostgis: false,
  }
  const outputSummary = {
    outputLayerKeys: ['terrain_elevation_m', 'terrain_slope_deg'],
    sampledCells,
    failedCells,
    cellsWritten,
    objectObservations,
    tileCount: tileManifest.length,
    datasetId,
    writesActualPhenomenonCells: true,
    currentPosture: 'source-backed-open-data',
  }
  const validationReport = {
    status: failedCells === 0 ? 'passed' : 'passed-with-gaps',
    checks: [
      {
        key: 'source-data',
        status: tileManifest.length > 0 ? 'passed' : 'failed',
        statement: `${tileManifest.length} DEM tiles were fetched and decoded.`,
      },
      {
        key: 'grid-coverage',
        status: sampledCells > 0 ? 'passed' : 'failed',
        statement: `${sampledCells} environmental grid cells received terrain samples.`,
      },
      {
        key: 'raw-storage',
        status: 'documented',
        statement: 'Raw DEM tiles are referenced as artifacts and not stored inside PostGIS.',
      },
    ],
  }
  const run = await client.query(
    `
      INSERT INTO ldt_environment.extractor_runs (
        extractor_id,
        extractor_key,
        city_id,
        run_key,
        scenario_key,
        status,
        source_status,
        requested_by,
        requested_by_kind,
        trigger_kind,
        started_at,
        finished_at,
        input_summary,
        output_summary,
        validation_report,
        error,
        updated_at
      ) VALUES (
        $1,
        'terrain-dem',
        $2,
        $3,
        $4,
        'completed',
        'source-backed-open-data',
        'terrain-dem-extractor',
        'system',
        'manual',
        now(),
        now(),
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        '{}'::jsonb,
        now()
      )
      ON CONFLICT (city_id, extractor_key, scenario_key, run_key) DO UPDATE SET
        extractor_id = EXCLUDED.extractor_id,
        status = EXCLUDED.status,
        source_status = EXCLUDED.source_status,
        requested_by = EXCLUDED.requested_by,
        requested_by_kind = EXCLUDED.requested_by_kind,
        trigger_kind = EXCLUDED.trigger_kind,
        finished_at = EXCLUDED.finished_at,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        validation_report = EXCLUDED.validation_report,
        error = '{}'::jsonb,
        updated_at = now()
      RETURNING id
    `,
    [
      definition.rows[0].id,
      cityId,
      runKey,
      scenarioKey,
      JSON.stringify(inputSummary),
      JSON.stringify(outputSummary),
      JSON.stringify(validationReport),
    ],
  )
  const runId = run.rows[0].id
  await upsertArtifact(client, {
    runId,
    cityId,
    datasetId,
    artifactKind: 'source-tile-template',
    artifactUri: tileTemplate,
    mediaType: 'image/png',
    metadata: {
      sourceUrl: TERRAIN_DATASET_SOURCE_URL,
      formatReference: TERRARIUM_FORMAT_URL,
      tileZoom,
    },
  })
  await upsertArtifact(client, {
    runId,
    cityId,
    datasetId,
    artifactKind: 'tile-manifest',
    artifactUri: `urn:polisplexity:ldt:${cityId}:environment-extractor:terrain-dem:tile-manifest:z${tileZoom}`,
    mediaType: 'application/json',
    checksum: sha256(JSON.stringify(tileManifest)),
    metadata: {
      tileCount: tileManifest.length,
      tiles: tileManifest,
    },
  })
  await upsertArtifact(client, {
    runId,
    cityId,
    datasetId,
    artifactKind: 'derived-cell-report',
    artifactUri: `urn:polisplexity:ldt:${cityId}:environment-extractor:terrain-dem:derived-cells:${scenarioKey}`,
    mediaType: 'application/json',
    checksum: sha256(JSON.stringify(outputSummary)),
    metadata: outputSummary,
  })
  return { runId, runKey }
}

async function upsertArtifact(client, {
  runId,
  cityId,
  datasetId,
  artifactKind,
  artifactUri,
  mediaType,
  checksum = null,
  metadata = {},
}) {
  await client.query(
    `
      INSERT INTO ldt_environment.extractor_artifacts (
        extractor_run_id,
        city_id,
        dataset_id,
        artifact_kind,
        artifact_uri,
        media_type,
        checksum,
        coverage_geom,
        metadata
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        ST_UnaryUnion(ST_Collect(geom)),
        $8::jsonb
      FROM ldt_core.city_boundaries
      WHERE city_id = $2
      ON CONFLICT (extractor_run_id, artifact_kind, artifact_uri) DO UPDATE SET
        dataset_id = EXCLUDED.dataset_id,
        media_type = EXCLUDED.media_type,
        checksum = EXCLUDED.checksum,
        coverage_geom = EXCLUDED.coverage_geom,
        metadata = EXCLUDED.metadata
    `,
    [runId, cityId, datasetId, artifactKind, artifactUri, mediaType, checksum, JSON.stringify(metadata)],
  )
}

async function writeTerrainSamples(client, cityId, {
  gridKey,
  scenarioKey,
  sourceGridKey,
  samples,
  tileZoom,
  tileTemplate,
  sampleOffsetM,
}) {
  await client.query(
    `
      UPDATE ldt_environment.phenomenon_layers
      SET
        enabled = true,
        source_status = 'source-backed-open-data',
        authority_status = 'open-dem-derived',
        value_kind = 'source_derived_measure',
        spatial_model = 'sampled_grid_and_object',
        metadata = metadata || jsonb_build_object(
          'sourceAdapter', 'mapzen-terrain-tiles',
          'sourceUrl', $1::text,
          'formatReference', $2::text,
          'lastSourceBackedRunAt', now()
        ),
        updated_at = now()
      WHERE layer_key IN ('terrain_elevation_m', 'terrain_slope_deg')
    `,
    [TERRAIN_DATASET_SOURCE_URL, TERRARIUM_FORMAT_URL],
  )
  const terrainLayers = await client.query(
    `
      SELECT id
      FROM ldt_environment.phenomenon_layers
      WHERE layer_key IN ('terrain_elevation_m', 'terrain_slope_deg')
    `,
  )
  const terrainLayerIds = terrainLayers.rows.map((row) => row.id)
  if (terrainLayerIds.length < 2) {
    throw new Error('TERRAIN_PHENOMENON_LAYERS_NOT_REGISTERED')
  }
  await client.query('DROP TABLE IF EXISTS tmp_terrain_dem_samples')
  await client.query(
    `
      CREATE TEMP TABLE tmp_terrain_dem_samples (
        cell_id text PRIMARY KEY,
        lon double precision NOT NULL,
        lat double precision NOT NULL,
        elevation_m numeric NOT NULL,
        slope_deg numeric NOT NULL,
        sample_count integer NOT NULL,
        tile_keys jsonb NOT NULL,
        metadata jsonb NOT NULL
      ) ON COMMIT DROP
    `,
  )
  for (let index = 0; index < samples.length; index += TERRAIN_SAMPLE_INSERT_BATCH_SIZE) {
    const batch = samples.slice(index, index + TERRAIN_SAMPLE_INSERT_BATCH_SIZE)
    await client.query(
      `
        INSERT INTO tmp_terrain_dem_samples (
          cell_id,
          lon,
          lat,
          elevation_m,
          slope_deg,
          sample_count,
          tile_keys,
          metadata
        )
        SELECT
          sample.cell_id,
          sample.lon,
          sample.lat,
          sample.elevation_m,
          sample.slope_deg,
          sample.sample_count,
          sample.tile_keys,
          sample.metadata
        FROM jsonb_to_recordset($1::jsonb) AS sample(
          cell_id text,
          lon double precision,
          lat double precision,
          elevation_m numeric,
          slope_deg numeric,
          sample_count integer,
          tile_keys jsonb,
          metadata jsonb
        )
      `,
      [JSON.stringify(batch.map((sample) => ({
        cell_id: sample.cellId,
        lon: sample.lon,
        lat: sample.lat,
        elevation_m: sample.elevationM,
        slope_deg: sample.slopeDeg,
        sample_count: sample.sampleCount,
        tile_keys: sample.tileKeys,
        metadata: {
          centerTileKey: sample.centerTileKey,
          centerPixel: sample.centerPixel,
        },
      })))],
    )
  }
  await client.query(
    `
      DELETE FROM ldt_environment.object_observations
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = ANY($3::uuid[])
    `,
    [cityId, scenarioKey, terrainLayerIds],
  )
  await client.query(
    `
      DELETE FROM ldt_environment.phenomenon_cells
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = ANY($3::uuid[])
    `,
    [cityId, scenarioKey, terrainLayerIds],
  )
  const cells = await client.query(
    `
      WITH values_by_layer AS (
        SELECT
          samples.cell_id,
          samples.lon,
          samples.lat,
          samples.elevation_m,
          samples.slope_deg,
          samples.sample_count,
          samples.tile_keys,
          samples.metadata,
          density.geom,
          layer_values.layer_key,
          layer_values.value,
          layer_values.value_unit,
          layer_values.method
        FROM tmp_terrain_dem_samples samples
        JOIN ldt_viewer.density_grids density
          ON density.city_id = $1
          AND density.grid_key = $2
          AND density.cell_id = samples.cell_id
        CROSS JOIN LATERAL (
          VALUES
            (
              'terrain_elevation_m',
              samples.elevation_m,
              'm',
              'Center-sampled elevation from Mapzen Terrarium DEM tiles.'
            ),
            (
              'terrain_slope_deg',
              samples.slope_deg,
              'degree',
              'Finite-difference slope from center-neighborhood DEM samples.'
            )
        ) AS layer_values(layer_key, value, value_unit, method)
      )
      INSERT INTO ldt_environment.phenomenon_cells (
        city_id,
        layer_id,
        cell_key,
        source_grid_key,
        source_cell_id,
        scenario_key,
        observed_at,
        value,
        confidence,
        geom,
        metrics,
        provenance,
        generated_at
      )
      SELECT
        $1,
        layers.id,
        values_by_layer.cell_id,
        $4,
        values_by_layer.cell_id,
        $3,
        now(),
        values_by_layer.value,
        'source-backed-open-dem',
        values_by_layer.geom,
        jsonb_build_object(
          'elevationM', values_by_layer.elevation_m,
          'slopeDeg', values_by_layer.slope_deg,
          'sampleCount', values_by_layer.sample_count,
          'tileKeys', values_by_layer.tile_keys,
          'samplePoint', jsonb_build_object('lon', values_by_layer.lon, 'lat', values_by_layer.lat),
          'valueUnit', values_by_layer.value_unit
        ) || values_by_layer.metadata,
        jsonb_build_object(
          'source', 'Mapzen Terrain Tiles on AWS Open Data',
          'sourceUrl', $5::text,
          'formatReference', $6::text,
          'tileTemplate', $7::text,
          'tileZoom', $8::int,
          'sampleOffsetM', $9::numeric,
          'method', values_by_layer.method,
          'authorityStatus', 'open-dem-derived',
          'reproducible', true,
          'cityPortable', true
        ),
        now()
      FROM values_by_layer
      JOIN ldt_environment.phenomenon_layers layers ON layers.layer_key = values_by_layer.layer_key
      RETURNING id
    `,
    [
      cityId,
      gridKey,
      scenarioKey,
      sourceGridKey,
      TERRAIN_DATASET_SOURCE_URL,
      TERRARIUM_FORMAT_URL,
      tileTemplate,
      tileZoom,
      sampleOffsetM,
    ],
  )
  return cells.rowCount
}

async function attachTerrainObservations(client, cityId, { scenarioKey, sourceGridKey }) {
  await client.query('DROP TABLE IF EXISTS tmp_terrain_entity_points')
  await client.query(
    `
      CREATE TEMP TABLE tmp_terrain_entity_points ON COMMIT DROP AS
      SELECT
        id AS entity_id,
        ST_PointOnSurface(ST_MakeValid(geom)) AS point_geom
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND geom IS NOT NULL
        AND lifecycle_status = 'active'
    `,
    [cityId],
  )
  await client.query('CREATE INDEX tmp_terrain_entity_points_gix ON tmp_terrain_entity_points USING gist (point_geom)')
  await client.query('CREATE INDEX tmp_terrain_entity_points_entity_idx ON tmp_terrain_entity_points (entity_id)')
  await client.query('ANALYZE tmp_terrain_entity_points')
  await client.query('DROP TABLE IF EXISTS tmp_terrain_cells')
  await client.query(
    `
      CREATE TEMP TABLE tmp_terrain_cells ON COMMIT DROP AS
      SELECT
        cells.id AS cell_id,
        cells.layer_id,
        cells.value,
        cells.confidence,
        cells.metrics,
        cells.provenance,
        cells.geom
      FROM ldt_environment.phenomenon_cells cells
      JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
      WHERE cells.city_id = $1
        AND cells.scenario_key = $2
        AND cells.source_grid_key = $3
        AND layers.layer_key IN ('terrain_elevation_m', 'terrain_slope_deg')
    `,
    [cityId, scenarioKey, sourceGridKey],
  )
  await client.query('CREATE INDEX tmp_terrain_cells_gix ON tmp_terrain_cells USING gist (geom)')
  await client.query('CREATE INDEX tmp_terrain_cells_layer_idx ON tmp_terrain_cells (layer_id)')
  await client.query('ANALYZE tmp_terrain_cells')
  const result = await client.query(
    `
      WITH attached AS (
        SELECT DISTINCT ON (points.entity_id, cells.layer_id)
          points.entity_id,
          cells.layer_id,
          cells.cell_id,
          cells.value,
          cells.confidence,
          COALESCE(cells.provenance->>'method', 'Spatially attached from source-backed DEM grid.') AS method,
          jsonb_build_object(
            'sourceCellId', cells.cell_id,
            'sourceGridKey', $3::text,
            'attachmentMethod', 'point-on-surface-within-dem-cell',
            'authorityStatus', 'open-dem-derived',
            'source', cells.provenance->>'source',
            'tileZoom', cells.provenance->>'tileZoom'
          ) AS properties
        FROM tmp_terrain_entity_points points
        JOIN tmp_terrain_cells cells ON cells.geom && points.point_geom
          AND ST_Covers(cells.geom, points.point_geom)
        ORDER BY points.entity_id, cells.layer_id, cells.value DESC
      )
      INSERT INTO ldt_environment.object_observations (
        city_id,
        entity_id,
        layer_id,
        source_cell_id,
        scenario_key,
        observed_at,
        value,
        confidence,
        method,
        properties,
        generated_at
      )
      SELECT
        $1,
        entity_id,
        layer_id,
        cell_id,
        $2::text,
        now(),
        value,
        confidence,
        method,
        properties,
        now()
      FROM attached
      ON CONFLICT (city_id, entity_id, layer_id, scenario_key) DO UPDATE SET
        source_cell_id = EXCLUDED.source_cell_id,
        observed_at = EXCLUDED.observed_at,
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        method = EXCLUDED.method,
        properties = EXCLUDED.properties,
        generated_at = now()
      RETURNING id
    `,
    [cityId, scenarioKey, sourceGridKey],
  )
  return result.rowCount
}

async function refreshObservationSummary(client, cityId, scenarioKey) {
  return refreshLdtObjectObservationSummary(client, cityId, { scenarioKey })
}

async function runTerrainForCity(client, cityId, options) {
  const requestedGridKey = compactText(options.gridKey)
  const gridResolutionM = integerValue(options.gridResolutionM, DEFAULT_TERRAIN_GRID_RESOLUTION_M, 100, 5000)
  const gridKey = requestedGridKey || terrainGridKeyFromResolution(gridResolutionM)
  const generatedGrid = gridKey === terrainGridKeyFromResolution(gridResolutionM)
    ? await ensureTerrainSamplingGrid(client, cityId, { gridKey, resolutionM: gridResolutionM })
    : null
  const scenarioKey = compactText(options.scenarioKey, DEFAULT_SCENARIO_KEY)
  const tileZoom = integerValue(options.tileZoom, DEFAULT_TILE_ZOOM, MIN_TILE_ZOOM, MAX_TILE_ZOOM)
  const tileTemplate = compactText(options.tileTemplate || process.env.TWIN_STUDIO_TERRAIN_DEM_TILE_TEMPLATE, TERRARIUM_TEMPLATE)
  const sampleOffsetM = numberValue(options.sampleOffsetM, DEFAULT_SAMPLE_OFFSET_M, 50, 2000)
  const concurrency = integerValue(options.concurrency, DEFAULT_SAMPLE_CONCURRENCY, 1, 64)
  const cells = await loadGridCells(client, cityId, gridKey)
  if (cells.length === 0) throw new Error(`TERRAIN_DEM_GRID_EMPTY:${cityId}:${gridKey}`)
  if (typeof options.onProgress === 'function') {
    options.onProgress({
      cityId,
      stage: 'sampling-started',
      gridKey,
      gridResolutionM,
      tileZoom,
      sampleOffsetM,
      concurrency,
      total: cells.length,
    })
  }
  const sampled = await sampleTerrainForCells(cells, {
    tileTemplate,
    tileZoom,
    sampleOffsetM,
    concurrency,
    onProgress: typeof options.onProgress === 'function'
      ? (progress) => options.onProgress({
        cityId,
        stage: 'sampling',
        gridKey,
        ...progress,
      })
      : undefined,
  })
  if (sampled.samples.length === 0) throw new Error(`TERRAIN_DEM_NO_SOURCE_SAMPLES:${cityId}`)
  const dataset = await ensureTerrainDataset(client, cityId, {
    tileZoom: sampled.tileZoom,
    tileTemplate: sampled.tileTemplate,
    tileManifest: sampled.tileManifest,
    scenarioKey,
  })
  const sourceGridKey = `mapzen-terrain-tiles-z${sampled.tileZoom}`
  const cellsWritten = await writeTerrainSamples(client, cityId, {
    gridKey,
    scenarioKey,
    sourceGridKey,
    samples: sampled.samples,
    tileZoom: sampled.tileZoom,
    tileTemplate: sampled.tileTemplate,
    sampleOffsetM: sampled.sampleOffsetM,
  })
  const objectObservations = await attachTerrainObservations(client, cityId, { scenarioKey, sourceGridKey })
  const objectSummaries = await refreshObservationSummary(client, cityId, scenarioKey)
  const run = await ensureTerrainRun(client, cityId, {
    datasetId: dataset.id,
    scenarioKey,
    gridKey,
    tileZoom: sampled.tileZoom,
    tileTemplate: sampled.tileTemplate,
    tileManifest: sampled.tileManifest,
    sampleOffsetM: sampled.sampleOffsetM,
    sampledCells: sampled.samples.length,
    failedCells: sampled.failures.length,
    cellsWritten,
    objectObservations,
  })
  return {
    cityId,
    gridKey,
    scenarioKey,
    sourceGridKey,
    generatedGrid,
    datasetIdentifier: dataset.identifier,
    runKey: run.runKey,
    tileZoom: sampled.tileZoom,
    tileCount: sampled.tileManifest.length,
    concurrency,
    sampledCells: sampled.samples.length,
    failedCells: sampled.failures.length,
    cellsWritten,
    objectObservations,
    objectSummaries,
  }
}

export async function runTerrainDemExtractor({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  gridKey,
  gridResolutionM = DEFAULT_TERRAIN_GRID_RESOLUTION_M,
  tileZoom = DEFAULT_TILE_ZOOM,
  sampleOffsetM = DEFAULT_SAMPLE_OFFSET_M,
  concurrency = DEFAULT_SAMPLE_CONCURRENCY,
  tileTemplate,
  onProgress,
} = {}) {
  return await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
      await client.query("SET LOCAL work_mem = '32MB'")
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await runTerrainForCity(client, cityId, {
          scenarioKey,
          gridKey,
          gridResolutionM,
          tileZoom,
          sampleOffsetM,
          tileTemplate,
          concurrency,
          onProgress,
        }))
      }
      await client.query('COMMIT')
      return {
        ok: true,
        extractorKey: 'terrain-dem',
        source: 'Mapzen Terrain Tiles on AWS Open Data',
        sourceUrl: TERRAIN_DATASET_SOURCE_URL,
        scenarioKey,
        gridKey: compactText(gridKey) || terrainGridKeyFromResolution(gridResolutionM),
        gridResolutionM: integerValue(gridResolutionM, DEFAULT_TERRAIN_GRID_RESOLUTION_M, 100, 5000),
        concurrency: integerValue(concurrency, DEFAULT_SAMPLE_CONCURRENCY, 1, 64),
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function getTerrainDemExtractorStatus(cityId, {
  scenarioKey = DEFAULT_SCENARIO_KEY,
  limit = DEFAULT_RUN_LIMIT,
} = {}) {
  const rowLimit = integerValue(limit, DEFAULT_RUN_LIMIT, 1, 100)
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM ldt_environment.extractor_run_status
        WHERE city_id = $1
          AND extractor_key = 'terrain-dem'
          AND scenario_key = $2
        ORDER BY updated_at DESC
        LIMIT $3
      `,
      [cityId, scenarioKey, rowLimit],
    )
    return {
      ok: true,
      cityId,
      scenarioKey,
      runs: result.rows,
    }
  })
}

export async function closeLdtTerrainDemExtractorPool() {
  await closeSharedProductionPool()
}
