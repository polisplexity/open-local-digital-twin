export async function refreshLdtObjectObservationSummary(client, cityId, {
  scenarioKey = 'baseline',
} = {}) {
  await client.query(
    `
      DELETE FROM ldt_environment.object_observation_summary
      WHERE city_id = $1
        AND scenario_key = $2
    `,
    [cityId, scenarioKey],
  )

  const result = await client.query(
    `
      INSERT INTO ldt_environment.object_observation_summary (
        city_id,
        entity_id,
        scenario_key,
        values,
        built_form_proxy,
        heat_proxy,
        air_roughness_proxy,
        green_blue_cooling_proxy,
        solar_exposure_proxy,
        water_flow_proxy,
        hydrology_surface_water_signal,
        surface_runoff_screening,
        weather_air_temperature_c,
        weather_wind_speed_ms,
        weather_wind_direction_deg,
        generated_at
      )
      SELECT
        observations.city_id,
        observations.entity_id,
        observations.scenario_key,
        COALESCE(jsonb_object_agg(layers.layer_key, observations.value), '{}'::jsonb) AS values,
        max(observations.value) FILTER (WHERE layers.layer_key = 'built_form_proxy') AS built_form_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'heat_proxy') AS heat_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'air_roughness_proxy') AS air_roughness_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'green_blue_cooling_proxy') AS green_blue_cooling_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'solar_exposure_proxy') AS solar_exposure_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'water_flow_proxy') AS water_flow_proxy,
        max(observations.value) FILTER (WHERE layers.layer_key = 'hydrology_surface_water_signal') AS hydrology_surface_water_signal,
        max(observations.value) FILTER (WHERE layers.layer_key = 'surface_runoff_screening') AS surface_runoff_screening,
        max(observations.value) FILTER (WHERE layers.layer_key = 'weather_air_temperature_c') AS weather_air_temperature_c,
        max(observations.value) FILTER (WHERE layers.layer_key = 'weather_wind_speed_ms') AS weather_wind_speed_ms,
        max(observations.value) FILTER (WHERE layers.layer_key = 'weather_wind_direction_deg') AS weather_wind_direction_deg,
        now()
      FROM ldt_environment.object_observations observations
      JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
      WHERE observations.city_id = $1
        AND observations.scenario_key = $2
      GROUP BY observations.city_id, observations.entity_id, observations.scenario_key
      ON CONFLICT (city_id, entity_id, scenario_key) DO UPDATE SET
        values = EXCLUDED.values,
        built_form_proxy = EXCLUDED.built_form_proxy,
        heat_proxy = EXCLUDED.heat_proxy,
        air_roughness_proxy = EXCLUDED.air_roughness_proxy,
        green_blue_cooling_proxy = EXCLUDED.green_blue_cooling_proxy,
        solar_exposure_proxy = EXCLUDED.solar_exposure_proxy,
        water_flow_proxy = EXCLUDED.water_flow_proxy,
        hydrology_surface_water_signal = EXCLUDED.hydrology_surface_water_signal,
        surface_runoff_screening = EXCLUDED.surface_runoff_screening,
        weather_air_temperature_c = EXCLUDED.weather_air_temperature_c,
        weather_wind_speed_ms = EXCLUDED.weather_wind_speed_ms,
        weather_wind_direction_deg = EXCLUDED.weather_wind_direction_deg,
        generated_at = now()
      RETURNING entity_id
    `,
    [cityId, scenarioKey],
  )

  return result.rowCount
}
