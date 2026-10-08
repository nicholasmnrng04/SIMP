CREATE TABLE roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
) STRICT;

INSERT INTO roles (code, name) VALUES
  ('ADMINISTRATOR', 'Administrator'), ('OWNER', 'Owner'),
  ('TEAM_LEADER', 'Team Leader'), ('ENGINEER', 'Engineer'), ('INSPECTOR', 'Inspector');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES roles(code),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id)
) STRICT;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,
  activity_name TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL CHECK (length(trim(project_name)) > 0),
  location TEXT NOT NULL DEFAULT '',
  fiscal_year INTEGER CHECK (fiscal_year BETWEEN 1900 AND 9999),
  contract_number TEXT NOT NULL DEFAULT '',
  contract_date TEXT,
  initial_contract_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (initial_contract_value_cents BETWEEN 0 AND 9007199254740991),
  current_contract_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (current_contract_value_cents BETWEEN 0 AND 9007199254740991),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT NOT NULL CHECK (date(end_date) IS NOT NULL AND date(end_date) = end_date AND end_date >= start_date),
  duration_days INTEGER GENERATED ALWAYS AS (CAST(julianday(end_date) - julianday(start_date) AS INTEGER) + 1) STORED,
  client_name TEXT NOT NULL DEFAULT '',
  client_agency TEXT NOT NULL DEFAULT '',
  client_agency_address TEXT NOT NULL DEFAULT '',
  consultant_name TEXT NOT NULL DEFAULT '',
  team_leader_id TEXT REFERENCES users(id),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED')),
  status_override TEXT CHECK (status_override IN ('NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED')),
  status_override_reason TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status_override IS NULL OR length(trim(COALESCE(status_override_reason, ''))) > 0)
) STRICT;

CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role_code TEXT NOT NULL REFERENCES roles(code),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT CHECK (end_date IS NULL OR (date(end_date) IS NOT NULL AND date(end_date) = end_date AND end_date >= start_date)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (project_id, user_id, role_code, start_date)
) STRICT;
CREATE INDEX project_members_access ON project_members(user_id, project_id, is_active);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX audit_events_entity ON audit_events(entity_type, entity_id, created_at);
