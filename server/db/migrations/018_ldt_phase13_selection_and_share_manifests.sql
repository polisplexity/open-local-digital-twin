CREATE TABLE IF NOT EXISTS ldt_viewer.selection_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  scope text NOT NULL,
  unit_id text NOT NULL,
  label text NOT NULL,
  authority text NOT NULL DEFAULT 'inferred-open-data',
  source_method text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available-inferred',
  review_status text NOT NULL DEFAULT 'unreviewed',
  geom geometry(Geometry, 4326) NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, scope, unit_id),
  CHECK (scope IN ('district', 'neighborhood', 'block', 'customPolygon')),
  CHECK (status IN ('available', 'available-inferred', 'draft', 'retired')),
  CHECK (review_status IN ('unreviewed', 'accepted', 'rejected', 'superseded'))
);

CREATE INDEX IF NOT EXISTS ldt_viewer_selection_units_city_scope_idx
  ON ldt_viewer.selection_units (city_id, scope, status, review_status);

CREATE INDEX IF NOT EXISTS ldt_viewer_selection_units_geom_gix
  ON ldt_viewer.selection_units USING gist (geom);

CREATE INDEX IF NOT EXISTS ldt_viewer_selection_units_method_idx
  ON ldt_viewer.selection_units (source_method);

CREATE TABLE IF NOT EXISTS ldt_viewer.visual_share_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  share_key text NOT NULL UNIQUE,
  surface text NOT NULL,
  mode text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  access_policy text NOT NULL DEFAULT 'session',
  publication_status text NOT NULL DEFAULT 'draft',
  layer_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  selection_scope text,
  selection_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (surface IN ('map', 'municipal3d', 'immersive')),
  CHECK (access_policy IN ('session', 'signed-token', 'public')),
  CHECK (publication_status IN ('draft', 'published', 'retired'))
);

CREATE INDEX IF NOT EXISTS ldt_viewer_visual_share_manifests_city_surface_idx
  ON ldt_viewer.visual_share_manifests (city_id, surface, publication_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ldt_viewer_visual_share_manifests_selection_idx
  ON ldt_viewer.visual_share_manifests (city_id, selection_scope);
