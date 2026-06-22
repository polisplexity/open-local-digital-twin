import { writeBimMeshAssetBundle } from '../bimAssetStore.mjs'

const DEFAULT_MAX_IFC_BYTES = 100 * 1024 * 1024
const DEFAULT_MAX_IFC_ENTITIES = 250_000
const DEFAULT_MAX_IFC_MESH_ASSET_BYTES = 100 * 1024 * 1024

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function splitStepArguments(text) {
  const args = []
  let current = ''
  let depth = 0
  let inString = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inString) {
      current += char
      if (char === '\'' && next === '\'') {
        current += next
        index += 1
      } else if (char === '\'') {
        inString = false
      }
      continue
    }

    if (char === '\'') {
      inString = true
      current += char
      continue
    }
    if (char === '(') {
      depth += 1
      current += char
      continue
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1)
      current += char
      continue
    }
    if (char === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim() || text.endsWith(',')) {
    args.push(current.trim())
  }
  return args
}

function ifcString(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '$' || text === '*') return null
  if (!text.startsWith('\'') || !text.endsWith('\'')) return text
  return text
    .slice(1, -1)
    .replace(/''/g, '\'')
    .replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_match, hex) => {
      try {
        return String.fromCodePoint(...hex.match(/.{1,4}/g).map((part) => Number.parseInt(part, 16)))
      } catch {
        return ''
      }
    })
}

function ifcNumber(value) {
  const numeric = Number(String(value ?? '').trim())
  return Number.isFinite(numeric) ? numeric : null
}

function ifcCompoundPlaneAngle(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '$' || text === '*') return null
  const rawParts = text.replace(/^\(/, '').replace(/\)$/, '').split(',').map((part) => Number(part.trim()))
  if (!rawParts.length || rawParts.some((part) => !Number.isFinite(part))) return null
  const sign = rawParts[0] < 0 ? -1 : 1
  const [degrees = 0, minutes = 0, seconds = 0, millionths = 0] = rawParts.map(Math.abs)
  return sign * (degrees + (minutes / 60) + ((seconds + (millionths / 1_000_000)) / 3600))
}

function extractIfcEntities(ifcText) {
  const entities = []
  const normalized = String(ifcText ?? '').replace(/\r\n/g, '\n')
  const entityPattern = /#(\d+)\s*=\s*(IFC[A-Z0-9_]+)\s*\(([\s\S]*?)\);/gi
  let match
  while ((match = entityPattern.exec(normalized))) {
    entities.push({
      id: `#${match[1]}`,
      type: match[2].toUpperCase(),
      args: splitStepArguments(match[3]),
    })
  }
  return entities
}

function firstIfcName(entities, type) {
  const entity = entities.find((item) => item.type === type)
  return ifcString(entity?.args?.[2])
}

function ifcEntityCounts(entities) {
  return entities.reduce((counts, entity) => {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1
    return counts
  }, {})
}

function ifcReferenceList(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '$' || text === '*') return []
  return text.match(/#\d+/g) ?? []
}

function ifcTypedValue(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '$' || text === '*') return null
  const typed = text.match(/^([A-Z0-9_]+)\(([\s\S]*)\)$/i)
  if (!typed) return ifcString(text)
  const type = typed[1].toUpperCase()
  const raw = typed[2].trim()
  if (raw === '.T.') return true
  if (raw === '.F.') return false
  if (raw.startsWith('\'')) return ifcString(raw)
  const numeric = ifcNumber(raw)
  if (Number.isFinite(numeric)) return numeric
  return {
    type,
    value: ifcString(raw),
  }
}

function ifcContainedByRelations(entities) {
  const parentByChild = new Map()
  for (const entity of entities) {
    if (entity.type === 'IFCRELAGGREGATES') {
      const parent = ifcReferenceList(entity.args[4])[0]
      for (const child of ifcReferenceList(entity.args[5])) {
        if (parent && child) parentByChild.set(child, parent)
      }
    }
    if (entity.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
      const parent = ifcReferenceList(entity.args[5])[0]
      for (const child of ifcReferenceList(entity.args[4])) {
        if (parent && child) parentByChild.set(child, parent)
      }
    }
  }
  return parentByChild
}

