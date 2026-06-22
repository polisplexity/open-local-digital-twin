import { compactText, json, slug } from './repositoryUtils.mjs'

export async function upsertCityFromConfig(client, cityConfig) {
  const city = cityConfig ?? {}
  const cityId = slug(city.id ?? city.name, '')
  if (!cityId) {
    throw new Error('CITY_ID_REQUIRED')
  }
  await client.query(
    `
      INSERT INTO cities (
        id, name, country, country_code, region, centroid, enabled, metadata, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326),
        $8, $9::jsonb, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        country = excluded.country,
        country_code = excluded.country_code,
        region = excluded.region,
        centroid = excluded.centroid,
        enabled = excluded.enabled,
        metadata = cities.metadata || excluded.metadata,
        updated_at = now()
    `,
    [
      cityId,
      compactText(city.name, cityId),
      compactText(city.country),
      compactText(city.countryCode),
      compactText(city.region),
      Number(city.lon ?? 0),
      Number(city.lat ?? 0),
      city.enabled !== false,
      json({
        twinLabel: city.twinLabel ?? null,
        nominatimQuery: city.nominatimQuery ?? null,
        wikipediaTownPage: city.wikipediaTownPage ?? null,
        wikipediaMunicipalityPage: city.wikipediaMunicipalityPage ?? null,
      }),
    ],
  )
  return cityId
}
