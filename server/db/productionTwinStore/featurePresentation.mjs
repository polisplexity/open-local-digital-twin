function parseMaybeJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildingViewerProperties(row, properties = {}) {
  const isCandidate = row?.feature_type === 'buildingCandidateNew' || row?.feature_type === 'buildingCandidateMatched'
  const evidenceCount = Number(row?.source_evidence_count ?? 0)
  if (!isCandidate) {
    return {
      ...properties,
      city_inventory_layer: row?.feature_type === 'buildings' ? 'buildings' : properties.city_inventory_layer,
      source_coverage_status: evidenceCount > 0 ? 'confirmed-by-open-provider' : (properties.source_coverage_status ?? 'base-source-only'),
      source_evidence_count: evidenceCount,
      source_match_status: evidenceCount > 0 ? 'matched-open-provider' : (properties.source_match_status ?? null),
    }
  }

  const observedProperties = parseMaybeJson(row.observed_properties, null)
  const hasObservedRecord = row.feature_type === 'buildingCandidateMatched' && observedProperties
  const area = finiteNumber(row.footprint_area_m2)
  const sourceCount = Array.isArray(properties.sources) ? properties.sources.length : 0
  const base = hasObservedRecord ? observedProperties : properties
  const label = hasObservedRecord
    ? compactText(row.observed_label ?? observedProperties?.label, 'Building footprint')
    : 'Building footprint'
  const {
    bbox_filter: _bboxFilter,
    source: _source,
    source_license: _sourceLicense,
    source_layer_key: _sourceLayerKey,
    source_layer_name: _sourceLayerName,
    source_stable_id: _sourceStableId,
    sources: _sources,
    ...displayBase
  } = base

  return {
    ...displayBase,
    id: properties.id ?? row.stable_id,
    label,
    kind: 'building',
    building: base.building ?? properties.building ?? 'building',
    height: base.height ?? 8,
    estimated_floors: base.estimated_floors ?? 3,
    footprint_area_m2: base.footprint_area_m2 ?? (area == null ? null : Math.round(area)),
    bim_status: base.bim_status ?? 'No BIM linked yet',
    planning_readiness: base.planning_readiness ?? (hasObservedRecord ? 'starter-ready' : 'context-only'),
    digital_record_stage: base.digital_record_stage ?? (hasObservedRecord ? 'base-record-with-source-evidence' : 'open-source-candidate'),
    record_confidence: hasObservedRecord ? (base.record_confidence ?? row.observed_confidence ?? row.confidence) : 'candidate',
    city_inventory_layer: 'buildings',
    source_coverage_status: hasObservedRecord ? 'confirmed-by-open-provider' : 'open-provider-only',
    source_evidence_count: sourceCount,
    source_match_status: properties.conflation_status ?? (hasObservedRecord ? 'matched' : 'new-candidate'),
    source_match_distance_m: properties.match_distance_m ?? null,
  }
}

export function viewerFeatureProperties(row) {
  const parsed = parseMaybeJson(row.properties, {}) ?? {}
  const properties = buildingViewerProperties(row, parsed)
  return {
    ...properties,
    id: properties.id ?? row.stable_id,
    stableId: row.stable_id,
    layerKey: properties.city_inventory_layer === 'buildings' ? 'buildings' : (row.layer_key ?? row.feature_type),
    layerName: properties.city_inventory_layer === 'buildings' ? 'Buildings' : row.layer_name,
    layerFamily: properties.city_inventory_layer === 'buildings' ? 'built-fabric' : row.layer_family,
    layerGeometryType: properties.city_inventory_layer === 'buildings' ? 'Polygon' : row.layer_geometry_type,
    featureType: properties.city_inventory_layer === 'buildings' ? 'buildings' : row.feature_type,
    label: properties.label ?? row.label ?? row.stable_id,
    authorityStatus: row.authority_status,
    confidence: row.confidence,
    updatedAt: row.updated_at,
  }
}
