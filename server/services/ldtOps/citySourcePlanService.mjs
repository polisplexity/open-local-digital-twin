import { getProductionPool } from '../../db/postgisPool.mjs'
import { getCityLayerCapabilitiesForViewer } from '../liveFeature/viewportFeatureUseCaseService.mjs'
import { citySourcePresetFor } from '../../config/citySourcePresets.mjs'

const SOURCE_PLAN_OVERRIDE_FIELDS = ['rawSchema', 'sourceSlug', 'sourceUrl', 'sourcePath', 'overtureRelease']

const DEFAULT_BOUNDARY_MIN_AREA_KM2 = 1
const DEFAULT_BOUNDARY_MAX_AREA_KM2 = 25000
const DEFAULT_BOUNDARY_MAX_BBOX_DEGREES = 5

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function roundedNumber(value, digits = 3) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null
}

function bboxFromRow(row = {}) {
  const bbox = [row.west, row.south, row.east, row.north].map(Number)
  return bbox.length === 4 && bbox.every(Number.isFinite) ? bbox : null
}

function failBoundaryGate(cityId, code, detail = {}) {
  return {
    ok: true,
    cityId,
    passed: false,
    code,
    severity: 'blocker',
    detail,
  }
}

export async function evaluateCityBoundaryQualityGate(cityId) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

  const pool = getProductionPool()
  if (!pool) {
    return {
      ok: true,
      configured: false,
      cityId: normalizedCityId,
      passed: true,
      code: 'DATABASE_NOT_CONFIGURED',
      severity: 'advisory',
      detail: {},
    }
  }

  const result = await pool.query(
    `WITH city AS (
       SELECT id, centroid FROM ldt_core.cities WHERE id = $1
       UNION ALL
       SELECT id, centroid FROM public.cities WHERE id = $1
       LIMIT 1
     ), boundary AS (
       SELECT geom, properties, boundary_role AS role, authority_status
       FROM ldt_core.city_boundaries
       WHERE city_id = $1
       UNION ALL
       SELECT geom, properties, source AS role, authority_status
       FROM public.city_boundaries
       WHERE city_id = $1
     ), merged AS (
       SELECT ST_Multi(ST_UnaryUnion(ST_Collect(ST_MakeValid(geom)))) AS geom,
              count(*)::int AS feature_count,
              bool_or(lower(coalesce(role, '')) IN ('administrative', 'municipal', 'city', 'official')) AS has_admin_role,
              bool_or(properties ? 'bbox' OR lower(coalesce(role, '')) LIKE '%bbox%' OR lower(coalesce(properties->>'source', '')) LIKE '%bbox%') AS has_bbox_source_marker
       FROM boundary
     ), metrics AS (
       SELECT
         feature_count,
         has_admin_role,
         has_bbox_source_marker,
         GeometryType(geom) AS geometry_type,
         ST_IsValid(geom) AS is_valid,
         ST_Area(geom::geography) / 1000000.0 AS area_km2,
         ST_Perimeter(geom::geography) / 1000.0 AS perimeter_km,
         ST_XMin(ST_Extent(geom))::float AS west,
         ST_YMin(ST_Extent(geom))::float AS south,
         ST_XMax(ST_Extent(geom))::float AS east,
         ST_YMax(ST_Extent(geom))::float AS north,
         ST_Contains(geom, (SELECT centroid FROM city)) AS contains_centroid
       FROM merged
       GROUP BY geom, feature_count, has_admin_role, has_bbox_source_marker
     )
     SELECT * FROM metrics`,
    [normalizedCityId],
  )
  const row = result.rows[0]
  if (!row || Number(row.feature_count ?? 0) < 1) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_REQUIRED')
  }

  const bbox = bboxFromRow(row)
  if (!bbox) return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_BBOX_INVALID')
  const [west, south, east, north] = bbox
  const widthDegrees = east - west
  const heightDegrees = north - south
  const areaKm2 = Number(row.area_km2)
  const perimeterKm = Number(row.perimeter_km)
  const maxDegrees = numberEnv('TWIN_STUDIO_BOUNDARY_GATE_MAX_BBOX_DEGREES', DEFAULT_BOUNDARY_MAX_BBOX_DEGREES)
  const minAreaKm2 = numberEnv('TWIN_STUDIO_BOUNDARY_GATE_MIN_AREA_KM2', DEFAULT_BOUNDARY_MIN_AREA_KM2)
  const maxAreaKm2 = numberEnv('TWIN_STUDIO_BOUNDARY_GATE_MAX_AREA_KM2', DEFAULT_BOUNDARY_MAX_AREA_KM2)
  const detail = {
    featureCount: Number(row.feature_count ?? 0),
    bbox,
    widthDegrees: roundedNumber(widthDegrees, 6),
    heightDegrees: roundedNumber(heightDegrees, 6),
    areaKm2: roundedNumber(areaKm2, 2),
    perimeterKm: roundedNumber(perimeterKm, 2),
    geometryType: row.geometry_type ?? null,
    containsCentroid: row.contains_centroid === true,
    hasAdminRole: row.has_admin_role === true,
    hasBboxSourceMarker: row.has_bbox_source_marker === true,
  }

  if (west < -180 || east > 180 || south < -90 || north > 90 || widthDegrees <= 0 || heightDegrees <= 0) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_BBOX_OUT_OF_RANGE', detail)
  }
  if (widthDegrees > maxDegrees || heightDegrees > maxDegrees) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_BBOX_TOO_LARGE', detail)
  }
  if (!Number.isFinite(areaKm2) || areaKm2 < minAreaKm2 || areaKm2 > maxAreaKm2) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_AREA_OUT_OF_RANGE', detail)
  }
  if (row.is_valid !== true) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_GEOMETRY_INVALID', detail)
  }
  if (detail.hasBboxSourceMarker && !detail.hasAdminRole) {
    return failBoundaryGate(normalizedCityId, 'CITY_BOUNDARY_LOOKS_LIKE_TECHNICAL_BBOX', detail)
  }

  return {
    ok: true,
    configured: true,
    cityId: normalizedCityId,
    passed: true,
    code: 'CITY_BOUNDARY_READY',
    severity: 'pass',
    detail,
  }
}



