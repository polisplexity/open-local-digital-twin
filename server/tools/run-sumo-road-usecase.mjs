import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

const DEFAULT_DATABASE_URL = 'postgresql://twin_base_studio:twin_base_studio_dev@127.0.0.1:45433/twin_base_studio'
const DEFAULT_MODEL_ENDPOINT = 'http://127.0.0.1:18090/v2/models/urban-flow/infer'
const DEFAULT_NGSI_ENDPOINT = 'http://127.0.0.1:9090/ngsi-ld/v1/entities?type=SumoEdgeData'
const DEFAULT_ARTIFACT_DIR = 'C:/Users/usuario/Documents/Codex/eu-ldt-ai-model-tests/urban_mobility/oldt_sumo_road_usecase'

const OUTPUT_FIELDS = [
  ['sumo.speed', 'speed'],
  ['sumo.density', 'density'],
  ['sumo.occupancy', 'occupancy'],
  ['sumo.flow', 'flow'],
  ['sumo.waiting_time', 'waitingTime'],
  ['sumo.time_loss', 'timeLoss'],
  ['sumo.traveltime', 'traveltime'],
]

function option(name, fallback = '') {
  const prefix = `--${name}=`
  const raw = process.argv.find((entry) => entry.startsWith(prefix))
  return raw ? raw.slice(prefix.length) : fallback
}

function jsonValue(attribute) {
  if (attribute && typeof attribute === 'object' && 'value' in attribute) return attribute.value
  return attribute
}

