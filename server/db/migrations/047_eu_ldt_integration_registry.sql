CREATE SCHEMA IF NOT EXISTS ldt_interop;

CREATE TABLE IF NOT EXISTS ldt_interop.eu_ldt_integration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  platform_kind text NOT NULL,
  base_url text NOT NULL,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE SET NULL,
  remote_city_id text,
  status text NOT NULL DEFAULT 'registered',
  auth_config jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  endpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_by text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eu_ldt_integration_profiles_key_check CHECK (profile_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'play-visualise',
    'oldt-provider',
    'other'
  )),
  CONSTRAINT eu_ldt_integration_profiles_status_check CHECK (status IN (
    'registered',
    'validated',
    'warning',
    'error',
    'disabled',
    'archived'
  )),
  CONSTRAINT eu_ldt_integration_profiles_base_url_check CHECK (base_url ~ '^https?://')
);

CREATE INDEX IF NOT EXISTS eu_ldt_integration_profiles_kind_status_idx
  ON ldt_interop.eu_ldt_integration_profiles (platform_kind, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS eu_ldt_integration_profiles_city_idx
  ON ldt_interop.eu_ldt_integration_profiles (city_id, platform_kind, status);

CREATE INDEX IF NOT EXISTS eu_ldt_integration_profiles_capabilities_gin
  ON ldt_interop.eu_ldt_integration_profiles USING gin (capabilities);

COMMENT ON TABLE ldt_interop.eu_ldt_integration_profiles IS
  'Configurable EU LDT Toolbox integration profiles for Data Platform, Play & Visualise, and standards-based OLDT provider targets.';

-- Instance-specific EU LDT profiles are configured after city onboarding.

-- Instance-specific EU LDT profiles are configured after city onboarding.