function ifcRecordType(type) {
  if (type === 'IFCBUILDING') return 'building'
  if (type === 'IFCBUILDINGSTOREY') return 'storey'
  if (type === 'IFCSPACE') return 'space'
  return type.toLowerCase().replace(/^ifc/, '')
}

function ifcPropertySetsByObject(entities) {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const propertyById = new Map()
  const propertySetById = new Map()

  for (const entity of entities) {
    if (entity.type === 'IFCPROPERTYSINGLEVALUE') {
      propertyById.set(entity.id, {
        name: ifcString(entity.args[0]) ?? entity.id,
        description: ifcString(entity.args[1]),
        value: ifcTypedValue(entity.args[2]),
        unit: ifcString(entity.args[3]) ?? ifcReferenceList(entity.args[3])[0] ?? null,
      })
    }
  }

  for (const entity of entities) {
    if (entity.type !== 'IFCPROPERTYSET') continue
    const properties = {}
    const propertyMetadata = {}
    for (const propertyId of ifcReferenceList(entity.args[4])) {
      const property = propertyById.get(propertyId)
      if (!property?.name) continue
      properties[property.name] = property.value
      propertyMetadata[property.name] = {
        id: propertyId,
        description: property.description,
        unit: property.unit,
      }
    }
    propertySetById.set(entity.id, {
      id: entity.id,
      globalId: ifcString(entity.args[0]),
      name: ifcString(entity.args[2]) ?? entity.id,
      description: ifcString(entity.args[3]),
      properties,
      propertyMetadata,
    })
  }

  const byObject = new Map()
  for (const entity of entities) {
    if (entity.type !== 'IFCRELDEFINESBYPROPERTIES') continue
    const propertySetId = ifcReferenceList(entity.args[5])[0]
    const propertySet = propertySetById.get(propertySetId)
    if (!propertySet) continue
    for (const objectId of ifcReferenceList(entity.args[4])) {
      const object = entityById.get(objectId)
      if (!object) continue
      const objectSets = byObject.get(objectId) ?? []
      objectSets.push(propertySet)
      byObject.set(objectId, objectSets)
    }
  }

  return byObject
}

function ifcPropertySetStats(propertySetsByObject) {
  const uniqueSets = new Set()
  let assignmentCount = 0
  let propertyCount = 0
  for (const sets of propertySetsByObject.values()) {
    assignmentCount += sets.length
    for (const set of sets) {
      uniqueSets.add(set.id)
      propertyCount += Object.keys(set.properties).length
    }
  }
  return {
    propertySetCount: uniqueSets.size,
    propertySetAssignmentCount: assignmentCount,
    propertyCount,
  }
}

function ifcPropertySetsAsObject(sets = []) {
  return Object.fromEntries(sets.map((set) => [set.name, {
    id: set.id,
    globalId: set.globalId,
    description: set.description,
    properties: set.properties,
    propertyMetadata: set.propertyMetadata,
  }]))
}

function ifcSpatialRecords(entities) {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const parentByChild = ifcContainedByRelations(entities)
  const propertySetsByObject = ifcPropertySetsByObject(entities)
  return entities
    .filter((entity) => ['IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE'].includes(entity.type))
    .map((entity) => {
      const parentId = parentByChild.get(entity.id) ?? null
      const parent = parentId ? entityById.get(parentId) : null
      const propertySets = propertySetsByObject.get(entity.id) ?? []
      return {
        id: entity.id,
        type: entity.type,
        recordType: ifcRecordType(entity.type),
        globalId: ifcString(entity.args[0]),
        name: ifcString(entity.args[2]),
        description: ifcString(entity.args[3]),
        objectType: ifcString(entity.args[4]),
        parentId,
        parentType: parent?.type ?? null,
        parentName: ifcString(parent?.args?.[2]),
        propertySets: ifcPropertySetsAsObject(propertySets),
        propertySetNames: propertySets.map((set) => set.name),
        propertySetCount: propertySets.length,
      }
    })
}

