import { listAnalysisSelections } from '../../db/productionTwinStore/analysisSelectionRepository.mjs'
import { listCityTwinQueryEvents } from '../../db/productionTwinStore/twinQueryRepository.mjs'
import { listVisualShareManifests } from '../../db/productionTwinStore/visualShareManifestRepository.mjs'
import { listCityQueryPresets } from '../../config/queryPresets.mjs'
import { listCitySubjectQueryBlueprints } from '../subjectQuery/subjectQueryService.mjs'
import { listIndicatorAcceptancePresets } from './indicatorAcceptancePresetService.mjs'

function positiveInteger(value, fallback, max = 100) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(max, number)
}

function bucket({ key, label, description, persistence, primaryAction, count = 0, items = [], groups = [], error = null }) {
  return {
    key,
    label,
    description,
    persistence,
    primaryAction,
    count: Number(count ?? items.length ?? 0),
    items,
    groups,
    error,
  }
}

export async function getCityQueryLibrary(cityId, options = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')
  const surface = String(options.surface || 'map')
  const limit = positiveInteger(options.limit, 40)

  const [analysis, recorded, savedViews, semanticQuestions, indicatorAcceptance] = await Promise.all([
    listAnalysisSelections(normalizedCityId, { limit }),
    listCityTwinQueryEvents(normalizedCityId, { surface, limit }),
    listVisualShareManifests(normalizedCityId, {
      surface,
      mode: 'twin-query-manifest',
      limit,
    }),
    listCitySubjectQueryBlueprints(normalizedCityId, { limit }),
    listIndicatorAcceptancePresets(normalizedCityId, { limit: 200 }),
  ])

  const analysisItems = Array.isArray(analysis.selections) ? analysis.selections : []
  const recordedItems = Array.isArray(recorded.events) ? recorded.events : []
  const savedItems = Array.isArray(savedViews.shares) ? savedViews.shares : []
  const curatedPresetItems = listCityQueryPresets(normalizedCityId)
  const acceptancePresetItems = Array.isArray(indicatorAcceptance.presets) ? indicatorAcceptance.presets : []
  const presetItems = [...curatedPresetItems, ...acceptancePresetItems]

  return {
    ok: Boolean(analysis.ok && recorded.ok && savedViews.ok),
    cityId: normalizedCityId,
    surface,
    generatedAt: new Date().toISOString(),
    taxonomy: {
      analysisSelections: 'Persisted city-object selections plus metrics/evidence. These are reusable analytical data products.',
      queryPresets: 'Named reusable query definitions. These are product-curated questions, not user activity or saved camera state.',
      recordedActivity: 'Audit/replay history of user/API TwinQL executions. These are observations of activity, not saved analytical outputs.',
      savedViews: 'Visual manifests: camera, layer, query, mode, access policy, and publish state for a viewer surface.',
      semanticQuestions: 'Reusable subject-and-indicator questions. Portable blueprints separate a shared question from each city data binding.',
    },
    buckets: {
      queryPresets: bucket({
        key: 'query-presets',
        label: 'Query presets',
        description: 'Named reusable city queries with stable IDs, titles, and query payloads.',
        persistence: 'server.config.queryPresets',
        primaryAction: 'apply-query-preset',
        count: presetItems.length,
        items: presetItems,
        groups: [
          { key: 'curated', label: 'Curated queries', count: curatedPresetItems.length },
          {
            key: 'indicator-acceptance',
            label: 'Indicator acceptance',
            count: acceptancePresetItems.length,
            summary: indicatorAcceptance.summary ?? {},
          },
        ],
        error: indicatorAcceptance.error,
      }),
      semanticQuestions: bucket({
        key: 'semantic-questions',
        label: 'Semantic questions',
        description: 'Saved contextual-subject queries with indicator grain, renderer intent, portability metadata, and optional city bindings.',
        persistence: 'ldt_analysis.subject_query_blueprints',
        primaryAction: 'apply-subject-query-blueprint',
        count: semanticQuestions.blueprints.length,
        items: semanticQuestions.blueprints,
        error: semanticQuestions.error,
      }),
      analysisSelections: bucket({
        key: 'analysis-selections',
        label: 'Analysis selections',
        description: 'Persisted sets of selected city objects with metrics and evidence.',
        persistence: 'ldt_analysis.selection_sets',
        primaryAction: 'replay-selection-query',
        count: analysisItems.length,
        items: analysisItems,
        groups: Array.isArray(analysis.groups) ? analysis.groups : [],
        error: analysis.error,
      }),
      recordedActivity: bucket({
        key: 'recorded-activity',
        label: 'Recorded activity',
        description: 'Logged TwinQL runs used for audit, demand signals, and replay.',
        persistence: 'ldt_viewer.semantic_query_events',
        primaryAction: 'replay-recorded-query',
        count: recordedItems.length,
        items: recordedItems,
        error: recorded.error,
      }),
      savedViews: bucket({
        key: 'saved-views',
        label: 'Saved views',
        description: 'Share/embed-ready visual manifests for a surface, camera, layers, query, and publication state.',
        persistence: 'ldt_viewer.visual_share_manifests',
        primaryAction: 'load-saved-view',
        count: savedItems.length,
        items: savedItems,
        error: savedViews.error,
      }),
    },
    summary: {
      analysisSelections: analysisItems.length,
      queryPresets: presetItems.length,
      semanticQuestions: semanticQuestions.blueprints.length,
      recordedActivity: recordedItems.length,
      savedViews: savedItems.length,
      total: presetItems.length + semanticQuestions.blueprints.length + analysisItems.length + recordedItems.length + savedItems.length,
      limit,
    },
    errors: [analysis.error, recorded.error, savedViews.error, semanticQuestions.error, indicatorAcceptance.error].filter(Boolean),
  }
}
