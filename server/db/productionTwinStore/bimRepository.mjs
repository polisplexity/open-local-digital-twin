import { getProductionPool } from '../postgisPool.mjs'
import { numberOrNull, parseMaybeJson } from './repositoryUtils.mjs'

function bimFeaturePosition(geometry, properties = {}) {
  const parsedGeometry = parseMaybeJson(geometry, null)
  const coordinates = parsedGeometry?.type === 'Point' ? parsedGeometry.coordinates : null
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const lon = Number(coordinates[0])
  const lat = Number(coordinates[1])
  const elevation = numberOrNull(properties.elevation_m)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return {
    lon,
    lat,
    elevation,
  }
}

function bimPayloadNode(row) {
  const properties = parseMaybeJson(row.properties, {}) ?? {}
  const geometry = parseMaybeJson(row.geometry, null)
  return {
    stableId: row.stable_id,
    label: row.label ?? properties.label ?? row.stable_id,
    recordType: properties.ifc_record_type ?? 'unknown',
    entityId: properties.ifc_entity_id ?? null,
    entityType: properties.ifc_entity_type ?? null,
    globalId: properties.ifc_global_id ?? null,
    name: properties.ifc_name ?? properties.name ?? row.label ?? null,
    description: properties.ifc_description ?? null,
    objectType: properties.ifc_object_type ?? null,
    parentId: properties.ifc_parent_id ?? null,
    parentType: properties.ifc_parent_type ?? null,
    parentName: properties.ifc_parent_name ?? null,
    projectName: properties.ifc_project_name ?? null,
    siteName: properties.ifc_site_name ?? null,
    schema: properties.ifc_schema ?? null,
    propertySets: properties.ifc_property_sets ?? {},
    propertySetNames: properties.ifc_property_set_names ?? [],
    nativeGeometry: properties.ifc_native_geometry ?? null,
    nativeGeometryState: properties.ifc_native_geometry_state ?? null,
    geometry,
    position: bimFeaturePosition(geometry, properties),
    geometrySource: properties.geometry_source ?? null,
    geometryPrecision: properties.geometry_precision ?? null,
    updatedAt: row.updated_at,
  }
}

export async function getCityLayerBimPayload(cityId, layerKey) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      cityId,
      layerKey,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const layer = await pool.query(
      `
        SELECT id, key, name, layer_family, geometry_type, semantic_status,
          authority_status, access_level, metadata, updated_at
        FROM layer_definitions
        WHERE city_id = $1 AND key = $2
      `,
      [cityId, layerKey],
    )
    if (layer.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        cityId,
        layerKey,
        error: 'LAYER_NOT_FOUND',
      }
    }

    const features = await pool.query(
      `
        SELECT stable_id, label, confidence, properties,
          ST_AsGeoJSON(geom)::json AS geometry,
          updated_at
        FROM city_features
        WHERE city_id = $1
          AND layer_id = $2
          AND properties->>'source_format' = 'ifc'
        ORDER BY
          CASE properties->>'ifc_record_type'
            WHEN 'model-anchor' THEN 0
            WHEN 'building' THEN 1
            WHEN 'storey' THEN 2
            WHEN 'space' THEN 3
            ELSE 9
          END,
          stable_id ASC
      `,
      [cityId, layer.rows[0].id],
    )

    const nodes = features.rows.map(bimPayloadNode)
    const anchor = nodes.find((node) => node.recordType === 'model-anchor') ?? null
    const nativeGeometry = anchor?.nativeGeometry ?? null
    const spatialNodes = nodes.filter((node) => node.recordType !== 'model-anchor')
    const nodesByEntityId = new Map(spatialNodes.map((node) => [node.entityId, node]))
    const hierarchy = spatialNodes.map((node) => ({
      entityId: node.entityId,
      stableId: node.stableId,
      recordType: node.recordType,
      label: node.label,
      parentId: node.parentId,
      parentStableId: node.parentId ? nodesByEntityId.get(node.parentId)?.stableId ?? null : null,
      children: spatialNodes
        .filter((candidate) => candidate.parentId === node.entityId)
        .map((candidate) => candidate.stableId),
    }))
    const recordCounts = nodes.reduce((counts, node) => {
      counts[node.recordType] = (counts[node.recordType] ?? 0) + 1
      return counts
    }, {})

    const layerRow = layer.rows[0]
    return {
      configured: true,
      ok: true,
      cityId,
      layer: {
        key: layerRow.key,
        name: layerRow.name,
        layerFamily: layerRow.layer_family,
        geometryType: layerRow.geometry_type,
        semanticStatus: layerRow.semantic_status,
        authorityStatus: layerRow.authority_status,
        accessLevel: layerRow.access_level,
        metadata: parseMaybeJson(layerRow.metadata, {}),
        updatedAt: layerRow.updated_at,
      },
      payloadType: 'ifc-bim-index',
      limitations: [
        'BIM records are positioned at the model anchor, not native element geometry.',
        'Native IFC geometry is inspected with web-ifc, but the current payload exposes mesh counts, not renderable mesh buffers.',
        'Room polygons, element meshes, and MEP systems require provider IFC files with native shape representations.',
      ],
      anchor,
      nativeGeometry,
      nodes: spatialNodes,
      hierarchy,
      recordCounts,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      layerKey,
      error: String(error?.message ?? 'UNKNOWN_BIM_PAYLOAD_ERROR'),
    }
  } finally {
  }
}