export async function repairCityBoundaryFromCurrentGate(cityId, input = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_NOT_CONFIGURED')

  const gate = await evaluateCityBoundaryQualityGate(normalizedCityId)
  const bbox = gate.detail?.bbox
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every((value) => Number.isFinite(Number(value)))) {
    throw new Error(`CITY_BOUNDARY_REPAIR_BBOX_REQUIRED:${gate.code}`)
  }
  if (gate.passed === true && input.force !== true) {
    return { ok: true, cityId: normalizedCityId, repaired: false, boundaryGate: gate }
  }

  const [west, south, east, north] = bbox.map(Number)
  await pool.query(
    `INSERT INTO ldt_core.city_boundaries (city_id, boundary_role, authority_status, geom, properties)
     VALUES (
       $1,
       'administrative',
       'operator-accepted',
       ST_Multi(ST_MakeEnvelope($2, $3, $4, $5, 4326)),
       $6::jsonb
     )`,
    [
      normalizedCityId,
      west,
      south,
      east,
      north,
      JSON.stringify({
        source: 'operator-boundary-repair',
        repairKind: 'accept-current-bbox-as-municipal-boundary',
        repairedFromGateCode: gate.code,
        note: String(input.note ?? '').trim() || 'Operator accepted current boundary extent to unblock local bootstrap; replace with an official municipal boundary when available.',
        bbox,
        repairedAt: new Date().toISOString(),
      }),
    ],
  )
  const repairedGate = await evaluateCityBoundaryQualityGate(normalizedCityId)
  return {
    ok: true,
    cityId: normalizedCityId,
    repaired: true,
    previousBoundaryGate: gate,
    boundaryGate: repairedGate,
  }
}

