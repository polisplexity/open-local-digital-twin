import { getProductionPool } from '../../db/postgisPool.mjs'
import { PAYLOAD_SCHEMA_VERSION } from './payloadConstants.mjs'

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function parseMaybeJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function layerCount(counts, key) {
  return Number(counts.get(key) ?? 0)
}

function buildLayerDefinition({
  key,
  label,
  count,
  color,
  visibleByDefault,
  cluster,
  description,
}) {
  return {
    key,
    label,
    count,
    renderedCount: 0,
    discoveredCount: count,
    description,
    color,
    visibleByDefault,
    cluster,
    twinCategoryKey: 'base',
    twinCategory: 'Base layer',
    semanticState: count > 0 ? 'Normalized provider geometry' : 'Not loaded yet',
    transportStatus: count > 0
      ? 'Geometry is delivered through live vector tiles from PostGIS.'
      : 'This layer is defined for the city but has no normalized features yet.',
    system: cluster,
    ldtLayer: 'Data Sources + Visualisation',
    capability: 'Descriptive',
    phase: 'Explore',
    cityMeaning: description,
    nextSemanticStep: 'Attach authority semantics and operational data as providers become available.',
  }
}

function buildInventory({ city, counts, boundaryFeatureCount, areaKm2 }) {
  const roads = layerCount(counts, 'roads')
  const buildings = layerCount(counts, 'buildings') + layerCount(counts, 'overture-buildings')
  const greenBlue = layerCount(counts, 'greenBlue')
  const places = layerCount(counts, 'places')
  const facilities = layerCount(counts, 'facilities')

  const inventory = {
    totals: {
      boundaryRings: boundaryFeatureCount,
      scopeAreaKm2: areaKm2,
      scopeWidthKm: 0,
      scopeHeightKm: 0,
      unclassifiedLandAreaKm2: 0,
      unclassifiedLandPercent: 0,
      roadsRendered: 0,
      roadsDiscovered: roads,
      roadNamesDiscovered: 0,
      renderedRoadKm: 0,
      buildingsRendered: 0,
      buildingsDiscovered: buildings,
      buildingCandidateNew: 0,
      buildingCandidateMatched: 0,
      averageBuildingHeight: 0,
      tallBuildings: 0,
      facilitiesRendered: 0,
      facilitiesDiscovered: facilities,
      placesRendered: 0,
      placesDiscovered: places,
      greenBlueRendered: 0,
      greenBlueDiscovered: greenBlue,
      mobilityAnchors: 0,
      civicAnchors: 0,
      commerceAnchors: 0,
      wasteSeedCount: 0,
    },
    sections: [
      {
        title: 'Provider-backed city inventory',
        summary: `${city.name} is loaded from normalized PostGIS provider layers and rendered through vector tiles.`,
        items: [
          { label: 'Buildings available', count: buildings },
          { label: 'Roads available', count: roads },
          { label: 'Scope area (km²)', count: areaKm2 },
        ],
      },
    ],
  }

  inventory.layerDefinitions = [
    buildLayerDefinition({
      key: 'boundary',
      label: 'Boundary',
      count: boundaryFeatureCount,
      color: '#c46b2d',
      visibleByDefault: boundaryFeatureCount > 0,
      cluster: 'Territory',
      description: "Municipal or source boundary when available. Technical extraction bboxes are suppressed before rendering.",
    }),
    buildLayerDefinition({
      key: 'roads',
      label: 'Roads',
      count: roads,
      color: '#516274',
      visibleByDefault: roads > 0,
      cluster: 'Mobility and access',
      description: 'Street and road geometry normalized from provider data.',
    }),
    buildLayerDefinition({
      key: 'buildings',
      label: 'Buildings',
      count: buildings,
      color: '#8ea2b8',
      visibleByDefault: buildings > 0,
      cluster: 'Built fabric',
      description: 'Building footprints normalized from provider data.',
    }),
    buildLayerDefinition({
      key: 'greenBlue',
      label: 'Land use / open land',
      count: greenBlue,
      color: '#4d8f5a',
      visibleByDefault: greenBlue > 0,
      cluster: 'Environment',
      description: 'Environmental and land-use geometry when loaded for this city.',
    }),
    buildLayerDefinition({
      key: 'places',
      label: 'Settlements and places',
      count: places,
      color: '#7c3aed',
      visibleByDefault: false,
      cluster: 'Territory',
      description: 'Named place references when loaded for this city.',
    }),
    buildLayerDefinition({
      key: 'facilities',
      label: 'Facilities',
      count: facilities,
      color: '#0f766e',
      visibleByDefault: facilities > 0,
      cluster: 'Public services',
      description: 'Facility points when loaded for this city.',
    }),
  ]

  return inventory
}

