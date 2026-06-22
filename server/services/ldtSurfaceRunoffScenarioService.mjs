import crypto from 'node:crypto'

import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import { refreshLdtObjectObservationSummary } from './ldtObservationSummaryService.mjs'

const DEFAULT_CITY_IDS = ['kharkiv']
const DEFAULT_SCENARIO_KEY = 'baseline'
const DEFAULT_RAINFALL_MM = 30
const DEFAULT_DURATION_HOURS = 1
const DEFAULT_RUN_LIMIT = 25
const HYDROLOGY_LAYER_KEY = 'hydrology_surface_water_signal'
const RUNOFF_LAYER_KEY = 'surface_runoff_screening'
const MODEL_KEY = 'surface-runoff-screening-v0'
const SCENARIO_DEFINITION_KEY = 'surface-runoff-screening'

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function finiteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positiveNumber(value, fallback, min, max) {
  const number = finiteNumber(value, fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function slugNumber(value) {
  return String(Number(value).toFixed(2)).replace(/\.?0+$/, '').replaceAll('.', 'p')
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

async function listCityIds(client, requestedCityIds) {
  const normalized = requestedCityIds.map((cityId) => compactText(cityId)).filter(Boolean)
  if (normalized.length > 0) return normalized
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function ensureSurfaceRunoffLayer(client) {
  const result = await client.query(
    `
      INSERT INTO ldt_environment.phenomenon_layers (
        layer_key,
        display_name,
        phenomenon_family,
        value_unit,
        value_kind,
        spatial_model,
        source_status,
        authority_status,
        description,
        standards_mapping,
        metadata,
        enabled,
        updated_at
      ) VALUES (
        $1,
        'Surface runoff screening',
        'hydrology',
        'score_0_100',
        'scenario_derived_indicator',
        'sampled_grid_and_object',
        'source-backed-open-data',
        'open-hydrology-scenario-screening',
        'Scenario-derived surface-runoff screening score from DEM, slope, mapped water evidence, and rainfall assumptions. This is not a calibrated hydraulic or drainage model.',
        '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty","prov":"PROV-O"}'::jsonb,
        jsonb_build_object(
          'phase', 'phase-14-scenario-runner-first-cut',
          'scenarioRunner', 'surface-runoff-screening',
          'sourceInputs', jsonb_build_array('hydrology_surface_water_signal', 'terrain_elevation_m', 'terrain_slope_deg', 'rainfall scenario parameters'),
          'simulationPosture', 'screening-scenario-not-certified-hydraulic-simulation',
          'reproducibleForNewCities', true,
          'cityPortable', true
        ),
        true,
        now()
      )
      ON CONFLICT (layer_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        phenomenon_family = EXCLUDED.phenomenon_family,
        value_unit = EXCLUDED.value_unit,
        value_kind = EXCLUDED.value_kind,
        spatial_model = EXCLUDED.spatial_model,
        source_status = EXCLUDED.source_status,
        authority_status = EXCLUDED.authority_status,
        description = EXCLUDED.description,
        standards_mapping = ldt_environment.phenomenon_layers.standards_mapping || EXCLUDED.standards_mapping,
        metadata = ldt_environment.phenomenon_layers.metadata || EXCLUDED.metadata,
        enabled = true,
        updated_at = now()
      RETURNING id
    `,
    [RUNOFF_LAYER_KEY],
  )
  return result.rows[0].id
}

async function ensureScienceContracts(client) {
  const model = await client.query(
    `
      INSERT INTO ldt_science.simulation_models (
        model_key,
        name,
        model_family,
        version,
        definition
      ) VALUES (
        $1,
        'Surface Runoff Screening',
        'hydrology_screening_model',
        '0.1.0',
        $2::jsonb
      )
      ON CONFLICT (model_key) DO UPDATE SET
        name = EXCLUDED.name,
        model_family = EXCLUDED.model_family,
        version = EXCLUDED.version,
        definition = EXCLUDED.definition
      RETURNING id
    `,
    [
      MODEL_KEY,
      JSON.stringify({
        purpose: 'Generate a reproducible first-pass surface-runoff screening layer from open DEM/hydrology evidence and rainfall assumptions.',
        inputs: [HYDROLOGY_LAYER_KEY, 'terrain_elevation_m', 'terrain_slope_deg', 'rainfall_mm', 'duration_hours'],
        outputs: [RUNOFF_LAYER_KEY, 'object exposure observations', 'scenario summary'],
        limitations: [
          'Not a hydraulic model.',
          'Does not model drainage network capacity.',
          'Does not calculate certified flood depth or velocity.',
          'Requires official drainage, rainfall return periods, soil/infiltration, and calibration data before operational flood decisions.',
        ],
      }),
    ],
  )

  const scenario = await client.query(
    `
      INSERT INTO ldt_science.scenario_definitions (
        scenario_key,
        name,
        scenario_family,
        description,
        required_inputs,
        expected_outputs,
        metadata
      ) VALUES (
        $1,
        'Surface Runoff Screening',
        'hydrology',
        'First reproducible open-data scenario for likely surface-water accumulation and runoff stress under a rainfall assumption.',
        $2::jsonb,
        $3::jsonb,
        $4::jsonb
      )
      ON CONFLICT (scenario_key) DO UPDATE SET
        name = EXCLUDED.name,
        scenario_family = EXCLUDED.scenario_family,
        description = EXCLUDED.description,
        required_inputs = EXCLUDED.required_inputs,
        expected_outputs = EXCLUDED.expected_outputs,
        metadata = ldt_science.scenario_definitions.metadata || EXCLUDED.metadata
      RETURNING id
    `,
    [
      SCENARIO_DEFINITION_KEY,
      JSON.stringify(['source-backed DEM terrain cells', 'source-backed hydrology signal cells', 'rainfall amount and duration']),
      JSON.stringify(['surface runoff screening grid', 'object exposure observations', 'scenario run summary']),
      JSON.stringify({
        status: 'first-operational-open-data-scenario',
        simulationPosture: 'screening-scenario-not-certified-hydraulic-simulation',
        phase: 'phase-14-scenario-runner-first-cut',
      }),
    ],
  )

  return {
    modelId: model.rows[0].id,
    scenarioDefinitionId: scenario.rows[0].id,
  }
}

async function latestHydrologySourceGridKey(client, cityId, scenarioKey, requestedSourceGridKey) {
  const stableSourceGridKey = compactText(requestedSourceGridKey)
  if (stableSourceGridKey) return stableSourceGridKey
  const result = await client.query(
    `
      SELECT cells.source_grid_key, count(*)::int AS cell_count
      FROM ldt_environment.phenomenon_cells cells
      JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
      WHERE cells.city_id = $1
        AND cells.scenario_key = $2
        AND layers.layer_key = $3
      GROUP BY cells.source_grid_key
      ORDER BY count(*) DESC, cells.source_grid_key DESC
      LIMIT 1
    `,
    [cityId, scenarioKey, HYDROLOGY_LAYER_KEY],
  )
  if (result.rowCount === 0) throw new Error(`SURFACE_RUNOFF_HYDROLOGY_SOURCE_MISSING:${cityId}:${scenarioKey}`)
  return result.rows[0].source_grid_key
}

async function writeSurfaceRunoffCells(client, cityId, {
  scenarioKey,
  sourceGridKey,
  layerId,
  rainfallMm,
  durationHours,
}) {
  await client.query(
    `
      DELETE FROM ldt_environment.object_observations
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = $3
    `,
    [cityId, scenarioKey, layerId],
  )
  await client.query(
    `
      DELETE FROM ldt_environment.phenomenon_cells
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = $3
    `,
    [cityId, scenarioKey, layerId],
  )

  const result = await client.query(
    `
      WITH hydrology AS (
        SELECT
          cells.id AS hydrology_cell_id,
          cells.cell_key,
          cells.source_grid_key,
          cells.geom,
          cells.value AS hydrology_signal,
          cells.metrics,
          NULLIF(cells.metrics->>'lowElevationScore', '')::numeric AS low_elevation_score,
          NULLIF(cells.metrics->>'flatnessScore', '')::numeric AS flatness_score,
          NULLIF(cells.metrics->>'waterProximityScore', '')::numeric AS water_proximity_score,
          NULLIF(cells.metrics->>'elevationM', '')::numeric AS elevation_m,
          NULLIF(cells.metrics->>'slopeDeg', '')::numeric AS slope_deg,
          NULLIF(cells.metrics->>'nearestWaterDistanceM', '')::numeric AS nearest_water_distance_m,
          NULLIF(cells.metrics->>'waterEvidenceCount', '')::numeric AS water_evidence_count
        FROM ldt_environment.phenomenon_cells cells
        JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
        WHERE cells.city_id = $1
          AND cells.scenario_key = $2
          AND layers.layer_key = $4
          AND cells.source_grid_key = $5
      ),
      scored AS (
        SELECT
          *,
          LEAST(100, GREATEST(0, ($6::numeric / 50.0) * 100.0)) AS rainfall_stress_score,
          LEAST(100, GREATEST(0, (($6::numeric / GREATEST(0.25, $7::numeric)) / 40.0) * 100.0)) AS rainfall_intensity_score
        FROM hydrology
      ),
      runoff AS (
        SELECT
          *,
          round(LEAST(100, GREATEST(0,
            COALESCE(hydrology_signal, 0) * 0.58
            + COALESCE(low_elevation_score, 0) * 0.14
            + COALESCE(flatness_score, 0) * 0.12
            + rainfall_stress_score * 0.10
            + rainfall_intensity_score * 0.06
          ))::numeric, 1) AS runoff_value
        FROM scored
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
        $3,
        cell_key,
        'surface-runoff-' || source_grid_key || '-' || $8,
        hydrology_cell_id::text,
        $2,
        now(),
        runoff_value,
        'source-backed-open-data-scenario',
        geom,
        jsonb_build_object(
          'surfaceRunoffScreening', runoff_value,
          'hydrologySurfaceWaterSignal', hydrology_signal,
          'lowElevationScore', low_elevation_score,
          'flatnessScore', flatness_score,
          'waterProximityScore', water_proximity_score,
          'rainfallMm', $6::numeric,
          'durationHours', $7::numeric,
          'rainfallIntensityMmH', round(($6::numeric / GREATEST(0.25, $7::numeric))::numeric, 2),
          'rainfallStressScore', rainfall_stress_score,
          'rainfallIntensityScore', rainfall_intensity_score,
          'elevationM', elevation_m,
          'slopeDeg', slope_deg,
          'nearestWaterDistanceM', nearest_water_distance_m,
          'waterEvidenceCount', water_evidence_count,
          'sourceHydrologyGridKey', source_grid_key
        ),
        jsonb_build_object(
          'source', 'Scenario transform over source-backed hydrology grid',
          'sourceLayerKey', $4,
          'sourceHydrologyGridKey', source_grid_key,
          'scenarioRunner', 'surface-runoff-screening-v0',
          'scenarioDefinitionKey', $9::text,
          'method', 'Weighted source-backed hydrology signal plus rainfall stress and terrain flatness. Not a calibrated hydraulic model.',
          'simulationPosture', 'screening-scenario-not-certified-hydraulic-simulation',
          'authorityStatus', 'open-hydrology-scenario-screening',
          'reproducible', true,
          'cityPortable', true
        ),
        now()
      FROM runoff
      RETURNING id
    `,
    [
      cityId,
      scenarioKey,
      layerId,
      HYDROLOGY_LAYER_KEY,
      sourceGridKey,
      rainfallMm,
      durationHours,
      `${slugNumber(rainfallMm)}mm-${slugNumber(durationHours)}h`,
      SCENARIO_DEFINITION_KEY,
    ],
  )
  return result.rowCount
}

async function attachRunoffObservations(client, cityId, {
  scenarioKey,
  layerId,
}) {
  await client.query('DROP TABLE IF EXISTS tmp_runoff_entity_points')
  await client.query(
    `
      CREATE TEMP TABLE tmp_runoff_entity_points ON COMMIT DROP AS
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
  await client.query('CREATE INDEX tmp_runoff_entity_points_gix ON tmp_runoff_entity_points USING gist (point_geom)')
  await client.query('CREATE INDEX tmp_runoff_entity_points_entity_idx ON tmp_runoff_entity_points (entity_id)')
  await client.query('ANALYZE tmp_runoff_entity_points')

  await client.query('DROP TABLE IF EXISTS tmp_runoff_cells')
  await client.query(
    `
      CREATE TEMP TABLE tmp_runoff_cells ON COMMIT DROP AS
      SELECT
        id AS cell_id,
        value,
        confidence,
        metrics,
        provenance,
        geom
      FROM ldt_environment.phenomenon_cells
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = $3
    `,
    [cityId, scenarioKey, layerId],
  )
  await client.query('CREATE INDEX tmp_runoff_cells_gix ON tmp_runoff_cells USING gist (geom)')
  await client.query('ANALYZE tmp_runoff_cells')

  const result = await client.query(
    `
      WITH attached AS (
        SELECT DISTINCT ON (points.entity_id)
          points.entity_id,
          cells.cell_id,
          cells.value,
          cells.confidence,
          COALESCE(cells.provenance->>'method', 'Spatially attached from source-backed runoff scenario grid.') AS method,
          jsonb_build_object(
            'sourceCellId', cells.cell_id,
            'sourceHydrologyGridKey', cells.metrics->>'sourceHydrologyGridKey',
            'attachmentMethod', 'point-on-surface-within-runoff-cell',
            'authorityStatus', cells.provenance->>'authorityStatus',
            'simulationPosture', cells.provenance->>'simulationPosture',
            'rainfallMm', cells.metrics->>'rainfallMm',
            'durationHours', cells.metrics->>'durationHours',
            'rainfallIntensityMmH', cells.metrics->>'rainfallIntensityMmH',
            'hydrologySurfaceWaterSignal', cells.metrics->>'hydrologySurfaceWaterSignal'
          ) AS properties
        FROM tmp_runoff_entity_points points
        JOIN tmp_runoff_cells cells ON cells.geom && points.point_geom
          AND ST_Covers(cells.geom, points.point_geom)
        ORDER BY points.entity_id, cells.value DESC
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
        $3,
        cell_id,
        $2,
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
    [cityId, scenarioKey, layerId],
  )
  return result.rowCount
}

async function surfaceRunoffStats(client, cityId, {
  scenarioKey,
  layerId,
}) {
  const result = await client.query(
    `
      SELECT
        count(*)::int AS cell_count,
        round(min(value)::numeric, 2) AS min_value,
        round(avg(value)::numeric, 2) AS avg_value,
        round(max(value)::numeric, 2) AS max_value,
        count(*) FILTER (WHERE value >= 70)::int AS high_cells,
        count(*) FILTER (WHERE value >= 40 AND value < 70)::int AS medium_cells,
        count(*) FILTER (WHERE value < 40)::int AS low_cells
      FROM ldt_environment.phenomenon_cells
      WHERE city_id = $1
        AND scenario_key = $2
        AND layer_id = $3
    `,
    [cityId, scenarioKey, layerId],
  )
  return result.rows[0] || {}
}

async function objectExposureStats(client, cityId, {
  scenarioKey,
  layerId,
}) {
  const result = await client.query(
    `
      SELECT
        count(*)::int AS object_count,
        count(*) FILTER (WHERE observations.value >= 70)::int AS high_objects,
        count(*) FILTER (WHERE observations.value >= 40 AND observations.value < 70)::int AS medium_objects,
        count(*) FILTER (WHERE observations.value < 40)::int AS low_objects,
        count(*) FILTER (WHERE entities.entity_type = 'building' AND observations.value >= 70)::int AS high_buildings,
        count(*) FILTER (WHERE entities.entity_type = 'road' AND observations.value >= 70)::int AS high_roads
      FROM ldt_environment.object_observations observations
      JOIN ldt_core.city_entities entities ON entities.id = observations.entity_id
      WHERE observations.city_id = $1
        AND observations.scenario_key = $2
        AND observations.layer_id = $3
    `,
    [cityId, scenarioKey, layerId],
  )
  return result.rows[0] || {}
}

async function recordScienceRun(client, cityId, {
  scenarioKey,
  scenarioDefinitionId,
  modelId,
  sourceGridKey,
  rainfallMm,
  durationHours,
  cellsWritten,
  objectObservations,
  objectSummaries,
  cellStats,
  objectStats,
}) {
  const rainfallIntensityMmH = rainfallMm / Math.max(0.25, durationHours)
  const runKey = `${MODEL_KEY}:${cityId}:${scenarioKey}:${slugNumber(rainfallMm)}mm-${slugNumber(durationHours)}h:${sha256(sourceGridKey).slice(0, 12)}`
  const inputs = {
    scenarioDefinitionKey: SCENARIO_DEFINITION_KEY,
    scenarioKey,
    sourceLayerKey: HYDROLOGY_LAYER_KEY,
    sourceGridKey,
    rainfallMm,
    durationHours,
    rainfallIntensityMmH: Number(rainfallIntensityMmH.toFixed(2)),
    modelPosture: 'open-data screening scenario',
  }
  const outputs = {
    layerKey: RUNOFF_LAYER_KEY,
    cellsWritten,
    objectObservations,
    objectSummaries,
    cellStats,
    objectStats,
    writes: [
      'ldt_environment.phenomenon_cells',
      'ldt_environment.object_observations',
      'ldt_environment.object_observation_summary',
      'ldt_science.simulation_runs',
      'ldt_science.scenario_inputs',
      'ldt_science.scenario_outputs',
    ],
  }
  const uncertainty = {
    status: 'qualitative-open-data-screening',
    notFor: ['certified flood depth', 'drainage capacity design', 'emergency evacuation order'],
    missingInputs: ['official drainage network', 'rainfall return-period series', 'soil/infiltration', 'surface roughness', 'calibration observations'],
  }

  await client.query(
    `
      INSERT INTO ldt_science.scenario_inputs (
        scenario_definition_id,
        city_id,
        input_key,
        value,
        source
      ) VALUES (
        $1,
        $2,
        'surface-runoff-open-data-inputs',
        $3::jsonb,
        'open-data-and-scenario-parameter'
      )
      ON CONFLICT (scenario_definition_id, city_id, input_key) DO UPDATE SET
        value = EXCLUDED.value,
        source = EXCLUDED.source
    `,
    [scenarioDefinitionId, cityId, JSON.stringify(inputs)],
  )

  await client.query(
    `
      INSERT INTO ldt_science.scenario_outputs (
        scenario_definition_id,
        city_id,
        output_key,
        value,
        quality
      ) VALUES (
        $1,
        $2,
        'surface-runoff-screening-output',
        $3::jsonb,
        'source-backed-screening'
      )
      ON CONFLICT (scenario_definition_id, city_id, output_key) DO UPDATE SET
        value = EXCLUDED.value,
        quality = EXCLUDED.quality
    `,
    [scenarioDefinitionId, cityId, JSON.stringify(outputs)],
  )

  const run = await client.query(
    `
      INSERT INTO ldt_science.simulation_runs (
        city_id,
        model_id,
        run_key,
        scenario_key,
        status,
        inputs,
        outputs,
        uncertainty,
        started_at,
        finished_at
      )
      VALUES ($1, $2, $3, $4, 'completed', $5::jsonb, $6::jsonb, $7::jsonb, now(), now())
      ON CONFLICT (run_key) DO UPDATE SET
        status = EXCLUDED.status,
        inputs = EXCLUDED.inputs,
        outputs = EXCLUDED.outputs,
        uncertainty = EXCLUDED.uncertainty,
        finished_at = now()
      RETURNING id, run_key
    `,
    [
      cityId,
      modelId,
      runKey,
      scenarioKey,
      JSON.stringify(inputs),
      JSON.stringify(outputs),
      JSON.stringify(uncertainty),
    ],
  )

  return {
    runId: run.rows[0].id,
    runKey: run.rows[0].run_key,
    inputs,
    outputs,
    uncertainty,
  }
}

async function runSurfaceRunoffForCity(client, cityId, options) {
  const scenarioKey = compactText(options.scenarioKey, DEFAULT_SCENARIO_KEY)
  const rainfallMm = positiveNumber(options.rainfallMm, DEFAULT_RAINFALL_MM, 0.1, 1000)
  const durationHours = positiveNumber(options.durationHours, DEFAULT_DURATION_HOURS, 0.25, 240)
  const sourceGridKey = await latestHydrologySourceGridKey(client, cityId, scenarioKey, options.sourceGridKey)
  const layerId = await ensureSurfaceRunoffLayer(client)
  const { modelId, scenarioDefinitionId } = await ensureScienceContracts(client)
  const cellsWritten = await writeSurfaceRunoffCells(client, cityId, {
    scenarioKey,
    sourceGridKey,
    layerId,
    rainfallMm,
    durationHours,
  })
  const objectObservations = await attachRunoffObservations(client, cityId, { scenarioKey, layerId })
  const objectSummaries = await refreshLdtObjectObservationSummary(client, cityId, { scenarioKey })
  const cellStats = await surfaceRunoffStats(client, cityId, { scenarioKey, layerId })
  const objectStats = await objectExposureStats(client, cityId, { scenarioKey, layerId })
  const scienceRun = await recordScienceRun(client, cityId, {
    scenarioKey,
    scenarioDefinitionId,
    modelId,
    sourceGridKey,
    rainfallMm,
    durationHours,
    cellsWritten,
    objectObservations,
    objectSummaries,
    cellStats,
    objectStats,
  })

  return {
    cityId,
    scenarioKey,
    sourceGridKey,
    layerKey: RUNOFF_LAYER_KEY,
    rainfallMm,
    durationHours,
    rainfallIntensityMmH: Number((rainfallMm / Math.max(0.25, durationHours)).toFixed(2)),
    cellsWritten,
    objectObservations,
    objectSummaries,
    cellStats,
    objectStats,
    runKey: scienceRun.runKey,
  }
}

export async function runSurfaceRunoffScenario({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  sourceGridKey,
  rainfallMm = DEFAULT_RAINFALL_MM,
  durationHours = DEFAULT_DURATION_HOURS,
} = {}) {
  return await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
      await client.query("SET LOCAL work_mem = '48MB'")
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await runSurfaceRunoffForCity(client, cityId, {
          scenarioKey,
          sourceGridKey,
          rainfallMm,
          durationHours,
        }))
      }
      await client.query('COMMIT')
      return {
        ok: true,
        scenarioRunner: 'surface-runoff-screening',
        modelKey: MODEL_KEY,
        scenarioDefinitionKey: SCENARIO_DEFINITION_KEY,
        layerKey: RUNOFF_LAYER_KEY,
        scenarioKey,
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function getSurfaceRunoffScenarioStatus(cityId, {
  scenarioKey = DEFAULT_SCENARIO_KEY,
  limit = DEFAULT_RUN_LIMIT,
} = {}) {
  const rowLimit = integerValue(limit, DEFAULT_RUN_LIMIT, 1, 100)
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          runs.id,
          runs.run_key,
          runs.scenario_key,
          runs.status,
          runs.inputs,
          runs.outputs,
          runs.uncertainty,
          runs.started_at,
          runs.finished_at,
          models.model_key,
          models.name AS model_name
        FROM ldt_science.simulation_runs runs
        JOIN ldt_science.simulation_models models ON models.id = runs.model_id
        WHERE runs.city_id = $1
          AND runs.scenario_key = $2
          AND models.model_key = $3
        ORDER BY runs.finished_at DESC NULLS LAST, runs.started_at DESC NULLS LAST
        LIMIT $4
      `,
      [cityId, scenarioKey, MODEL_KEY, rowLimit],
    )
    return {
      ok: true,
      cityId,
      scenarioKey,
      runs: result.rows,
    }
  })
}

export async function closeLdtSurfaceRunoffScenarioPool() {
  await closeSharedProductionPool()
}