function normalizeText(value) {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

function normalizeProviderOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function rowToOverride(row) {
  if (!row) return null
  const providerOverride = normalizeProviderOverride(row.provider_override)
  return {
    rawSchema: row.raw_schema ?? null,
    sourceSlug: row.source_slug ?? null,
    sourceUrl: row.source_url ?? null,
    sourcePath: row.source_path ?? null,
    overtureRelease: row.overture_release ?? null,
    providerOverride,
    notes: row.notes ?? null,
    updatedAt: row.updated_at ?? null,
    applied: Boolean(row.raw_schema || row.source_slug || row.source_url || row.source_path || row.overture_release || Object.keys(providerOverride).length),
  }
}

async function readCitySourcePlanOverride(cityId) {
  const pool = getProductionPool()
  if (!pool) return null
  const result = await pool.query(
    `SELECT city_id, raw_schema, source_slug, source_url, source_path, overture_release, provider_override, notes, updated_at
       FROM ldt_ops.city_source_plan_overrides
      WHERE city_id = $1`,
    [cityId],
  )
  return rowToOverride(result.rows[0])
}

function mergePresetOverride(defaultPreset, override) {
  if (!override?.applied) return { ...defaultPreset, providerOverride: {} }
  const merged = { ...defaultPreset }
  for (const field of SOURCE_PLAN_OVERRIDE_FIELDS) {
    if (override[field]) merged[field] = override[field]
  }
  merged.providerOverride = normalizeProviderOverride(override.providerOverride)
  return merged
}

export async function saveCitySourcePlanOverride(cityId, input = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_NOT_CONFIGURED')
  const providerOverride = normalizeProviderOverride(input.providerOverride ?? input.provider_override)
  const result = await pool.query(
    `INSERT INTO ldt_ops.city_source_plan_overrides (
       city_id, raw_schema, source_slug, source_url, source_path, overture_release, provider_override, notes, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())
     ON CONFLICT (city_id) DO UPDATE SET
       raw_schema = EXCLUDED.raw_schema,
       source_slug = EXCLUDED.source_slug,
       source_url = EXCLUDED.source_url,
       source_path = EXCLUDED.source_path,
       overture_release = EXCLUDED.overture_release,
       provider_override = EXCLUDED.provider_override,
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING city_id, raw_schema, source_slug, source_url, source_path, overture_release, provider_override, notes, updated_at`,
    [
      normalizedCityId,
      normalizeText(input.rawSchema ?? input.raw_schema),
      normalizeText(input.sourceSlug ?? input.source_slug),
      normalizeText(input.sourceUrl ?? input.source_url),
      normalizeText(input.sourcePath ?? input.source_path),
      normalizeText(input.overtureRelease ?? input.overture_release),
      JSON.stringify(providerOverride),
      normalizeText(input.notes),
    ],
  )
  return {
    ok: true,
    cityId: normalizedCityId,
    override: rowToOverride(result.rows[0]),
  }
}

export async function clearCitySourcePlanOverride(cityId) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_NOT_CONFIGURED')
  await pool.query('DELETE FROM ldt_ops.city_source_plan_overrides WHERE city_id = $1', [normalizedCityId])
  return { ok: true, cityId: normalizedCityId, override: null }
}


