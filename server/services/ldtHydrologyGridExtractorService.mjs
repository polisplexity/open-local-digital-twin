import crypto from 'node:crypto'

import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import { refreshLdtObjectObservationSummary } from './ldtObservationSummaryService.mjs'

const DEFAULT_CITY_IDS = ['kharkiv']
const DEFAULT_SCENARIO_KEY = 'baseline'
const DEFAULT_RUN_LIMIT = 25
const HYDROLOGY_LAYER_KEY = 'hydrology_surface_water_signal'
const WATER_SOURCE_CATEGORIES = [
  'water',
  'river',
  'stream',
  'canal',
  'drain',
  'ditch',
  'reservoir',
  'basin',
  'wetland',
]

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
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

async function latestTerrainSourceGridKey(client, cityId, scenarioKey, requestedSourceGridKey) {
  const stableSourceGridKey = compactText(requestedSourceGridKey)
  if (stableSourceGridKey) return stableSourceGridKey
  const result = await client.query(
    `
      SELECT cells.source_grid_key, count(*)::int AS cell_count
      FROM ldt_environment.phenomenon_cells cells
      JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
      WHERE cells.city_id = $1
        AND cells.scenario_key = $2
        AND layers.layer_key IN ('terrain_elevation_m', 'terrain_slope_deg')
      GROUP BY cells.source_grid_key
      ORDER BY count(*) DESC, cells.source_grid_key DESC
      LIMIT 1
    `,
    [cityId, scenarioKey],
  )
  if (result.rowCount === 0) throw new Error(`HYDROLOGY_TERRAIN_SOURCE_MISSING:${cityId}:${scenarioKey}`)
  return result.rows[0].source_grid_key
}

async function ensureHydrologyLayer(client) {
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
        'Surface water signal',
        'hydrology',
        'score_0_100',
        'source_derived_indicator',
        'sampled_grid_and_object',
        'source-backed-open-data',
        'open-hydrology-derived',
        'Query-scoped surface-water susceptibility signal derived from open DEM, slope, and open mapped water evidence. This is not a rainfall, drainage, or flood simulation.',
        '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty","prov":"PROV-O"}'::jsonb,
        jsonb_build_object(
          'phase', 'phase-13-city-3d-hardening',
          'extractor', 'hydrology-grid',
          'sourceAdapter', 'dem-osm-hydrology-grid',
          'sourceInputs', jsonb_build_array('terrain_elevation_m', 'terrain_slope_deg', 'OSM/open green-blue water entities'),
          'simulationPosture', 'screening-signal-not-hydraulic-simulation',
          'reproducibleForNewCities', true
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
    [HYDROLOGY_LAYER_KEY],
  )
  return result.rows[0].id
}