async function summarizeIfcNativeGeometry(ifcText, options = {}) {
  const inspectedAt = new Date().toISOString()
  const startedAt = Date.now()
  const maxMeshAssetBytes = numberEnv('TWIN_STUDIO_IFC_MESH_ASSET_MAX_BYTES', DEFAULT_MAX_IFC_MESH_ASSET_BYTES)

  try {
    const { IfcAPI } = await import('web-ifc')
    const ifcApi = new IfcAPI()
    await ifcApi.Init(undefined, true)

    const modelId = ifcApi.OpenModel(new TextEncoder().encode(String(ifcText ?? '')))
    if (!Number.isFinite(modelId) || modelId < 0) {
      return {
        state: 'native-ifc-model-open-failed',
        tool: 'web-ifc',
        inspectedAt,
        durationMs: Date.now() - startedAt,
      }
    }

    try {
      const meshes = ifcApi.LoadAllGeometry(modelId)
      const elementMeshCount = Number(meshes?.size?.() ?? 0)
      let elementsWithGeometry = 0
      let geometryReferenceCount = 0
      let vertexBufferValueCount = 0
      let indexValueCount = 0
      let meshAssetBytes = 0
      let meshAssetLimitExceeded = false
      const meshAssetElements = []
      const sampledElementMeshes = []

      for (let index = 0; index < elementMeshCount; index += 1) {
        const mesh = meshes.get(index)
        const geometryCount = Number(mesh?.geometries?.size?.() ?? 0)
        const meshAssetElement = {
          expressId: mesh.expressID,
          geometries: [],
        }
        if (geometryCount > 0) {
          elementsWithGeometry += 1
        }
        if (sampledElementMeshes.length < 10) {
          sampledElementMeshes.push({
            expressId: mesh.expressID,
            geometryCount,
          })
        }

        for (let geometryIndex = 0; geometryIndex < geometryCount; geometryIndex += 1) {
          const placedGeometry = mesh.geometries.get(geometryIndex)
          geometryReferenceCount += 1
          const geometry = ifcApi.GetGeometry(modelId, placedGeometry.geometryExpressID)
          const vertexDataSize = Number(geometry?.GetVertexDataSize?.() ?? 0)
          const indexDataSize = Number(geometry?.GetIndexDataSize?.() ?? 0)
          vertexBufferValueCount += vertexDataSize
          indexValueCount += indexDataSize
          const vertices = ifcApi.GetVertexArray(geometry.GetVertexData(), vertexDataSize)
          const indices = ifcApi.GetIndexArray(geometry.GetIndexData(), indexDataSize)
          const nextAssetBytes = meshAssetBytes + vertices.byteLength + indices.byteLength
          if (nextAssetBytes <= maxMeshAssetBytes) {
            meshAssetBytes = nextAssetBytes
            meshAssetElement.geometries.push({
              geometryExpressId: placedGeometry.geometryExpressID,
              color: placedGeometry.color ? {
                r: placedGeometry.color.x,
                g: placedGeometry.color.y,
                b: placedGeometry.color.z,
                a: placedGeometry.color.w,
              } : null,
              flatTransformation: Array.isArray(placedGeometry.flatTransformation)
                ? placedGeometry.flatTransformation
                : Array.from(placedGeometry.flatTransformation ?? []),
              vertices,
              indices,
            })
          } else {
            meshAssetLimitExceeded = true
          }
          geometry?.delete?.()
        }
        if (meshAssetElement.geometries.length > 0) {
          meshAssetElements.push(meshAssetElement)
        }
        mesh?.delete?.()
      }
      const meshAssetBundle = options.cityId && options.layerKey && options.sourceHash
        ? writeBimMeshAssetBundle({
            cityId: options.cityId,
            layerKey: options.layerKey,
            sourceHash: options.sourceHash,
            sourceFormat: 'ifc',
            tool: 'web-ifc',
            toolVersion: ifcApi.GetVersion?.() ?? null,
            schema: ifcApi.GetModelSchema?.(modelId) ?? null,
            elements: meshAssetElements,
          })
        : null

      return {
        state: geometryReferenceCount > 0
          ? 'inspected-native-ifc-geometry'
          : 'inspected-no-native-element-geometry',
        tool: 'web-ifc',
        toolVersion: ifcApi.GetVersion?.() ?? null,
        schema: ifcApi.GetModelSchema?.(modelId) ?? null,
        maxExpressId: ifcApi.GetMaxExpressID?.(modelId) ?? null,
        elementMeshCount,
        elementsWithGeometry,
        geometryReferenceCount,
        vertexBufferValueCount,
        indexValueCount,
        meshAssetBytes,
        meshAssetLimitBytes: maxMeshAssetBytes,
        meshAssetLimitExceeded,
        meshAssetBundle,
        sampledElementMeshes,
        inspectedAt,
        durationMs: Date.now() - startedAt,
      }
    } finally {
      ifcApi.CloseModel(modelId)
    }
  } catch (error) {
    return {
      state: 'native-ifc-geometry-unavailable',
      tool: 'web-ifc',
      error: String(error?.message ?? error ?? 'UNKNOWN_IFC_NATIVE_GEOMETRY_ERROR'),
      inspectedAt,
      durationMs: Date.now() - startedAt,
    }
  }
}