function layerOptions(layerCapabilities) {
  return (layerCapabilities?.layers ?? [])
    .map((layer) => ({
      key: layer.key || layer.layerKey || layer.id || '',
      label: layer.label || layer.name || layer.key || layer.layerKey || layer.id || 'Layer',
      capability: layer.capability || layer.sourceKind || layer.kind || layer.type || '',
    }))
    .filter((layer) => layer.key)
    .filter((layer) => !/(^|[-_\s])(e2e|smoke|test)([-_\s]|$)/i.test(`${layer.key} ${layer.label}`))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function firstLayer(layers, pattern) {
  return layers.find((layer) => pattern.test(`${layer.key} ${layer.label}`)) ?? null
}

function buildProviderPackages({ preset, targets }) {
  return [
    targets.roadsLayer ? {
      layerKey: targets.roadsLayer.key,
      action: 'osm-local-extract',
      sourceFormat: 'raw-osm-pbf',
      sourceUri: `file://${preset.sourcePath}`,
      sourceVersion: preset.sourceSlug,
      posture: 'open-data-native',
      queueForExecution: true,
      metadata: {
        rawSchema: preset.rawSchema,
        sourceSlug: preset.sourceSlug,
        sourceUrl: preset.sourceUrl,
        sourcePath: preset.sourcePath,
        providerOverride: preset.providerOverride ?? {},
      },
    } : null,
    targets.buildingsLayer ? {
      layerKey: targets.buildingsLayer.key,
      action: 'overture-buildings',
      sourceFormat: 'overture-buildings',
      sourceUri: null,
      sourceVersion: preset.overtureRelease,
      release: preset.overtureRelease,
      posture: 'open-data-native',
      queueForExecution: true,
      metadata: {
        source: 'Overture Maps Buildings',
        release: preset.overtureRelease,
        bboxSource: 'active-city-boundary',
        providerOverride: preset.providerOverride ?? {},
      },
    } : null,
    targets.roadsLayer ? {
      layerKey: targets.roadsLayer.key,
      action: 'overture-roads',
      sourceFormat: 'overture-roads',
      sourceUri: null,
      sourceVersion: preset.overtureRelease,
      release: preset.overtureRelease,
      posture: 'open-data-native',
      queueForExecution: true,
      metadata: {
        source: 'Overture Maps Transportation',
        release: preset.overtureRelease,
        bboxSource: 'active-city-boundary',
        providerOverride: preset.providerOverride ?? {},
      },
    } : null,
  ].filter(Boolean)
}

export async function getCitySourcePlan(cityId, { planKind = 'city-open-data-bootstrap' } = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

  const layerCapabilities = await getCityLayerCapabilitiesForViewer(normalizedCityId)
  const layers = layerOptions(layerCapabilities)
  const roadsLayer = firstLayer(layers, /(^|[-_\s])(roads|road|transport|streets|street)([-_\s]|$)/i)
  const overtureBuildingsLayer = firstLayer(layers, /overture.*build|build.*overture/i)
  const buildingsLayer = overtureBuildingsLayer ?? firstLayer(layers, /(^|[-_\s])buildings?([-_\s]|$)/i)
  const refreshLayer = buildingsLayer ?? roadsLayer ?? layers[0] ?? null
  const [override, boundaryGate] = await Promise.all([
    readCitySourcePlanOverride(normalizedCityId),
    evaluateCityBoundaryQualityGate(normalizedCityId),
  ])
  const targets = {
    roadsLayer,
    buildingsLayer,
    refreshLayer,
    ready: Boolean(roadsLayer && buildingsLayer),
    boundaryReady: boundaryGate.passed === true,
  }
  const preset = mergePresetOverride(citySourcePresetFor(normalizedCityId), override)
  const sourcePlan = {
    kind: planKind,
    posture: 'open-data-native',
    target: `${normalizedCityId}-city-open-data-bootstrap`,
    cityId: normalizedCityId,
    preset,
  }
  const checks = [
    { label: 'Selected city', value: normalizedCityId },
    { label: 'OSM raw schema', value: preset.rawSchema },
    { label: 'OSM target', value: roadsLayer?.label || 'Road layer missing' },
    { label: 'Overture target', value: buildingsLayer?.label || 'Building layer missing' },
    { label: 'Viewer refresh', value: refreshLayer?.label || 'Layer missing' },
    { label: 'Source override', value: override?.applied ? 'Operator override saved' : 'Default city preset' },
    { label: 'Boundary gate', value: boundaryGate.passed ? 'Boundary ready' : boundaryGate.code },
  ]

  return {
    ok: true,
    cityId: normalizedCityId,
    planKind,
    ready: targets.ready && boundaryGate.passed === true,
    sourcePlan,
    boundaryGate,
    override,
    providerPackages: buildProviderPackages({ preset, targets }),
    extractorKeys: ['terrain-dem', 'weather-field', 'hydrology-grid'],
    refreshViewerAggregates: true,
    refreshConsolidation: true,
    refreshTwinQuerySurfaces: true,
    validationMode: 'city-open-data-bootstrap',
    targets,
    checks,
    layerCount: layers.length,
  }
}
