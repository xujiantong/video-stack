CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE studio_provider AS ENUM ('jimeng');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'disabled', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_kind AS ENUM ('image', 'video', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('uploading', 'ready', 'rejected', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE credential_status AS ENUM ('active', 'revoked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_status AS ENUM ('draft', 'queued', 'running', 'succeeded', 'failed', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  status project_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  user_id uuid NOT NULL REFERENCES users(id),
  kind asset_kind NOT NULL,
  mime_type text NOT NULL,
  name text NOT NULL,
  size_bytes integer NOT NULL,
  duration_ms integer,
  tos_bucket text,
  tos_key text NOT NULL,
  status asset_status NOT NULL DEFAULT 'uploading',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS assets_project_id_idx ON assets (project_id);
CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets (user_id);
CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider studio_provider NOT NULL,
  display_name text NOT NULL,
  encrypted_secret text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  masked_label text NOT NULL,
  status credential_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS provider_credentials_user_id_idx ON provider_credentials (user_id);
CREATE INDEX IF NOT EXISTS provider_credentials_status_idx ON provider_credentials (status);

CREATE TABLE IF NOT EXISTS generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  user_id uuid NOT NULL REFERENCES users(id),
  provider studio_provider NOT NULL,
  prompt_doc jsonb NOT NULL,
  prompt_text text NOT NULL,
  parameters jsonb,
  asset_refs jsonb NOT NULL,
  status generation_status NOT NULL DEFAULT 'draft',
  estimated_cost_cents integer NOT NULL,
  actual_cost_cents integer,
  requires_second_confirm boolean NOT NULL DEFAULT false,
  provider_task_id text,
  result_asset_id uuid REFERENCES assets(id),
  error_code text,
  error_message text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  started_at timestamp,
  finished_at timestamp,
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS generation_tasks_project_id_idx ON generation_tasks (project_id);
CREATE INDEX IF NOT EXISTS generation_tasks_user_id_idx ON generation_tasks (user_id);
CREATE INDEX IF NOT EXISTS generation_tasks_status_idx ON generation_tasks (status);