function summarizeIfcText(ifcText, body = {}) {
  const maxBytes = numberEnv('TWIN_STUDIO_IFC_MAX_BYTES', DEFAULT_MAX_IFC_BYTES)
  const byteLength = Buffer.byteLength(String(ifcText ?? ''), 'utf8')
  if (byteLength > maxBytes) {
    throw new Error(`IFC_SOURCE_TOO_LARGE:${maxBytes}`)
  }

  const entities = extractIfcEntities(ifcText)
  const maxEntities = numberEnv('TWIN_STUDIO_IFC_MAX_ENTITIES', DEFAULT_MAX_IFC_ENTITIES)
  if (entities.length > maxEntities) {
    throw new Error(`IFC_ENTITY_LIMIT_EXCEEDED:${maxEntities}`)
  }
  if (!entities.length) {
    throw new Error('IFC_STEP_ENTITIES_REQUIRED')
  }

  const counts = ifcEntityCounts(entities)
  const site = entities.find((entity) => entity.type === 'IFCSITE')
  const declaredLon = ifcNumber(body.lon ?? body.longitude ?? body.anchorLon ?? body.anchor_lon ?? body.metadata?.lon ?? body.metadata?.longitude)
  const declaredLat = ifcNumber(body.lat ?? body.latitude ?? body.anchorLat ?? body.anchor_lat ?? body.metadata?.lat ?? body.metadata?.latitude)
  const siteLat = ifcCompoundPlaneAngle(site?.args?.[9])
  const siteLon = ifcCompoundPlaneAngle(site?.args?.[10])
  const lon = Number.isFinite(siteLon) ? siteLon : declaredLon
  const lat = Number.isFinite(siteLat) ? siteLat : declaredLat
  const elevation = ifcNumber(site?.args?.[11])
  const projectName = firstIfcName(entities, 'IFCPROJECT')
  const siteName = ifcString(site?.args?.[2])
  const buildingName = firstIfcName(entities, 'IFCBUILDING')
  const propertySetsByObject = ifcPropertySetsByObject(entities)
  const propertySetStats = ifcPropertySetStats(propertySetsByObject)
  const spatialRecords = ifcSpatialRecords(entities)

  return {
    byteLength,
    entityCount: entities.length,
    entityCounts: counts,
    schema: String(ifcText).match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] ?? null,
    projectName,
    siteName,
    buildingName,
    propertySetStats,
    spatialRecords,
    hasIfcSiteGeoreference: Number.isFinite(siteLat) && Number.isFinite(siteLon),
    hasDeclaredAnchor: Number.isFinite(declaredLat) && Number.isFinite(declaredLon),
    anchor: Number.isFinite(lat) && Number.isFinite(lon)
      ? {
          lat,
          lon,
          elevation,
          source: Number.isFinite(siteLat) && Number.isFinite(siteLon) ? 'ifc-site-ref-latitude-longitude' : 'declared-provider-anchor',
        }
      : null,
  }
}

