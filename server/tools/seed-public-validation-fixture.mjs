import assert from 'node:assert/strict'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const sourceKey = 'public-export-validation'
const pool = getProductionPool()

assert.ok(pool, 'TWIN_STUDIO_DATABASE_URL_REQUIRED')

try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      INSERT INTO ldt_core.cities (
        id, name, country, country_code, region, centroid, canonical_uri, metadata
      ) VALUES (
        $1, 'Public export validation city', 'Test', 'TS', 'Validation',
        ST_SetSRID(ST_MakePoint(-101.25, 20.95), 4326),
        'urn:polisplexity:city:' || $1,
        jsonb_build_object('source', $2::text, 'synthetic', true)
      )
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name,
        centroid=EXCLUDED.centroid,
        metadata=EXCLUDED.metadata,
        updated_at=now()
    `, [cityId, sourceKey])

    await client.query(`
      DELETE FROM ldt_core.city_boundaries
      WHERE city_id=$1 AND properties->>'source'=$2
    `, [cityId, sourceKey])
    await client.query(`
      INSERT INTO ldt_core.city_boundaries (
        city_id, boundary_role, authority_status, geom, properties
      ) VALUES (
        $1,
        'administrative',
        'development-synthetic',
        ST_Multi(ST_GeomFromText(
          'POLYGON((-101.3 20.9,-101.2 20.9,-101.2 21.0,-101.3 21.0,-101.3 20.9))',
          4326
        )),
        jsonb_build_object('source', $2::text, 'synthetic', true)
      )
    `, [cityId, sourceKey])

    await client.query(`
      DELETE FROM ldt_core.city_entities
      WHERE city_id=$1 AND stable_id LIKE $2 || ':building:%'
    `, [cityId, sourceKey])
    await client.query(`
      WITH fixture_points AS (
        SELECT zone_index, item_index,
          -101.3 + ((zone_index + 0.20 + item_index * 0.15) / 3.0) * 0.1 AS lon,
          20.92 + item_index * 0.018 AS lat
        FROM generate_series(0, 2) AS zone_index
        CROSS JOIN generate_series(0, 3) AS item_index
      )
      INSERT INTO ldt_core.city_entities (
        city_id, stable_id, entity_type, label, authority_status,
        confidence, lifecycle_status, geom, properties
      )
      SELECT
        $1,
        $2 || ':building:' || zone_index || ':' || item_index,
        'building',
        'Public export validation building ' || zone_index || '-' || item_index,
        'development-synthetic',
        'synthetic-development',
        'active',
        ST_Transform(
          ST_Buffer(
            ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 3857),
            10,
            'quad_segs=1'
          ),
          4326
        ),
        jsonb_build_object('source', $2::text, 'synthetic', true, 'zoneIndex', zone_index)
      FROM fixture_points
    `, [cityId, sourceKey])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM ldt_core.cities WHERE id=$1) AS cities,
      (SELECT count(*)::int FROM ldt_core.city_boundaries WHERE city_id=$1) AS boundaries,
      (SELECT count(*)::int FROM ldt_core.city_entities
       WHERE city_id=$1 AND stable_id LIKE $2 || ':building:%') AS buildings
  `, [cityId, sourceKey])
  assert.deepEqual(result.rows[0], { cities: 1, boundaries: 1, buildings: 12 })
  console.log(JSON.stringify({ ok: true, cityId, synthetic: true, ...result.rows[0] }, null, 2))
} finally {
  await closeProductionPool()
}