function numberValue(attribute) {
  const value = jsonValue(attribute)
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function addSeconds(isoLike, seconds) {
  const date = new Date(isoLike.endsWith('Z') ? isoLike : `${isoLike}Z`)
  date.setUTCSeconds(date.getUTCSeconds() + seconds)
  return date.toISOString()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}_${url}_${JSON.stringify(body).slice(0, 500)}`)
  }
  return body
}

async function loadRoadAnchors(client) {
  const result = await client.query(`
    SELECT
      ce.id,
      ce.stable_id,
      ce.label,
      re.road_class,
      round((ST_Distance(
        ce.geom::geography,
        ST_SetSRID(ST_MakePoint(-101.259, 21.02), 4326)::geography
      ))::numeric, 1) AS meters,
      ST_AsGeoJSON(ce.geom)::json AS geom
    FROM ldt_core.city_entities ce
    LEFT JOIN ldt_core.road_entities re ON re.entity_id = ce.id
    WHERE ce.city_id = 'guanajuato'
      AND ce.entity_type = 'road'
      AND ce.geom IS NOT NULL
    ORDER BY ce.geom <-> ST_SetSRID(ST_MakePoint(-101.259, 21.02), 4326)
    LIMIT 4
  `)

  return result.rows.map((road, index) => ({
    sumoEdgeId: `e${index}`,
    entityId: road.id,
    stableId: road.stable_id,
    label: road.label,
    roadClass: road.road_class,
    distanceMetersFromSyntheticNetworkAnchor: Number(road.meters),
    geometry: road.geom,
  }))
}

function buildRequest({ runId, simulationDatetime }) {
  return {
    id: runId,
    parameters: {
      name: 'urban-smoke-ngsi',
      simulation_datetime: simulationDatetime,
      use_ngsi_downloader: true,
      ngsi_domain: 'urban-smoke-ngsi',
      use_dpl_downloader: true,
      dpl_domain: 'urban-smoke-dpl',
      dpl_schema: 'ldt_data',
      flow_interval_minutes: 15,
      upload_entities: true,
      cleanup: false,
    },
  }
}

async function insertOutput(client, row) {
  await client.query(
    `
      INSERT INTO ldt_enrichment.entity_model_outputs (
        city_id,
        entity_id,
        workflow_run_id,
        simulation_run_id,
        source_artifact_id,
        model_key,
        model_version,
        output_key,
        status,
        value_numeric,
        value_text,
        value_json,
        unit,
        confidence,
        authority_status,
        method,
        input_sources,
        uncertainty,
        warnings,
        generated_at,
        valid_from,
        valid_to
      )
      VALUES (
        $1, $2, NULL, NULL, NULL,
        $3, $4, $5, $6,
        $7, $8, $9::jsonb, $10,
        $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb,
        $17, $18, $19
      )
    `,
    [
      row.cityId,
      row.entityId,
      row.modelKey,
      row.modelVersion,
      row.outputKey,
      row.status,
      row.valueNumeric,
      row.valueText,
      JSON.stringify(row.valueJson),
      row.unit,
      row.confidence,
      row.authorityStatus,
      JSON.stringify(row.method),
      JSON.stringify(row.inputSources),
      JSON.stringify(row.uncertainty),
      JSON.stringify(row.warnings),
      row.generatedAt,
      row.validFrom,
      row.validTo,
    ],
  )
}

async function main() {
  const databaseUrl = option('database-url', process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL)
  const modelEndpoint = option('model-endpoint', DEFAULT_MODEL_ENDPOINT)
  const ngsiEndpoint = option('ngsi-endpoint', DEFAULT_NGSI_ENDPOINT)
  const simulationDatetime = option('simulation-datetime', '2026-07-07T11:00:00')
  const artifactDir = option('artifact-dir', DEFAULT_ARTIFACT_DIR)
  const runStamp = simulationDatetime.replaceAll(':', '').replaceAll('-', '').replace('T', 't')
  const runId = option('run-id', `oldt_sumo_road_usecase_${runStamp}`)
  const modelVersion = option('model-version', `road-usecase-${runStamp}`)
  const modelKey = 'eu-ldt-urban-mobility-sumo'
  const generatedAt = new Date().toISOString()
  const validFrom = new Date(`${simulationDatetime}Z`).toISOString()
  const validTo = addSeconds(simulationDatetime, 1800)

  const pool = new Pool({ connectionString: databaseUrl, allowExitOnIdle: true })
  const client = await pool.connect()

  try {
    await fs.mkdir(artifactDir, { recursive: true })
    const roadAnchors = await loadRoadAnchors(client)
    const requestBody = buildRequest({ runId, simulationDatetime })

    await fs.writeFile(
      path.join(artifactDir, `${runId}_input_package.json`),
      JSON.stringify({ runId, modelKey, modelVersion, simulationDatetime, roadAnchors, requestBody }, null, 2),
    )

    const started = Date.now()
    const modelResponse = await fetchJson(modelEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    const elapsedMs = Date.now() - started

    await fs.writeFile(
      path.join(artifactDir, `${runId}_model_response.json`),
      JSON.stringify(modelResponse, null, 2),
    )

    const ngsiEntities = await fetchJson(ngsiEndpoint, {
      headers: { Accept: 'application/ld+json' },
    })
    const entitiesByEdgeId = new Map(
      (Array.isArray(ngsiEntities) ? ngsiEntities : [])
        .filter((entity) => jsonValue(entity.domain) === 'urban-smoke-ngsi')
        .map((entity) => [String(jsonValue(entity.edgeId)), entity]),
    )

    const predictionText = modelResponse?.outputs?.[0]?.data?.[0] ?? modelResponse?.predictions?.[0]
    let prediction = {}
    if (typeof predictionText === 'string') {
      try {
        prediction = JSON.parse(predictionText)
      } catch {
        prediction = { raw: predictionText }
      }
    } else if (predictionText && typeof predictionText === 'object') {
      prediction = predictionText
    }

    const warnings = [
      {
        code: 'synthetic-flow-data',
        message: 'Detector and flow inputs are synthetic smoke-test data from the local Urban Mobility setup.',
      },
      {
        code: 'synthetic-edge-road-mapping',
        message: 'SUMO edgeId to OLDT road mapping is a nearest-road Guanajuato use-case mapping, not production road conflation.',
      },
    ]

    const inserted = []
    for (const anchor of roadAnchors) {
      const entity = entitiesByEdgeId.get(anchor.sumoEdgeId)
      if (!entity) {
        inserted.push({ sumoEdgeId: anchor.sumoEdgeId, entityId: anchor.entityId, status: 'missing-ngsi-output' })
        continue
      }

      for (const [outputKey, ngsiField] of OUTPUT_FIELDS) {
        const valueNumeric = numberValue(entity[ngsiField])
        await insertOutput(client, {
          cityId: 'guanajuato',
          entityId: anchor.entityId,
          modelKey,
          modelVersion,
          outputKey,
          status: valueNumeric === null ? 'warning' : 'computed',
          valueNumeric,
          valueText: null,
          valueJson: {
            sumoEdgeId: anchor.sumoEdgeId,
            ngsiEntityId: entity.id,
            ngsiField,
            value: jsonValue(entity[ngsiField]),
            rawNgsiAttribute: entity[ngsiField] ?? null,
            roadAnchor: anchor,
            simulationDatetime,
          },
          unit: null,
          confidence: 'synthetic-smoke',
          authorityStatus: 'derived-model-output',
          method: {
            route: 'oldt-to-sumo-to-data-platform-to-oldt',
            modelEndpoint,
            ngsiEndpoint,
            dataPlatformMode: 'ngsi-ld-and-dpl',
            mappingPolicy: 'nearest-road-usecase-anchor',
            simulationDatetime,
          },
          inputSources: [
            { type: 'oldt-road-entity', entityId: anchor.entityId, stableId: anchor.stableId },
            { type: 'eu-data-platform-ngsi', domain: 'urban-smoke-ngsi', entityId: entity.id },
            { type: 'eu-data-platform-dpl', domain: 'urban-smoke-dpl', schema: 'ldt_data' },
            { type: 'model-artifact', emissions: prediction.emission ?? null, edgedata: prediction.edgedata ?? null },
          ],
          uncertainty: {},
          warnings,
          generatedAt,
          validFrom,
          validTo,
        })
        inserted.push({ sumoEdgeId: anchor.sumoEdgeId, entityId: anchor.entityId, outputKey, valueNumeric })
      }
    }

    const dbCheck = await client.query(
      `
        SELECT count(*)::int AS rows
        FROM ldt_enrichment.entity_model_outputs
        WHERE city_id = 'guanajuato'
          AND model_key = $1
          AND model_version = $2
      `,
      [modelKey, modelVersion],
    )

    const summary = {
      ok: true,
      runId,
      modelKey,
      modelVersion,
      simulationDatetime,
      elapsedMs,
      roadAnchors: roadAnchors.length,
      ngsiOutputsRead: entitiesByEdgeId.size,
      insertedRows: inserted.filter((row) => row.outputKey).length,
      databaseRowsForRun: dbCheck.rows[0]?.rows ?? 0,
      modelArtifacts: prediction,
      artifactDir,
      csvEndpoint: `http://localhost:4292/api/live/guanajuato/standards/model-outputs.csv?modelKey=${modelKey}&modelVersion=${modelVersion}&limit=100`,
      inserted,
    }

    await fs.writeFile(path.join(artifactDir, `${runId}_oldt_import_summary.json`), JSON.stringify(summary, null, 2))
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), stack: error?.stack }, null, 2))
  process.exit(1)
})
