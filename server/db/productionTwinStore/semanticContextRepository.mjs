import { getProductionPool } from '../postgisPool.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'

const DEFAULT_RULE_CHECK_LIMIT = 25

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback
  const text = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(text)) return true
  if (['0', 'false', 'no', 'off'].includes(text)) return false
  return fallback
}

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeEntityIdentifier(value) {
  const raw = compactText(value)
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function normalizeEntity(row) {
  const properties = parseMaybeJson(row.properties, {}) ?? {}
  return {
    id: row.id,
    stableId: row.stable_id,
    entityType: row.entity_type,
    label: row.label || row.stable_id,
    canonicalUri: row.canonical_uri || null,
    authorityStatus: row.authority_status,
    confidence: row.confidence,
    lifecycleStatus: row.lifecycle_status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    geometry: {
      type: row.geometry_type || null,
      centroid: parseMaybeJson(row.centroid_geometry, null),
      envelope: parseMaybeJson(row.envelope_geometry, null),
      geojson: parseMaybeJson(row.geometry, null),
    },
    properties,
  }
}

function normalizeSemanticTag(row) {
  return {
    id: row.id,
    semanticClassKey: row.semantic_class_key,
    semanticClassLabel: row.semantic_class_label,
    semanticClassDescription: row.semantic_class_description || '',
    inventoryTier: row.inventory_tier || 'semantic',
    tagKey: row.tag_key,
    tagLabel: row.tag_label,
    tagDescription: row.tag_description || '',
    tagValue: row.tag_value,
    valueType: row.value_type || 'text',
    value: parseMaybeJson(row.value_json, {}),
    method: row.method,
    confidence: row.confidence,
    authorityStatus: row.authority_status,
    reviewState: row.review_state,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    updatedAt: row.updated_at,
    source: row.source_feature_id
      ? {
          id: row.source_feature_id,
          nativeId: row.native_source_feature_id,
          layer: row.source_layer,
          type: row.source_type,
          datasetIdentifier: row.dataset_identifier,
          datasetTitle: row.dataset_title,
        }
      : null,
    mapping: row.mapping_id
      ? {
          id: row.mapping_id,
          providerKey: row.provider_key,
          sourceFamily: row.source_family,
          sourceLayer: row.mapping_source_layer,
          entityType: row.mapping_entity_type,
          method: row.mapping_method,
          confidence: row.mapping_confidence,
          authorityStatus: row.mapping_authority_status,
          lifecycleStatus: row.mapping_lifecycle_status,
          notes: row.mapping_notes || '',
        }
      : null,
  }
}

function normalizeSourceEvidence(row) {
  return {
    id: row.evidence_id,
    role: row.evidence_role,
    matchScore: row.match_score == null ? null : Number(row.match_score),
    confidence: row.evidence_confidence,
    properties: parseMaybeJson(row.evidence_properties, {}),
    createdAt: row.evidence_created_at,
    sourceFeature: {
      id: row.source_feature_id,
      nativeId: row.native_source_feature_id,
      sourceLayer: row.source_layer,
      sourceType: row.source_type,
      createdAt: row.source_created_at,
      dataset: {
        id: row.dataset_id,
        identifier: row.dataset_identifier,
        title: row.dataset_title,
        publisher: row.dataset_publisher,
        license: row.dataset_license,
      },
      properties: parseMaybeJson(row.source_properties, {}),
    },
  }
}

function normalizeRuleCheck(row) {
  return {
    id: row.id,
    packKey: row.pack_key || null,
    packVersion: row.pack_version || null,
    packRunKey: row.pack_run_key,
    ruleKey: row.rule_key,
    result: row.result,
    severity: row.severity,
    explanation: row.explanation,
    authorityStatus: row.authority_status,
    reviewState: row.review_state,
    role: row.subject_entity_id === row.target_entity_id ? 'subject' : 'evidence',
    inputSnapshot: parseMaybeJson(row.input_snapshot, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function contextSummary({ semanticTags, sourceEvidence, ruleChecks }) {
  const classKeys = Array.from(new Set(semanticTags.map((tag) => tag.semanticClassKey))).filter(Boolean)
  const authorityStates = Array.from(new Set(semanticTags.map((tag) => tag.authorityStatus).filter(Boolean)))
  const reviewStates = Array.from(new Set(semanticTags.map((tag) => tag.reviewState).filter(Boolean)))
  return {
    semanticClassCount: classKeys.length,
    semanticTagCount: semanticTags.length,
    sourceEvidenceCount: sourceEvidence.length,
    ruleCheckCount: ruleChecks.length,
    semanticClasses: classKeys,
    authorityStates,
    reviewStates,
  }
}

async function findEntity(client, cityId, identifier, { includeGeometry }) {
  const result = await client.query(
    `
      SELECT
        ce.id::text,
        ce.stable_id,
        ce.entity_type,
        ce.label,
        ce.canonical_uri,
        ce.authority_status,
        ce.confidence,
        ce.lifecycle_status,
        ce.valid_from,
        ce.valid_to,
        ce.properties,
        ce.created_at,
        ce.updated_at,
        GeometryType(ce.geom) AS geometry_type,
        ST_AsGeoJSON(ST_PointOnSurface(ce.geom))::jsonb AS centroid_geometry,
        ST_AsGeoJSON(ST_Envelope(ce.geom))::jsonb AS envelope_geometry,
        CASE WHEN $3::boolean THEN ST_AsGeoJSON(ce.geom)::jsonb ELSE NULL END AS geometry
      FROM ldt_core.city_entities ce
      WHERE ce.city_id = $1
        AND (
          ce.id::text = $2
          OR ce.stable_id = $2
          OR ce.canonical_uri = $2
          OR ce.properties->>'canonicalSourceId' = $2
          OR ce.properties->'sourceProperties'->>'id' = $2
          OR ce.properties->'sourceProperties'->>'stable_id' = $2
        )
      ORDER BY
        CASE
          WHEN ce.id::text = $2 THEN 0
          WHEN ce.stable_id = $2 THEN 1
          WHEN ce.canonical_uri = $2 THEN 2
          ELSE 3
        END,
        ce.updated_at DESC
      LIMIT 1
    `,
    [cityId, identifier, includeGeometry],
  )
  return result.rows[0] ? normalizeEntity(result.rows[0]) : null
}

async function listSemanticTags(client, entityId) {
  const result = await client.query(
    `
      SELECT
        est.id::text,
        est.semantic_class_key,
        scr.label AS semantic_class_label,
        scr.description AS semantic_class_description,
        scr.inventory_tier,
        est.tag_key,
        std.label AS tag_label,
        std.description AS tag_description,
        est.tag_value,
        est.value_type,
        est.value_json,
        est.method,
        est.confidence,
        est.authority_status,
        est.review_state,
        est.valid_from,
        est.valid_to,
        est.updated_at,
        sf.id::text AS source_feature_id,
        sf.source_feature_id AS native_source_feature_id,
        sf.source_layer,
        sf.source_type,
        d.identifier AS dataset_identifier,
        d.title AS dataset_title,
        m.id::text AS mapping_id,
        m.provider_key,
        m.source_family,
        m.source_layer AS mapping_source_layer,
        m.entity_type AS mapping_entity_type,
        m.mapping_method,
        m.confidence AS mapping_confidence,
        m.authority_status AS mapping_authority_status,
        m.lifecycle_status AS mapping_lifecycle_status,
        m.notes AS mapping_notes
      FROM ldt_semantic.entity_semantic_tags est
      JOIN ldt_semantic.semantic_class_registry scr
        ON scr.class_key = est.semantic_class_key
      JOIN ldt_semantic.semantic_tag_definitions std
        ON std.semantic_class_key = est.semantic_class_key
       AND std.tag_key = est.tag_key
      LEFT JOIN ldt_prov.source_features sf
        ON sf.id = est.source_feature_id
      LEFT JOIN ldt_catalog.datasets d
        ON d.id = sf.dataset_id
      LEFT JOIN ldt_semantic.source_semantic_mappings m
        ON m.id::text = est.value_json->>'mappingId'
      WHERE est.entity_id = $1::uuid
        AND est.valid_to IS NULL
      ORDER BY scr.inventory_tier, est.semantic_class_key, est.tag_key, est.tag_value
    `,
    [entityId],
  )
  return result.rows.map(normalizeSemanticTag)
}

async function listSourceEvidence(client, entityId) {
  const result = await client.query(
    `
      SELECT
        ese.id::text AS evidence_id,
        ese.evidence_role,
        ese.match_score,
        ese.confidence AS evidence_confidence,
        ese.properties AS evidence_properties,
        ese.created_at AS evidence_created_at,
        sf.id::text AS source_feature_id,
        sf.source_feature_id AS native_source_feature_id,
        sf.source_layer,
        sf.source_type,
        sf.created_at AS source_created_at,
        COALESCE(sf.payload->'payload'->'properties', sf.payload->'properties', '{}'::jsonb) AS source_properties,
        d.id::text AS dataset_id,
        d.identifier AS dataset_identifier,
        d.title AS dataset_title,
        d.publisher AS dataset_publisher,
        d.license AS dataset_license
      FROM ldt_prov.entity_source_evidence ese
      JOIN ldt_prov.source_features sf
        ON sf.id = ese.source_feature_id
      LEFT JOIN ldt_catalog.datasets d
        ON d.id = sf.dataset_id
      WHERE ese.entity_id = $1::uuid
      ORDER BY ese.evidence_role, ese.confidence DESC, sf.created_at DESC
    `,
    [entityId],
  )
  return result.rows.map(normalizeSourceEvidence)
}

async function listRuleChecks(client, entityId, limit) {
  const result = await client.query(
    `
      SELECT
        rc.id::text,
        rc.pack_run_key,
        rc.rule_key,
        rc.subject_entity_id::text,
        rc.evidence_entity_id::text,
        $1::text AS target_entity_id,
        rc.result,
        rc.severity,
        rc.explanation,
        rc.input_snapshot,
        rc.authority_status,
        rc.review_state,
        rc.created_at,
        rc.updated_at,
        p.pack_key,
        p.version AS pack_version
      FROM ldt_semantic.rule_check_results rc
      LEFT JOIN ldt_semantic.pack_registry p
        ON p.id = rc.pack_id
      WHERE rc.subject_entity_id = $1::uuid
         OR rc.evidence_entity_id = $1::uuid
      ORDER BY rc.updated_at DESC, rc.created_at DESC
      LIMIT $2
    `,
    [entityId, limit],
  )
  return result.rows.map(normalizeRuleCheck)
}

export async function getEntitySemanticContext(cityId, identifier, options = {}) {
  const normalizedCityId = compactText(cityId)
  const normalizedIdentifier = normalizeEntityIdentifier(identifier)
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')
  if (!normalizedIdentifier) throw new Error('ENTITY_IDENTIFIER_REQUIRED')

  const pool = options.pool ?? getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId: normalizedCityId,
      identifier: normalizedIdentifier,
      entity: null,
      semanticTags: [],
      sourceEvidence: [],
      ruleChecks: [],
      summary: contextSummary({ semanticTags: [], sourceEvidence: [], ruleChecks: [] }),
      error: null,
    }
  }

  const client = await pool.connect()
  try {
    const entity = await findEntity(client, normalizedCityId, normalizedIdentifier, {
      includeGeometry: parseBoolean(options.includeGeometry, false),
    })
    if (!entity) {
      return {
        configured: true,
        ok: false,
        cityId: normalizedCityId,
        identifier: normalizedIdentifier,
        entity: null,
        semanticTags: [],
        sourceEvidence: [],
        ruleChecks: [],
        summary: contextSummary({ semanticTags: [], sourceEvidence: [], ruleChecks: [] }),
        error: 'ENTITY_NOT_FOUND',
      }
    }

    const ruleCheckLimit = clampInteger(options.ruleCheckLimit, DEFAULT_RULE_CHECK_LIMIT, 0, 100)
    const semanticTags = await listSemanticTags(client, entity.id)
    const sourceEvidence = await listSourceEvidence(client, entity.id)
    const ruleChecks = ruleCheckLimit > 0 ? await listRuleChecks(client, entity.id, ruleCheckLimit) : []

    return {
      configured: true,
      ok: true,
      cityId: normalizedCityId,
      identifier: normalizedIdentifier,
      entity,
      semanticTags,
      sourceEvidence,
      ruleChecks,
      summary: contextSummary({ semanticTags, sourceEvidence, ruleChecks }),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId: normalizedCityId,
      identifier: normalizedIdentifier,
      entity: null,
      semanticTags: [],
      sourceEvidence: [],
      ruleChecks: [],
      summary: contextSummary({ semanticTags: [], sourceEvidence: [], ruleChecks: [] }),
      error: String(error?.message ?? 'ENTITY_SEMANTIC_CONTEXT_FAILED'),
    }
  } finally {
    client.release()
  }
}
