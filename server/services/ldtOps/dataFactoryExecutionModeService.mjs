import { getProductionPool } from '../../db/postgisPool.mjs'

const DATA_FACTORY_STAGE_KEYS = new Set([
  'city-boundary',
  'provider-assist',
  'ingestion-queue',
  'postgis-twin',
  'viewer-artifacts',
  'semantic-materialization',
  'operations-evidence',
])

const EXECUTION_MODE_KEYS = new Set([
  'interactive-backend',
  'offline-data-factory',
])

function requireCityId(cityId) {
  const normalized = String(cityId ?? '').trim()
  if (!normalized) throw new Error('CITY_ID_REQUIRED')
  return normalized
}

function requireStageKey(stageKey) {
  const normalized = String(stageKey ?? '').trim()
  if (!DATA_FACTORY_STAGE_KEYS.has(normalized)) throw new Error('DATA_FACTORY_STAGE_INVALID')
  return normalized
}

function normalizeExecutionMode(executionMode) {
  const normalized = String(executionMode ?? '').trim()
  if (normalized === 'recommended' || normalized === 'auto' || normalized === '') return null
  if (!EXECUTION_MODE_KEYS.has(normalized)) throw new Error('DATA_FACTORY_EXECUTION_MODE_INVALID')
  return normalized
}

function normalizeProviderOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function executionModeOverridesFromProviderOverride(providerOverride) {
  const dataFactory = providerOverride?.dataFactory
  const raw = dataFactory?.executionModeOverrides
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([stageKey, executionMode]) => DATA_FACTORY_STAGE_KEYS.has(stageKey) && EXECUTION_MODE_KEYS.has(executionMode)),
  )
}

export async function getCityDataFactoryExecutionModeOverrides(cityId) {
  const normalizedCityId = requireCityId(cityId)
  const pool = getProductionPool()
  if (!pool) return {}
  const result = await pool.query(
    `SELECT provider_override
       FROM ldt_ops.city_source_plan_overrides
      WHERE city_id = $1`,
    [normalizedCityId],
  )
  return executionModeOverridesFromProviderOverride(normalizeProviderOverride(result.rows[0]?.provider_override))
}

export async function saveCityDataFactoryExecutionMode({
  cityId,
  stageKey,
  executionMode,
  updatedBy = null,
} = {}) {
  const normalizedCityId = requireCityId(cityId)
  const normalizedStageKey = requireStageKey(stageKey)
  const normalizedExecutionMode = normalizeExecutionMode(executionMode)
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_NOT_CONFIGURED')

  const current = await pool.query(
    `SELECT provider_override
       FROM ldt_ops.city_source_plan_overrides
      WHERE city_id = $1`,
    [normalizedCityId],
  )
  const providerOverride = normalizeProviderOverride(current.rows[0]?.provider_override)
  const dataFactory = providerOverride.dataFactory && typeof providerOverride.dataFactory === 'object' && !Array.isArray(providerOverride.dataFactory)
    ? providerOverride.dataFactory
    : {}
  const executionModeOverrides = {
    ...executionModeOverridesFromProviderOverride(providerOverride),
  }
  if (normalizedExecutionMode) {
    executionModeOverrides[normalizedStageKey] = normalizedExecutionMode
  } else {
    delete executionModeOverrides[normalizedStageKey]
  }
  const nextProviderOverride = {
    ...providerOverride,
    dataFactory: {
      ...dataFactory,
      executionModeOverrides,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    },
  }

  const saved = await pool.query(
    `INSERT INTO ldt_ops.city_source_plan_overrides (
       city_id,
       provider_override,
       updated_at
     ) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (city_id) DO UPDATE SET
       provider_override = EXCLUDED.provider_override,
       updated_at = now()
     RETURNING provider_override, updated_at`,
    [normalizedCityId, JSON.stringify(nextProviderOverride)],
  )

  return {
    ok: true,
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
    executionMode: normalizedExecutionMode,
    modeSource: normalizedExecutionMode ? 'operator-override' : 'recommended',
    executionModeOverrides: executionModeOverridesFromProviderOverride(saved.rows[0]?.provider_override),
    updatedAt: saved.rows[0]?.updated_at ?? null,
  }
}