function ifcSummaryToGeoJson(summary, layerKey) {
  if (!summary.anchor) {
    return {
      type: 'FeatureCollection',
      features: [],
    }
  }

  const anchorGeometry = {
    type: 'Point',
    coordinates: [summary.anchor.lon, summary.anchor.lat],
  }
  const anchorFeature = {
    type: 'Feature',
    properties: {
      id: `${layerKey}:ifc-anchor`,
      name: summary.buildingName || summary.siteName || summary.projectName || 'IFC model anchor',
      label: summary.buildingName || summary.siteName || summary.projectName || 'IFC model anchor',
      source_format: 'ifc',
      ifc_record_type: 'model-anchor',
      geometry_source: 'ifc-site-or-provider-anchor',
      geometry_precision: 'model-anchor',
      anchor_source: summary.anchor.source,
      entity_count: summary.entityCount,
      ifc_schema: summary.schema,
      ifc_project_name: summary.projectName,
      ifc_site_name: summary.siteName,
      ifc_building_name: summary.buildingName,
      ifc_building_count: summary.entityCounts.IFCBUILDING ?? 0,
      ifc_storey_count: summary.entityCounts.IFCBUILDINGSTOREY ?? 0,
      ifc_space_count: summary.entityCounts.IFCSPACE ?? 0,
      ifc_property_set_count: summary.propertySetStats.propertySetCount,
      ifc_property_count: summary.propertySetStats.propertyCount,
      ifc_native_geometry_state: summary.nativeGeometry?.state ?? null,
      ifc_native_geometry_tool: summary.nativeGeometry?.tool ?? null,
      ifc_native_geometry_reference_count: summary.nativeGeometry?.geometryReferenceCount ?? 0,
      ifc_native_geometry_element_count: summary.nativeGeometry?.elementMeshCount ?? 0,
      ifc_native_geometry: summary.nativeGeometry ?? null,
      elevation_m: summary.anchor.elevation,
    },
    geometry: anchorGeometry,
  }

  const spatialFeatures = summary.spatialRecords.map((record) => ({
    type: 'Feature',
    properties: {
      id: `${layerKey}:${record.recordType}:${record.id.replace('#', '')}`,
      name: record.name || record.globalId || `${record.recordType} ${record.id}`,
      label: record.name || record.globalId || `${record.recordType} ${record.id}`,
      source_format: 'ifc',
      ifc_record_type: record.recordType,
      ifc_entity_id: record.id,
      ifc_entity_type: record.type,
      ifc_global_id: record.globalId,
      ifc_name: record.name,
      ifc_description: record.description,
      ifc_object_type: record.objectType,
      ifc_parent_id: record.parentId,
      ifc_parent_type: record.parentType,
      ifc_parent_name: record.parentName,
      ifc_property_sets: record.propertySets,
      ifc_property_set_names: record.propertySetNames,
      ifc_property_set_count: record.propertySetCount,
      ifc_project_name: summary.projectName,
      ifc_site_name: summary.siteName,
      ifc_schema: summary.schema,
      ifc_native_geometry_state: summary.nativeGeometry?.state ?? null,
      geometry_source: 'ifc-model-anchor-not-element-geometry',
      geometry_precision: 'indexed-bim-record-at-model-anchor',
      elevation_m: summary.anchor.elevation,
    },
    geometry: anchorGeometry,
  }))

  return {
    type: 'FeatureCollection',
    features: [
      anchorFeature,
      ...spatialFeatures,
    ],
  }
}

export {
  ifcSummaryToGeoJson,
  summarizeIfcNativeGeometry,
  summarizeIfcText,
}
