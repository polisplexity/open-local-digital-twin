CREATE SCHEMA IF NOT EXISTS ldt_viewer;

CREATE TABLE IF NOT EXISTS ldt_viewer.viewer_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  artifact_key text NOT NULL,
  artifact_type text NOT NULL,
  transport text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  content_state text NOT NULL DEFAULT 'generated',
  active boolean NOT NULL DEFAULT false,
  source_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  generator text NOT NULL DEFAULT 'unknown',
  checksum text,
  byte_size bigint NOT NULL DEFAULT 0,
  feature_count integer NOT NULL DEFAULT 0,
  object_count integer NOT NULL DEFAULT 0,
  tile_count integer NOT NULL DEFAULT 0,
  bounds jsonb NOT NULL DEFAULT '{}'::jsonb,
  uri text NOT NULL,
  local_path text,
  media_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  invalidation_source text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viewer_artifacts_type_check CHECK (artifact_type IN ('mvt-directory', 'pmtiles', '3d-tiles')),
  CONSTRAINT viewer_artifacts_transport_check CHECK (transport IN ('mvt', 'pmtiles', '3d-tiles')),
  CONSTRAINT viewer_artifacts_status_check CHECK (status IN ('queued', 'building', 'ready', 'failed', 'archived')),
  CONSTRAINT viewer_artifacts_content_state_check CHECK (content_state IN ('generated', 'external', 'provider', 'archived')),
  CONSTRAINT viewer_artifacts_key_check CHECK (artifact_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT viewer_artifacts_version_check CHECK (version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,128}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS viewer_artifacts_unique_version_idx
  ON ldt_viewer.viewer_artifacts (city_id, artifact_key, artifact_type, version);

CREATE UNIQUE INDEX IF NOT EXISTS viewer_artifacts_active_unique_idx
  ON ldt_viewer.viewer_artifacts (city_id, artifact_key, artifact_type)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS viewer_artifacts_city_status_idx
  ON ldt_viewer.viewer_artifacts (city_id, artifact_type, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS viewer_artifacts_source_scope_gin
  ON ldt_viewer.viewer_artifacts USING gin (source_scope);

COMMENT ON TABLE ldt_viewer.viewer_artifacts IS
  'Common lifecycle registry for generated viewer artifacts: MVT directories, PMTiles archives, and 3D Tiles packages.';

COMMENT ON COLUMN ldt_viewer.viewer_artifacts.source_scope IS
  'Layer, query, zoom, bounds, and builder inputs that produced the artifact.';

COMMENT ON COLUMN ldt_viewer.viewer_artifacts.active IS
  'Marks the currently promoted artifact for a city/artifact key/type. Only one active version is allowed per key/type.';
