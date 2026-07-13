CREATE OR REPLACE VIEW ldt_query.city_objects_enriched AS
SELECT
  city_objects.*,
  COALESCE(enrichment.model_enrichments, '{}'::jsonb) AS model_enrichments,
  NULLIF(enrichment.model_enrichments #>> '{eu-ldt-ecobuild,sap_score,valueNumeric}', '')::numeric AS sap_score,
  NULLIF(enrichment.model_enrichments #>> '{eu-ldt-ecobuild,energy_label,valueText}', '') AS energy_label
FROM ldt_query.city_objects city_objects
LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(summary.model_key, summary.outputs ORDER BY summary.model_key) AS model_enrichments
  FROM ldt_enrichment.entity_model_output_summary summary
  WHERE summary.city_id = city_objects.city_id
    AND summary.entity_id = city_objects.id
) enrichment ON true;

COMMENT ON VIEW ldt_query.city_objects_enriched IS
  'Twin query read view over canonical city objects plus model-enrichment JSON and common scalar fields for viewer filtering.';