async function ensureHydrologyRun(client, cityId, {
  scenarioKey,
  sourceGridKey,
  layerId,
  cellsWritten,
  objectObservations,
  waterEvidenceCount,
}) {
  const definition = await client.query(
    `
      SELECT id
      FROM ldt_environment.extractor_definitions
      WHERE extractor_key = 'hydrology-grid'
      LIMIT 1
    `,
  )
  const runVersion = `dem-osm-${sourceGridKey}`
  const runKey = `hydrology-grid:${scenarioKey}:${runVersion}`
  const inputSummary = {
    sourceGridKey,
    terrainInputs: ['terrain_elevation_m', 'terrain_slope_deg'],
    waterEvidenceCategories: WATER_SOURCE_CATEGORIES,
    simulationPosture: 'screening-signal-not-hydraulic-simulation',
  }
  const outputSummary = {
    outputLayerKeys: [HYDROLOGY_LAYER_KEY],
    cellsWritten,
    objectObservations,
    waterEvidenceCount,
    writesActualPhenomenonCells: true,
    currentPosture: 'source-backed-open-data',
  }
  const validationReport = {
    status: cellsWritten > 0 ? 'passed' : 'failed',
    checks: [
      {
        key: 'terrain-inputs',
        status: cellsWritten > 0 ? 'passed' : 'failed',
        statement: `${cellsWritten} hydrology grid cells were derived from DEM terrain cells.`,
      },
      {
        key: 'water-evidence',
        status: waterEvidenceCount > 0 ? 'passed' : 'passed-with-gaps',
        statement: `${waterEvidenceCount} mapped open water features were used as proximity evidence.`,
      },
      {
        key: 'simulation-boundary',
        status: 'documented',
        statement: 'This layer is a DEM/open-data hydrology screening signal, not a rainfall-runoff or flood-depth simulation.',
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
        'hydrology-grid',
        $2,
        $3,
        $4,
        'completed',
        'source-backed-open-data',
        'hydrology-grid-extractor',
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
      definition.rows[0]?.id || null,
      cityId,
      runKey,
      scenarioKey,
      JSON.stringify(inputSummary),
      JSON.stringify(outputSummary),
      JSON.stringify(validationReport),
    ],
  )
  const artifactUri = `urn:polisplexity:ldt:${cityId}:environment-extractor:hydrology-grid:derived-cells:${scenarioKey}:${sourceGridKey}`
  await client.query(
    `
      INSERT INTO ldt_environment.extractor_artifacts (
        extractor_run_id,
        city_id,
        layer_id,
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
        'derived-cell-report',
        $4,
        'application/json',
        $5,
        ST_UnaryUnion(ST_Collect(geom)),
        $6::jsonb
      FROM ldt_core.city_boundaries
      WHERE city_id = $2
      ON CONFLICT (extractor_run_id, artifact_kind, artifact_uri) DO UPDATE SET
        layer_id = EXCLUDED.layer_id,
        checksum = EXCLUDED.checksum,
        coverage_geom = EXCLUDED.coverage_geom,
        metadata = EXCLUDED.metadata
    `,
    [
      run.rows[0].id,
      cityId,
      layerId,
      artifactUri,
      sha256(JSON.stringify(outputSummary)),
      JSON.stringify(outputSummary),
    ],
  )
  return { runKey }
}

async function writeHydrologyCells(client, cityId, {
  scenarioKey,
  sourceGridKey,
  layerId,
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
      WITH elevation AS (
        SELECT cells.cell_key, cells.source_grid_key, cells.geom, cells.value AS elevation_m, cells.metrics
        FROM ldt_environment.phenomenon_cells cells
        JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
        WHERE cells.city_id = $1
          AND cells.scenario_key = $2
          AND cells.source_grid_key = $4
          AND layers.layer_key = 'terrain_elevation_m'
      ),
      slope AS (
        SELECT cells.cell_key, cells.value AS slope_deg
        FROM ldt_environment.phenomenon_cells cells
        JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
        WHERE cells.city_id = $1
          AND cells.scenario_key = $2
          AND cells.source_grid_key = $4
          AND layers.layer_key = 'terrain_slope_deg'
      ),
      terrain AS (
        SELECT
          elevation.cell_key,
          elevation.source_grid_key,
          elevation.geom,
          elevation.elevation_m,
          COALESCE(slope.slope_deg, 0) AS slope_deg,
          elevation.metrics
        FROM elevation
        LEFT JOIN slope ON slope.cell_key = elevation.cell_key
      ),
      stats AS (
        SELECT
          min(elevation_m) AS min_elevation_m,
          max(elevation_m) AS max_elevation_m
        FROM terrain
      ),
      water_evidence AS (
        SELECT
          count(*)::int AS feature_count,
          ST_UnaryUnion(ST_Collect(ST_MakeValid(geom))) AS geom
        FROM ldt_core.city_entities
        WHERE city_id = $1
          AND entity_type = 'green_blue_system'
          AND geom IS NOT NULL
          AND lifecycle_status = 'active'
          AND lower(COALESCE(
            properties#>>'{sourceProperties,category}',
            properties#>>'{sourceProperties,natural}',
            properties#>>'{sourceProperties,waterway}',
            properties#>>'{sourceProperties,water}',
            label,
            ''
          )) = ANY($5::text[])
      ),
      scored AS (
        SELECT
          terrain.cell_key,
          terrain.source_grid_key,
          terrain.geom,
          terrain.elevation_m,
          terrain.slope_deg,
          stats.min_elevation_m,
          stats.max_elevation_m,
          COALESCE(water_evidence.feature_count, 0) AS water_evidence_count,
          CASE
            WHEN water_evidence.geom IS NULL OR ST_IsEmpty(water_evidence.geom) THEN NULL
            ELSE ST_Distance(ST_PointOnSurface(terrain.geom)::geography, water_evidence.geom::geography)
          END AS nearest_water_distance_m
        FROM terrain
        CROSS JOIN stats
        LEFT JOIN water_evidence ON true
      ),
      values_by_cell AS (
        SELECT
          cell_key,
          source_grid_key,
          geom,
          elevation_m,
          slope_deg,
          water_evidence_count,
          nearest_water_distance_m,
          LEAST(100, GREATEST(0,
            100 * (max_elevation_m - elevation_m) / GREATEST(1, max_elevation_m - min_elevation_m)
          )) AS low_elevation_score,
          LEAST(100, GREATEST(0, 100 - slope_deg * 12)) AS flatness_score,
          CASE
            WHEN nearest_water_distance_m IS NULL THEN NULL
            WHEN nearest_water_distance_m <= 25 THEN 100
            WHEN nearest_water_distance_m >= 2500 THEN 0
            ELSE 100 - (nearest_water_distance_m / 2500 * 100)
          END AS water_proximity_score
        FROM scored
      ),
      hydrology AS (
        SELECT
          *,
          round(LEAST(100, GREATEST(0,
            CASE
              WHEN water_proximity_score IS NULL
                THEN low_elevation_score * 0.58 + flatness_score * 0.42
              ELSE water_proximity_score * 0.45 + low_elevation_score * 0.35 + flatness_score * 0.20
            END
          ))::numeric, 1) AS hydrology_value
        FROM values_by_cell
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
        'hydrology-dem-osm-' || source_grid_key,
        cell_key,
        $2,
        now(),
        hydrology_value,
        'source-backed-open-data',
        geom,
        jsonb_build_object(
          'hydrologySurfaceWaterSignal', hydrology_value,
          'elevationM', elevation_m,
          'slopeDeg', slope_deg,
          'nearestWaterDistanceM', nearest_water_distance_m,
          'lowElevationScore', low_elevation_score,
          'flatnessScore', flatness_score,
          'waterProximityScore', water_proximity_score,
          'waterEvidenceCount', water_evidence_count,
          'sourceTerrainGridKey', source_grid_key
        ),
        jsonb_build_object(
          'source', 'DEM terrain cells plus OSM/open mapped water evidence',
          'sourceTerrainGridKey', source_grid_key,
          'method', 'Weighted low-elevation, flatness, and mapped-water proximity screening signal.',
          'simulationPosture', 'screening-signal-not-hydraulic-simulation',
          'authorityStatus', 'open-hydrology-derived',
          'reproducible', true,
          'cityPortable', true
        ),
        now()
      FROM hydrology
      RETURNING id
    `,
    [cityId, scenarioKey, layerId, sourceGridKey, WATER_SOURCE_CATEGORIES],
  )
  return result.rowCount
}

async function attachHydrologyObservations(client, cityId, {
  scenarioKey,
  layerId,
}) {
  await client.query('DROP TABLE IF EXISTS tmp_hydrology_entity_points')
  await client.query(
    `
      CREATE TEMP TABLE tmp_hydrology_entity_points ON COMMIT DROP AS
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
  await client.query('CREATE INDEX tmp_hydrology_entity_points_gix ON tmp_hydrology_entity_points USING gist (point_geom)')
  await client.query('CREATE INDEX tmp_hydrology_entity_points_entity_idx ON tmp_hydrology_entity_points (entity_id)')
  await client.query('ANALYZE tmp_hydrology_entity_points')
  await client.query('DROP TABLE IF EXISTS tmp_hydrology_cells')
  await client.query(
    `
      CREATE TEMP TABLE tmp_hydrology_cells ON COMMIT DROP AS
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
  await client.query('CREATE INDEX tmp_hydrology_cells_gix ON tmp_hydrology_cells USING gist (geom)')
  await client.query('ANALYZE tmp_hydrology_cells')
  const result = await client.query(
    `
      WITH attached AS (
        SELECT DISTINCT ON (points.entity_id)
          points.entity_id,
          cells.cell_id,
          cells.value,
          cells.confidence,
          COALESCE(cells.provenance->>'method', 'Spatially attached from source-backed hydrology grid.') AS method,
          jsonb_build_object(
            'sourceCellId', cells.cell_id,
            'sourceGridKey', cells.metrics->>'sourceTerrainGridKey',
            'attachmentMethod', 'point-on-surface-within-hydrology-cell',
            'authorityStatus', cells.provenance->>'authorityStatus',
            'simulationPosture', cells.provenance->>'simulationPosture',
            'nearestWaterDistanceM', cells.metrics->>'nearestWaterDistanceM'
          ) AS properties
        FROM tmp_hydrology_entity_points points
        JOIN tmp_hydrology_cells cells ON cells.geom && points.point_geom
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

async function waterEvidenceCount(client, cityId) {
  const result = await client.query(
    `
      SELECT count(*)::int AS count
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND entity_type = 'green_blue_system'
        AND lifecycle_status = 'active'
        AND lower(COALESCE(
          properties#>>'{sourceProperties,category}',
          properties#>>'{sourceProperties,natural}',
          properties#>>'{sourceProperties,waterway}',
          properties#>>'{sourceProperties,water}',
          label,
          ''
        )) = ANY($2::text[])
    `,
    [cityId, WATER_SOURCE_CATEGORIES],
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function runHydrologyForCity(client, cityId, options) {
  const scenarioKey = compactText(options.scenarioKey, DEFAULT_SCENARIO_KEY)
  const sourceGridKey = await latestTerrainSourceGridKey(client, cityId, scenarioKey, options.sourceGridKey)
  const layerId = await ensureHydrologyLayer(client)
  const cellsWritten = await writeHydrologyCells(client, cityId, { scenarioKey, sourceGridKey, layerId })
  const objectObservations = await attachHydrologyObservations(client, cityId, { scenarioKey, layerId })
  const objectSummaries = await refreshLdtObjectObservationSummary(client, cityId, { scenarioKey })
  const evidenceCount = await waterEvidenceCount(client, cityId)
  const run = await ensureHydrologyRun(client, cityId, {
    scenarioKey,
    sourceGridKey,
    layerId,
    cellsWritten,
    objectObservations,
    waterEvidenceCount: evidenceCount,
  })
  return {
    cityId,
    scenarioKey,
    sourceGridKey,
    layerKey: HYDROLOGY_LAYER_KEY,
    runKey: run.runKey,
    cellsWritten,
    objectObservations,
    objectSummaries,
    waterEvidenceCount: evidenceCount,
  }
}

export async function runHydrologyGridExtractor({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  sourceGridKey,
} = {}) {
  return await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
      await client.query("SET LOCAL work_mem = '48MB'")
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await runHydrologyForCity(client, cityId, { scenarioKey, sourceGridKey }))
      }
      await client.query('COMMIT')
      return {
        ok: true,
        extractorKey: 'hydrology-grid',
        layerKey: HYDROLOGY_LAYER_KEY,
        scenarioKey,
        sourceGridKey: compactText(sourceGridKey) || null,
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function getHydrologyGridExtractorStatus(cityId, {
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
          AND scenario_key = $2
          AND extractor_key = 'hydrology-grid'
        ORDER BY updated_at DESC, created_at DESC
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

export async function closeLdtHydrologyGridExtractorPool() {
  await closeSharedProductionPool()
}
