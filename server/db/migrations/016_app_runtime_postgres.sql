CREATE TABLE IF NOT EXISTS app_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_city_registry (
  id integer PRIMARY KEY CHECK (id = 1),
  version integer NOT NULL,
  active_city_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_city_registry_cities (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  sort_order integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_auth_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  status text NOT NULL,
  role text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_city_id text NOT NULL,
  allowed_city_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  activated_at timestamptz,
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  city_id text NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS app_auth_sessions_user_idx
  ON app_auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS app_auth_sessions_expires_idx
  ON app_auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS app_auth_tokens (
  id text PRIMARY KEY,
  kind text NOT NULL,
  user_id text NOT NULL REFERENCES app_auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_auth_tokens_user_kind_idx
  ON app_auth_tokens (user_id, kind);

CREATE INDEX IF NOT EXISTS app_auth_tokens_expires_idx
  ON app_auth_tokens (expires_at);

CREATE TABLE IF NOT EXISTS app_audit_log (
  id text PRIMARY KEY,
  actor_user_id text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_audit_log_created_idx
  ON app_audit_log (created_at);
