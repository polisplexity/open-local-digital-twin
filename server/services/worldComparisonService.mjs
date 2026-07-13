import { withProductionClient } from './serviceDatabase.mjs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function number(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function boundedInteger(value, fallback, minimum = 1, maximum = 10000) {
  const parsed = Math.trunc(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function requireUuid(value, errorCode) {
  const normalized = text(value)
  if (!UUID_PATTERN.test(normalized)) throw new Error(errorCode)
  return normalized
}

function iso(value) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function scenarioKind(scenarioKey = '') {
  const key = text(scenarioKey).toLowerCase()
  if (key.endsWith('-baseline')) return 'baseline'
  if (key.endsWith('-intervention')) return 'intervention'
  return 'simulation'
}

function geometryObject(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function walkCoordinates(geometry, callback) {
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      callback(value[0], value[1])
      return
    }
    value.forEach(visit)
  }
  visit(geometry?.coordinates)
}

function boundsForFeatures(features = []) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  features.forEach((feature) => {
    walkCoordinates(feature.geometry, (lon, lat) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
      minLon = Math.min(minLon, lon)
      minLat = Math.min(minLat, lat)
      maxLon = Math.max(maxLon, lon)
      maxLat = Math.max(maxLat, lat)
    })
  })
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
  return { minLon, minLat, maxLon, maxLat }
}

function featureSummary(features = [], outputKeys = []) {
  const countsBySemanticClass = {}
  const numericDomains = {}
  features.forEach((feature) => {
    const properties = feature.properties ?? {}
    const semanticClass = text(properties.semanticClass, 'cityObject')
    countsBySemanticClass[semanticClass] = (countsBySemanticClass[semanticClass] ?? 0) + 1
    outputKeys.forEach((key) => {
      const value = Number(properties[key])
      if (!Number.isFinite(value)) return
      const current = numericDomains[key]
      numericDomains[key] = current
        ? { min: Math.min(current.min, value), max: Math.max(current.max, value) }
        : { min: value, max: value }
    })
  })
  return {
    bounds: boundsForFeatures(features),
    countsBySemanticClass,
    numericDomains,
  }
}

function normalizeWorld(row = {}) {
  const kind = scenarioKind(row.scenario_key)
  const generatedAt = iso(row.last_generated_at ?? row.finished_at ?? row.started_at)
  return {
    id: row.id,
    cityId: row.city_id,
    worldKind: 'simulation',
    scenarioKind: kind,
    scenarioKey: row.scenario_key,
    status: row.status,
    modelKey: row.model_key,
    modelName: row.model_name,
    modelFamily: row.model_family,
    modelVersion: row.model_version,
    title: `${text(row.model_name, row.model_key)} / ${kind}`,
    entityCount: Number(row.entity_count ?? 0),
    outputCount: Number(row.output_count ?? 0),
    outputKeyCount: Number(row.output_key_count ?? 0),
    generatedAt,
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    authorityStatuses: Array.isArray(row.authority_statuses) ? row.authority_statuses : [],
    parameters: row.inputs?.parameters ?? {},
    workflowRunId: row.inputs?.workflowRunId ?? null,
    selectionSetId: row.inputs?.selectionSetId ?? null,
    summary: row.outputs ?? {},
    uncertainty: row.uncertainty ?? {},
  }
}

export async function listCitySimulationWorlds(cityId, options = {}) {
  return withProductionClient(async (client) => {
    const limit = boundedInteger(options.limit, 40, 1, 200)
    const modelKey = text(options.modelKey ?? options.model_key)
    const result = await client.query(`
      SELECT *
      FROM ldt_science.simulation_run_inventory
      WHERE city_id = $1
        AND entity_count > 0
        AND ($2 = '' OR model_key = $2)
      ORDER BY COALESCE(last_generated_at, finished_at, started_at) DESC, id DESC
      LIMIT $3
    `, [cityId, modelKey, limit])
    return {
      configured: true,
      ok: true,
      cityId,
      worlds: result.rows.map(normalizeWorld),
      summary: { returned: result.rowCount, limit, modelKey: modelKey || null },
      error: null,
    }
  }, { returnMissingDatabaseResult: true })
}

