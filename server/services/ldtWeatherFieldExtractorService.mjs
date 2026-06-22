import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import { refreshLdtObjectObservationSummary } from './ldtObservationSummaryService.mjs'
import { fetchOpenMeteoCurrent } from './ldtWeatherField/openMeteoClient.mjs'
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CITY_IDS,
  DEFAULT_ENDPOINT,
  DEFAULT_SCENARIO_KEY,
  DEFAULT_WEATHER_GRID_RESOLUTION_M,
  OPEN_METEO_DOCS_URL,
  OPEN_METEO_TERMS_URL,
  compactText,
  integerValue,
  weatherGridKeyFromResolution,
} from './ldtWeatherField/weatherFieldConfig.mjs'
import { ensureWeatherDataset, ensureWeatherRun } from './ldtWeatherField/weatherCatalogRepository.mjs'
import { ensureWeatherSamplingGrid, loadGridCells } from './ldtWeatherField/weatherGridRepository.mjs'
import { attachWeatherObservations, writeWeatherSamples } from './ldtWeatherField/weatherObservationRepository.mjs'

async function listCityIds(client, requestedCityIds) {
  const normalized = requestedCityIds.map((cityId) => compactText(cityId)).filter(Boolean)
  if (normalized.length > 0) return normalized
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function runWeatherForCity(client, cityId, options) {
  const scenarioKey = compactText(options.scenarioKey, DEFAULT_SCENARIO_KEY)
  const gridResolutionM = integerValue(options.gridResolutionM, DEFAULT_WEATHER_GRID_RESOLUTION_M, 500, 25_000)
  const requestedGridKey = compactText(options.gridKey)
  const gridResult = await ensureWeatherSamplingGrid(client, cityId, {
    gridKey: requestedGridKey || weatherGridKeyFromResolution(gridResolutionM),
    resolutionM: gridResolutionM,
  })
  const gridKey = gridResult.gridKey
  const cells = await loadGridCells(client, cityId, gridKey)
  if (cells.length === 0) throw new Error(`WEATHER_FIELD_GRID_EMPTY:${cityId}:${gridKey}`)
  if (typeof options.onProgress === 'function') {
    options.onProgress({
      cityId,
      stage: 'sampling-started',
      gridKey,
      gridResolutionM,
      total: cells.length,
    })
  }
  const sampled = await fetchOpenMeteoCurrent(cells, {
    endpoint: compactText(options.endpoint, DEFAULT_ENDPOINT),
    batchSize: options.batchSize,
    onProgress: typeof options.onProgress === 'function'
      ? (progress) => options.onProgress({
        cityId,
        stage: 'sampling',
        gridKey,
        ...progress,
      })
      : undefined,
  })
  if (sampled.samples.length === 0) throw new Error(`WEATHER_FIELD_NO_SOURCE_SAMPLES:${cityId}`)
  const observedAt = sampled.samples.map((sample) => sample.observedAt).find(Boolean) || ''
  const dataset = await ensureWeatherDataset(client, cityId, {
    scenarioKey,
    endpoint: sampled.endpoint,
    gridKey,
    gridResolutionM,
    sampleCount: sampled.samples.length,
    observedAt,
  })
  const sourceGridKey = 'open-meteo-current-weather'
  const cellsWritten = await writeWeatherSamples(client, cityId, {
    gridKey,
    scenarioKey,
    sourceGridKey,
    samples: sampled.samples,
    endpoint: sampled.endpoint,
  })
  const objectObservations = await attachWeatherObservations(client, cityId, { scenarioKey, sourceGridKey })
  const objectSummaries = await refreshLdtObjectObservationSummary(client, cityId, { scenarioKey })
  const run = await ensureWeatherRun(client, cityId, {
    datasetId: dataset.id,
    scenarioKey,
    gridKey,
    gridResolutionM,
    endpoint: sampled.endpoint,
    samples: sampled.samples,
    failures: sampled.failures,
    cellsWritten,
    objectObservations,
    objectSummaries,
  })
  return {
    cityId,
    gridKey,
    scenarioKey,
    sourceGridKey,
    generatedGrid: gridResult.generatedCells,
    gridResolutionM,
    datasetIdentifier: dataset.identifier,
    runKey: run.runKey,
    sampledCells: sampled.samples.length,
    failedBatches: sampled.failures.length,
    cellsWritten,
    objectObservations,
    objectSummaries,
    observedAt,
  }
}

export async function runWeatherFieldExtractor({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  gridKey,
  gridResolutionM = DEFAULT_WEATHER_GRID_RESOLUTION_M,
  endpoint = DEFAULT_ENDPOINT,
  batchSize = DEFAULT_BATCH_SIZE,
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
        cities.push(await runWeatherForCity(client, cityId, {
          scenarioKey,
          gridKey,
          gridResolutionM,
          endpoint,
          batchSize,
          onProgress,
        }))
      }
      await client.query('COMMIT')
      return {
        ok: true,
        extractorKey: 'weather-field',
        source: 'Open-Meteo Forecast API',
        sourceUrl: DEFAULT_ENDPOINT,
        docsUrl: OPEN_METEO_DOCS_URL,
        termsUrl: OPEN_METEO_TERMS_URL,
        scenarioKey,
        gridKey: compactText(gridKey) || weatherGridKeyFromResolution(gridResolutionM),
        gridResolutionM: integerValue(gridResolutionM, DEFAULT_WEATHER_GRID_RESOLUTION_M, 500, 25_000),
        batchSize: integerValue(batchSize, DEFAULT_BATCH_SIZE, 1, 100),
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function closeLdtWeatherFieldExtractorPool() {
  await closeSharedProductionPool()
}
