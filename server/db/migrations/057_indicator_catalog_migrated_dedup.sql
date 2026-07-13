DELETE FROM ldt_science.indicator_observations migrated
WHERE migrated.metadata->>'migratedFrom'='ldt_enrichment.indicator_observations'
  AND EXISTS (
    SELECT 1
    FROM ldt_science.indicator_observations canonical
    WHERE canonical.id<>migrated.id
      AND canonical.city_id=migrated.city_id
      AND canonical.indicator_id=migrated.indicator_id
      AND canonical.geography_level=migrated.geography_level
      AND canonical.value IS NOT DISTINCT FROM migrated.value
      AND canonical.metadata->>'migratedFrom' IS NULL
  );