export async function getCitySimulationWorldGeojson(cityId, simulationRunId) {
  const runId = requireUuid(simulationRunId, 'SIMULATION_WORLD_ID_INVALID')
  return withProductionClient(async (client) => {
    const runResult = await client.query(`
      SELECT *
      FROM ldt_science.simulation_run_inventory
      WHERE city_id = $1 AND id = $2::uuid
      LIMIT 1
    `, [cityId, runId])
    if (!runResult.rowCount) {
      return { configured: true, ok: false, cityId, simulationRunId: runId, error: 'SIMULATION_WORLD_NOT_FOUND' }
    }
    const outputResult = await client.query(`
      SELECT
        simulation_output.stable_id,
        simulation_output.canonical_uri,
        simulation_output.entity_type,
        simulation_output.label,
        ST_AsGeoJSON(simulation_output.geom)::jsonb AS geometry,
        simulation_output.output_key,
        simulation_output.value_numeric,
        simulation_output.value_text,
        simulation_output.value_json,
        simulation_output.unit,
        simulation_output.confidence,
        simulation_output.authority_status,
        simulation_output.generated_at,
        simulation_output.warnings,
        city_object.building_type,
        city_object.height_m,
        city_object.floors,
        city_object.footprint_area_m2,
        city_object.provider,
        city_object.source_coverage_status
      FROM ldt_science.entity_simulation_outputs simulation_output
      LEFT JOIN ldt_query.city_objects city_object
        ON city_object.id = simulation_output.entity_id
       AND city_object.city_id = simulation_output.city_id
      WHERE simulation_output.city_id = $1
        AND simulation_output.simulation_run_id = $2::uuid
      ORDER BY simulation_output.stable_id, simulation_output.output_key
    `, [cityId, runId])

    const byEntity = new Map()
    const outputKeys = new Set()
    outputResult.rows.forEach((row) => {
      const stableId = text(row.stable_id)
      if (!stableId) return
      if (!byEntity.has(stableId)) {
        byEntity.set(stableId, {
          type: 'Feature',
          id: stableId,
          geometry: geometryObject(row.geometry),
          properties: {
            objectId: stableId,
            canonicalUri: row.canonical_uri,
            entityType: row.entity_type,
            label: row.label,
            semanticClass: String(row.entity_type || '').toLowerCase().includes('building') ? 'buildings' : 'cityObject',
            worldKind: 'simulation',
            simulationRunId: runId,
            generatedAt: iso(row.generated_at),
            authorityStatus: row.authority_status,
            scenarioKind: scenarioKind(runResult.rows[0].scenario_key),
            modelKey: runResult.rows[0].model_key,
            modelVersion: runResult.rows[0].model_version,
            buildingType: row.building_type,
            heightMeters: number(row.height_m),
            floors: number(row.floors),
            footprintAreaM2: number(row.footprint_area_m2),
            provider: row.provider,
            sourceCoverageStatus: row.source_coverage_status,
            simulationOutputs: {},
          },
        })
      }
      outputKeys.add(row.output_key)
      const value = row.value_numeric == null ? row.value_text : number(row.value_numeric)
      const feature = byEntity.get(stableId)
      feature.properties[row.output_key] = value
      feature.properties.simulationOutputs[row.output_key] = {
        value,
        unit: row.unit,
        confidence: row.confidence,
        authorityStatus: row.authority_status,
        generatedAt: iso(row.generated_at),
        warnings: row.warnings ?? [],
        raw: row.value_json ?? {},
      }
    })
    const features = Array.from(byEntity.values()).filter((feature) => feature.geometry)
    const keys = Array.from(outputKeys).sort()
    const world = normalizeWorld(runResult.rows[0])
    return {
      configured: true,
      ok: true,
      cityId,
      world,
      geojson: { type: 'FeatureCollection', features },
      summary: {
        ...featureSummary(features, keys),
        resultCount: world.entityCount,
        returned: features.length,
        truncated: features.length < world.entityCount,
        outputKeys: keys,
        generatedAt: world.generatedAt,
        authorityStatus: 'simulated',
        worldKind: 'simulation',
      },
      error: null,
    }
  }, { returnMissingDatabaseResult: true })
}

