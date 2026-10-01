-- QC Maestro server storage contract.
-- Apply this migration only to the QC Maestro database, never to a target app database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS qc_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS qc_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES qc_users(id),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('existing-target', 'local-folder', 'github')),
  repository_url text,
  source_path text,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS qc_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES qc_projects(id),
  owner_id uuid NOT NULL REFERENCES qc_users(id),
  status text NOT NULL,
  phase text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS qc_business_flow_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES qc_runs(id) ON DELETE CASCADE,
  flow_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  definition jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'BLOCKED')),
  edited_by uuid REFERENCES qc_users(id),
  approved_by uuid REFERENCES qc_users(id),
  edited_at timestamptz,
  approved_at timestamptz,
  UNIQUE (run_id, flow_id, version)
);

CREATE TABLE IF NOT EXISTS qc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES qc_runs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('json', 'html', 'pdf', 'quality', 'timeline')),
  payload jsonb,
  storage_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind)
);

CREATE TABLE IF NOT EXISTS qc_evidence_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES qc_runs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('screenshot', 'video', 'trace', 'log', 'report', 'clone')),
  storage_key text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS qc_artifact_policies (
  id boolean PRIMARY KEY DEFAULT true,
  clone_days integer NOT NULL DEFAULT 7 CHECK (clone_days > 0),
  artifact_days integer NOT NULL DEFAULT 30 CHECK (artifact_days > 0),
  max_active_projects integer NOT NULL DEFAULT 2 CHECK (max_active_projects BETWEEN 1 AND 2),
  updated_by uuid REFERENCES qc_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO qc_artifact_policies (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS qc_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES qc_users(id),
  project_id uuid REFERENCES qc_projects(id),
  run_id uuid REFERENCES qc_runs(id),
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qc_projects_owner_idx ON qc_projects(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qc_runs_owner_idx ON qc_runs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qc_runs_project_idx ON qc_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qc_evidence_expiry_idx ON qc_evidence_assets(expires_at);
CREATE INDEX IF NOT EXISTS qc_audit_events_project_idx ON qc_audit_events(project_id, created_at DESC);
