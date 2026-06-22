import { compactText, json, numberOrNull, slug } from './repositoryUtils.mjs'

export function featureStableId(layerKey, feature, index) {
  const existing = String(feature?.properties?.id ?? '').trim()
  return existing || `${layerKey}:${index + 1}`
}

export function providerFeatureStableId(layerKey, feature, index) {
  const properties = feature?.properties ?? {}
  const existing = compactText(
    properties.stable_id ??
      properties.stableId ??
      properties.id ??
      properties.uuid ??
      properties.objectid ??
      properties.OBJECTID,
  )
  return `${layerKey}:${slug(existing || String(index + 1), String(index + 1))}`
}

export function featureLabel(feature, fallback) {
  const properties = feature?.properties ?? {}
  return compactText(
    properties.label ??
      properties.name ??
      properties.title ??
      properties.Name ??
      properties.NAME,
    fallback,
  )
}

export async function upsertSourceFeature(client, { runId, cityId, layerKey, stableId, feature }) {
  const geometry = feature?.geometry ?? null
  const result = await client.query(
    `
      INSERT INTO source_features_raw (
        ingestion_run_id, city_id, source_feature_id, source_layer,
        geometry_type, geom, payload
      )
      VALUES (
        $1, $2, $3, $4, $5,
        CASE WHEN $6::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326) END,
        $7::jsonb
      )
      ON CONFLICT (ingestion_run_id, source_feature_id) DO UPDATE SET
        geometry_type = excluded.geometry_type,
        geom = excluded.geom,
        payload = excluded.payload
      RETURNING id
    `,
    [
      runId,
      cityId,
      stableId,
      layerKey,
      geometry?.type ?? null,
      geometry ? json(geometry) : null,
      json(feature),
    ],
  )
  return result.rows[0].id
}

export async function upsertCityFeature(client, { cityId, layerId, rawId, layerKey, stableId, feature }) {
  const result = await client.query(
    `
      INSERT INTO city_features (
        city_id, layer_id, source_raw_id, stable_id, feature_type,
        label, authority_status, confidence, geom, properties, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'open-data', $7,
        ST_SetSRID(ST_GeomFromGeoJSON($8), 4326),
        $9::jsonb, now()
      )
      ON CONFLICT (city_id, stable_id) DO UPDATE SET
        layer_id = excluded.layer_id,
        source_raw_id = excluded.source_raw_id,
        feature_type = excluded.feature_type,
        label = excluded.label,
        authority_status = excluded.authority_status,
        confidence = excluded.confidence,
        geom = excluded.geom,
        properties = excluded.properties,
        updated_at = now()
      RETURNING id
    `,
    [
      cityId,
      layerId,
      rawId,
      stableId,
      layerKey,
      feature?.properties?.label ?? stableId,
      feature?.properties?.record_confidence ?? 'open-data',
      json(feature.geometry),
      json(feature.properties ?? {}),
    ],
  )
  return result.rows[0].id
}

export async function upsertProviderCityFeature(client, {
  cityId,
  layerId,
  rawId,
  layerKey,
  stableId,
  feature,
  authorityStatus = 'provider-supplied',
  confidence = 'provider-supplied',
}) {
  const result = await client.query(
    `
      INSERT INTO city_features (
        city_id, layer_id, source_raw_id, stable_id, feature_type,
        label, authority_status, confidence, geom, properties, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        ST_SetSRID(ST_GeomFromGeoJSON($9), 4326),
        $10::jsonb, now()
      )
      ON CONFLICT (city_id, stable_id) DO UPDATE SET
        layer_id = excluded.layer_id,
        source_raw_id = excluded.source_raw_id,
        feature_type = excluded.feature_type,
        label = excluded.label,
        authority_status = excluded.authority_status,
        confidence = excluded.confidence,
        geom = excluded.geom,
        properties = excluded.properties,
        updated_at = now()
      RETURNING id
    `,
    [
      cityId,
      layerId,
      rawId,
      stableId,
      layerKey,
      featureLabel(feature, stableId),
      authorityStatus,
      confidence,
      json(feature.geometry),
      json(feature.properties ?? {}),
    ],
  )
  return result.rows[0].id
}

