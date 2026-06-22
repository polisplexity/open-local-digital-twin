import {
  compactText,
  DEFAULT_WEATHER_GRID_RESOLUTION_M,
  integerValue,
  weatherGridKeyFromResolution,
} from './weatherFieldConfig.mjs'

export async function ensureWeatherSamplingGrid(client, cityId, {
  gridKey,
  resolutionM = DEFAULT_WEATHER_GRID_RESOLUTION_M,
} = {}) {
  const cellSizeM = integerValue(resolutionM, DEFAULT_WEATHER_GRID_RESOLUTION_M, 500, 25_000)
  const resolvedGridKey = compactText(gridKey, weatherGridKeyFromResolution(cellSizeM))
  await client.query(
    'DELETE FROM ldt_viewer.density_grids WHERE city_id = $1 AND grid_key = $2',
    [cityId, resolvedGridKey],
  )
  const result = await client.query(
    `
      WITH boundary AS (
        SELECT ST_UnaryUnion(ST_Collect(ST_MakeValid(geom))) AS geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      projected AS (
        SELECT ST_Transform(geom, 3857) AS geom
        FROM boundary
        WHERE geom IS NOT NULL
          AND NOT ST_IsEmpty(geom)
      ),
      grid AS (
        SELECT
          g.i,
          g.j,
          ST_CollectionExtract(
            ST_MakeValid(ST_Intersection(g.geom, projected.geom)),
            3
          ) AS geom
        FROM projected
        CROSS JOIN LATERAL ST_SquareGrid($3::double precision, projected.geom) AS g
        WHERE ST_Intersects(g.geom, projected.geom)
      ),
      dumped AS (
        SELECT
          i,
          j,
          d.path,
          d.geom
        FROM grid
        CROSS JOIN LATERAL ST_Dump(geom) AS d
      ),
      clipped AS (
        SELECT
          'weather-' || $3::int || 'm-' || i::text || '-' || j::text || '-' || COALESCE(path[1], 1)::text AS cell_id,
          ST_Transform(geom, 4326)::geometry(Polygon, 4326) AS geom
        FROM dumped
        WHERE geom IS NOT NULL
          AND NOT ST_IsEmpty(geom)
      ),
      valid AS (
        SELECT cell_id, geom
        FROM clipped
        WHERE ST_Area(geom::geography) > 100
      )
      INSERT INTO ldt_viewer.density_grids (
        city_id,
        grid_key,
        zoom_hint,
        cell_id,
        geom,
        metrics,
        refreshed_at
      )
      SELECT
        $1,
        $2,
        11,
        cell_id,
        geom,
        jsonb_build_object(
          'gridType', 'weather-field-sampling',
          'resolutionM', $3::int,
          'source', 'city-boundary-square-grid',
          'purpose', 'source-backed open weather sampling'
        ),
        now()
      FROM valid
      ON CONFLICT (city_id, grid_key, cell_id) DO UPDATE SET
        geom = EXCLUDED.geom,
        metrics = EXCLUDED.metrics,
        refreshed_at = now()
      RETURNING cell_id
    `,
    [cityId, resolvedGridKey, cellSizeM],
  )
  return { gridKey: resolvedGridKey, generatedCells: result.rowCount, resolutionM: cellSizeM }
}

export async function loadGridCells(client, cityId, gridKey) {
  const result = await client.query(
    `
      SELECT
        cell_id,
        ST_X(ST_PointOnSurface(geom))::double precision AS lon,
        ST_Y(ST_PointOnSurface(geom))::double precision AS lat
      FROM ldt_viewer.density_grids
      WHERE city_id = $1
        AND grid_key = $2
      ORDER BY cell_id
    `,
    [cityId, gridKey],
  )
  return result.rows.map((row) => ({
    cellId: row.cell_id,
    lon: Number(row.lon),
    lat: Number(row.lat),
  })).filter((row) => Number.isFinite(row.lon) && Number.isFinite(row.lat))
}
