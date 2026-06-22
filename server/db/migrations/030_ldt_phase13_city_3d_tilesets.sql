CREATE SCHEMA IF NOT EXISTS ldt_viewer;

CREATE TABLE IF NOT EXISTS ldt_viewer.city_3d_tilesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  tileset_key text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  content_state text NOT NULL DEFAULT 'generated',
  source_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  semantic_classes text[] NOT NULL DEFAULT ARRAY[]::text[],
  asset_root text NOT NULL,
  tileset_url text NOT NULL,
  tileset_path text NOT NULL,
  feature_count integer NOT NULL DEFAULT 0,
  object_count integer NOT NULL DEFAULT 0,
  byte_size bigint NOT NULL DEFAULT 0,
  geometric_error double precision NOT NULL DEFAULT 0,
  bounding_volume jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_3d_tilesets_status_check CHECK (status IN ('queued', 'building', 'ready', 'failed', 'archived')),
  CONSTRAINT city_3d_tilesets_content_state_check CHECK (content_state IN ('generated', 'external', 'provider', 'archived')),
  CONSTRAINT city_3d_tilesets_key_check CHECK (tileset_key ~ '^[a-z0-9][a-z0-9._-]{1,96}$'),
  CONSTRAINT city_3d_tilesets_version_check CHECK (version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,96}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS city_3d_tilesets_unique_version_idx
  ON ldt_viewer.city_3d_tilesets (city_id, tileset_key, version);

CREATE INDEX IF NOT EXISTS city_3d_tilesets_city_ready_idx
  ON ldt_viewer.city_3d_tilesets (city_id, tileset_key, generated_at DESC)
  WHERE status = 'ready';

CREATE INDEX IF NOT EXISTS city_3d_tilesets_classes_idx
  ON ldt_viewer.city_3d_tilesets USING gin (semantic_classes);

COMMENT ON TABLE ldt_viewer.city_3d_tilesets IS
  'Registry of generated or provider-supplied 3D Tiles packages available to live visual surfaces.';

COMMENT ON COLUMN ldt_viewer.city_3d_tilesets.source_query IS
  'TwinQL or builder query that produced the package; this keeps visual assets traceable to inventory scope.';

COMMENT ON COLUMN ldt_viewer.city_3d_tilesets.asset_root IS
  'Local runtime asset root. Production deployments can mirror this path to object storage.';