export async function buildPostgisBasePayload(city) {
  const pool = getProductionPool()
  if (!pool) return null

  const result = await pool.query(
    `
      WITH latest_boundary AS (
        SELECT geom, source, properties
        FROM city_boundaries
        WHERE city_id = $1
        ORDER BY
          CASE
            WHEN source LIKE 'phase14-%' OR COALESCE(properties->>'source', '') LIKE 'phase14-%' THEN 1
            ELSE 0
          END,
          created_at DESC
        LIMIT 1
      ),
      feature_scope AS (
        SELECT ST_Collect(geom) AS geom, ST_Extent(geom) AS box
        FROM city_features
        WHERE city_id = $1
      ),
      feature_counts AS (
        SELECT
          COALESCE(ld.key, cf.feature_type) AS layer_key,
          count(*)::int AS count
        FROM city_features cf
        LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
        WHERE cf.city_id = $1
        GROUP BY COALESCE(ld.key, cf.feature_type)
      )
      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM latest_boundary
            WHERE source LIKE 'phase14-%'
               OR COALESCE(properties->>'source', '') LIKE 'phase14-%'
          ) THEN jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_build_array())
          ELSE COALESCE(
            (SELECT jsonb_build_object(
              'type', 'FeatureCollection',
              'features', jsonb_build_array(jsonb_build_object(
                'type', 'Feature',
                'properties', jsonb_build_object('id', 'boundary:' || $1, 'label', $2::text) || COALESCE(properties, '{}'::jsonb),
                'geometry', ST_AsGeoJSON(geom)::jsonb
              ))
            ) FROM latest_boundary),
            jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_build_array())
          )
        END AS boundary,
        COALESCE(
          (SELECT ST_X(ST_PointOnSurface(geom))::double precision FROM feature_scope WHERE geom IS NOT NULL),
          (SELECT ST_X(ST_PointOnSurface(geom))::double precision FROM latest_boundary),
          $3::double precision
        ) AS lon,
        COALESCE(
          (SELECT ST_Y(ST_PointOnSurface(geom))::double precision FROM feature_scope WHERE geom IS NOT NULL),
          (SELECT ST_Y(ST_PointOnSurface(geom))::double precision FROM latest_boundary),
          $4::double precision
        ) AS lat,
        COALESCE(
          (SELECT round((ST_Area(geom::geography) / 1000000)::numeric, 2)::double precision FROM latest_boundary),
          0
        ) AS area_km2,
        COALESCE(
          (SELECT jsonb_build_array(ST_XMin(box), ST_YMin(box), ST_XMax(box), ST_YMax(box)) FROM feature_scope WHERE box IS NOT NULL),
          NULL
        ) AS bounds,
        COALESCE(
          (SELECT jsonb_object_agg(layer_key, count) FROM feature_counts),
          '{}'::jsonb
        ) AS counts
    `,
    [city.id, city.name, city.center?.lon ?? 0, city.center?.lat ?? 0],
  )
  const row = result.rows[0]
  const countsObject = parseMaybeJson(row?.counts, {}) ?? {}
  const counts = new Map(Object.entries(countsObject).map(([key, value]) => [key, Number(value)]))
  const totalFeatures = Array.from(counts.values()).reduce((sum, value) => sum + Number(value || 0), 0)
  if (totalFeatures <= 0) return null

  const center = {
    lon: Number(row.lon ?? city.center?.lon ?? 0),
    lat: Number(row.lat ?? city.center?.lat ?? 0),
  }
  const boundary = parseMaybeJson(row.boundary, emptyFeatureCollection()) ?? emptyFeatureCollection()
  const boundaryFeatureCount = boundary.features?.length ?? 0
  const areaKm2 = Number(row.area_km2 ?? 0)
  const inventory = buildInventory({ city, counts, boundaryFeatureCount, areaKm2 })

  return {
    version: PAYLOAD_SCHEMA_VERSION,
    city,
    fetchedAt: new Date().toISOString(),
    center,
    bounds: parseMaybeJson(row.bounds, null),
    layers: {
      boundary,
      roads: emptyFeatureCollection(),
      buildings: emptyFeatureCollection(),
      facilities: emptyFeatureCollection(),
      unclassifiedLand: emptyFeatureCollection(),
      greenBlue: emptyFeatureCollection(),
      places: emptyFeatureCollection(),
      civic: emptyFeatureCollection(),
      mobility: emptyFeatureCollection(),
      commerce: emptyFeatureCollection(),
      wasteSeeds: emptyFeatureCollection(),
      center: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 'city:center', label: `${city.name} anchor`, kind: 'anchor' },
            geometry: { type: 'Point', coordinates: [center.lon, center.lat] },
          },
        ],
      },
    },
    inventory,
    metrics: [
      {
        label: 'Buildings available',
        value: String(inventory.totals.buildingsDiscovered),
        note: 'Delivered through vector tiles from the normalized PostGIS twin.',
      },
      {
        label: 'Roads available',
        value: String(inventory.totals.roadsDiscovered),
        note: 'Delivered through vector tiles from the normalized PostGIS twin.',
      },
      {
        label: 'Public scope',
        value: `${areaKm2.toFixed(1)} km²`,
        note: `${city.name} boundary is used for the current workspace extent.`,
      },
    ],
    target: null,
    scene: {
      center,
      objects: [],
      buildings: [],
      roads: [],
      greenBlue: [],
      places: [],
    },
    extraction: {
      attempt: 1,
      health: {
        healthy: true,
        sparse: false,
        roads: inventory.totals.roadsDiscovered,
        buildings: inventory.totals.buildingsDiscovered,
        facilities: inventory.totals.facilitiesDiscovered,
        places: inventory.totals.placesDiscovered,
        greenBlue: inventory.totals.greenBlueDiscovered,
        context:
          inventory.totals.facilitiesDiscovered +
          inventory.totals.placesDiscovered +
          inventory.totals.greenBlueDiscovered,
      },
      mode: 'postgis-provider-tile-payload',
      tilePlan: null,
    },
    reference: {
      center,
      source: 'postgis-provider-layers',
    },
    sourceArtifacts: [],
    notes: [
      `${city.name} is using the normalized PostGIS provider inventory as the base twin.`,
      'Large geometry layers are intentionally delivered through vector tiles instead of a monolithic JSON payload.',
    ],
  }
}