export async function getCitySelectionSnapshotGeojson(cityId, selectionSetId) {
  const selectionId = requireUuid(selectionSetId, 'SELECTION_SNAPSHOT_ID_INVALID')
  return withProductionClient(async (client) => {
    const selectionResult = await client.query(`
      SELECT *
      FROM ldt_analysis.selection_sets
      WHERE city_id = $1 AND id = $2::uuid
      LIMIT 1
    `, [cityId, selectionId])
    if (!selectionResult.rowCount) {
      return { configured: true, ok: false, cityId, selectionSetId: selectionId, error: 'SELECTION_SNAPSHOT_NOT_FOUND' }
    }
    const memberResult = await client.query(`
      SELECT
        member.object_id,
        member.semantic_class,
        member.layer_key,
        member.entity_type,
        member.label,
        member.rank,
        member.score,
        member.distance_m,
        member.attributes,
        entity.stable_id,
        entity.canonical_uri,
        ST_AsGeoJSON(COALESCE(member.geometry_snapshot, entity.geom))::jsonb AS geometry,
        member.geometry_snapshot IS NOT NULL AS geometry_snapshotted
      FROM ldt_analysis.selection_set_members member
      LEFT JOIN ldt_core.city_entities entity
        ON entity.id = member.city_entity_id
       AND entity.city_id = $1
      WHERE member.selection_set_id = $2::uuid
      ORDER BY member.rank, member.object_id
      LIMIT 10000
    `, [cityId, selectionId])
    const selection = selectionResult.rows[0]
    const snapshotAt = iso(selection.updated_at ?? selection.created_at)
    const features = memberResult.rows.map((row) => ({
      type: 'Feature',
      id: text(row.stable_id, row.object_id),
      geometry: geometryObject(row.geometry),
      properties: {
        ...(row.attributes ?? {}),
        objectId: row.object_id,
        canonicalUri: row.canonical_uri,
        semanticClass: row.semantic_class,
        layerKey: row.layer_key,
        entityType: row.entity_type,
        label: row.label,
        rank: Number(row.rank ?? 0),
        score: number(row.score),
        distanceMeters: number(row.distance_m),
        worldKind: 'selection-snapshot',
        selectionSetId: selectionId,
        snapshotAt,
        authorityStatus: text(row.attributes?.authorityStatus, 'selection-snapshot'),
        geometrySnapshotStatus: row.geometry_snapshotted ? 'captured' : 'current-fallback',
      },
    })).filter((feature) => feature.geometry)
    const geometrySnapshotCount = memberResult.rows.filter((row) => row.geometry_snapshotted).length
    const geometrySnapshotComplete = memberResult.rowCount > 0 && geometrySnapshotCount === memberResult.rowCount
    return {
      configured: true,
      ok: true,
      cityId,
      selection: {
        id: selection.id,
        title: selection.title,
        selectionKind: selection.selection_kind,
        queryHash: selection.query_hash,
        resultCount: Number(selection.result_count ?? 0),
        returnedCount: Number(selection.returned_count ?? 0),
        snapshotAt,
        geometrySnapshotCount,
        geometrySnapshotComplete,
      },
      geojson: { type: 'FeatureCollection', features },
      summary: {
        ...featureSummary(features),
        resultCount: Number(selection.result_count ?? features.length),
        returned: features.length,
        truncated: Boolean(selection.truncated) || features.length < Number(selection.result_count ?? features.length),
        snapshotAt,
        geometrySnapshotCount,
        geometrySnapshotComplete,
        authorityStatus: 'selection-snapshot',
        worldKind: 'selection-snapshot',
      },
      error: null,
    }
  }, { returnMissingDatabaseResult: true })
}
