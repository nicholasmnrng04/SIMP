CREATE TABLE roles (code TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
INSERT INTO roles (code, name) VALUES
  ('ADMINISTRATOR', 'Administrator'), ('OWNER', 'Owner'),
  ('TEAM_LEADER', 'Team Leader'), ('ENGINEER', 'Engineer'), ('INSPECTOR', 'Inspector');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES roles(code),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id), updated_by TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE projects (
  id TEXT PRIMARY KEY, project_code TEXT NOT NULL UNIQUE,
  activity_name TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL CHECK (length(trim(project_name)) > 0),
  location TEXT NOT NULL DEFAULT '',
  fiscal_year INTEGER CHECK (fiscal_year BETWEEN 1900 AND 9999),
  contract_number TEXT NOT NULL DEFAULT '', contract_date DATE,
  initial_contract_value_cents BIGINT NOT NULL DEFAULT 0 CHECK (initial_contract_value_cents BETWEEN 0 AND 9007199254740991),
  current_contract_value_cents BIGINT NOT NULL DEFAULT 0 CHECK (current_contract_value_cents BETWEEN 0 AND 9007199254740991),
  start_date DATE NOT NULL, end_date DATE NOT NULL CHECK (end_date >= start_date),
  duration_days INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  client_name TEXT NOT NULL DEFAULT '', client_agency TEXT NOT NULL DEFAULT '',
  client_agency_address TEXT NOT NULL DEFAULT '', consultant_name TEXT NOT NULL DEFAULT '',
  team_leader_id TEXT REFERENCES users(id), timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED')),
  status_override TEXT CHECK (status_override IN ('NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED')),
  status_override_reason TEXT, description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status_override IS NULL OR length(trim(COALESCE(status_override_reason, ''))) > 0)
);

CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id),
  role_code TEXT NOT NULL REFERENCES roles(code), start_date DATE NOT NULL,
  end_date DATE CHECK (end_date IS NULL OR end_date >= start_date),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, user_id, role_code, start_date)
);
CREATE INDEX project_members_access ON project_members(user_id, project_id, is_active);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), project_id TEXT REFERENCES projects(id),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_events_entity ON audit_events(entity_type, entity_id, created_at);