export async function upsertTypedFeature(client, layerKey, featureId, properties = {}) {
  if (layerKey === 'roads') {
    await client.query(
      `
        INSERT INTO roads (feature_id, road_class, name, maxspeed, lanes, oneway)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (feature_id) DO UPDATE SET
          road_class = excluded.road_class,
          name = excluded.name,
          maxspeed = excluded.maxspeed,
          lanes = excluded.lanes,
          oneway = excluded.oneway
      `,
      [
        featureId,
        properties.highway ?? null,
        properties.label ?? null,
        properties.maxspeed ?? null,
        properties.lanes ?? null,
        properties.oneway ?? null,
      ],
    )
    return
  }

  if (layerKey === 'buildings') {
    await client.query(
      `
        INSERT INTO buildings (
          feature_id, building_type, levels, height_m, footprint_area_m2, bim_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (feature_id) DO UPDATE SET
          building_type = excluded.building_type,
          levels = excluded.levels,
          height_m = excluded.height_m,
          footprint_area_m2 = excluded.footprint_area_m2,
          bim_status = excluded.bim_status
      `,
      [
        featureId,
        properties.building ?? null,
        numberOrNull(properties.levels ?? properties.estimated_floors),
        numberOrNull(properties.height),
        numberOrNull(properties.footprint_area_m2),
        properties.bim_status ?? 'none',
      ],
    )
    return
  }

  if (layerKey === 'facilities') {
    await client.query(
      `
        INSERT INTO facilities (feature_id, category, amenity, shop, public_transport)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (feature_id) DO UPDATE SET
          category = excluded.category,
          amenity = excluded.amenity,
          shop = excluded.shop,
          public_transport = excluded.public_transport
      `,
      [
        featureId,
        properties.category ?? null,
        properties.amenity ?? null,
        properties.shop ?? null,
        properties.publicTransport ?? null,
      ],
    )
    return
  }

  if (layerKey === 'places') {
    await client.query(
      `
        INSERT INTO places (feature_id, place_type, population)
        VALUES ($1, $2, $3)
        ON CONFLICT (feature_id) DO UPDATE SET
          place_type = excluded.place_type,
          population = excluded.population
      `,
      [featureId, properties.place ?? null, numberOrNull(properties.population)],
    )
    return
  }

  if (layerKey === 'greenBlue') {
    await client.query(
      `
        INSERT INTO green_blue_features (feature_id, category, shape)
        VALUES ($1, $2, $3)
        ON CONFLICT (feature_id) DO UPDATE SET
          category = excluded.category,
          shape = excluded.shape
      `,
      [featureId, properties.category ?? null, properties.shape ?? null],
    )
  }
}

export async function ingestFeatureCollection(client, { payload, runId, layerIds, layerKey, collection }) {
  const cityId = payload.city.id
  const layerId = layerIds.get(layerKey)
  let count = 0

  for (const [index, feature] of (collection?.features ?? []).entries()) {
    if (!feature?.geometry) continue
    const stableId = featureStableId(layerKey, feature, index)
    const rawId = await upsertSourceFeature(client, {
      runId,
      cityId,
      layerKey,
      stableId,
      feature,
    })
    const featureId = await upsertCityFeature(client, {
      cityId,
      layerId,
      rawId,
      layerKey,
      stableId,
      feature,
    })
    await upsertTypedFeature(client, layerKey, featureId, feature.properties ?? {})
    count += 1
  }

  return count
}

export async function replaceCityFeatureLayers(client, cityId, layerKeys) {
  await client.query(
    `
      DELETE FROM city_features
      WHERE city_id = $1 AND feature_type = ANY($2::text[])
    `,
    [cityId, layerKeys],
  )
}

export async function replaceCityLayerFeatures(client, cityId, layerId) {
  await client.query(
    `
      DELETE FROM city_features
      WHERE city_id = $1 AND layer_id = $2
    `,
    [cityId, layerId],
  )
}
