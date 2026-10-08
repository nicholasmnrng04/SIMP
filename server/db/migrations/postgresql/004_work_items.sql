ALTER TABLE projects ADD COLUMN work_basis_frozen_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN work_basis_frozen_by TEXT REFERENCES users(id);
ALTER TABLE projects ADD COLUMN work_basis_freeze_reason TEXT;
ALTER TABLE projects ADD CONSTRAINT work_basis_freeze_metadata CHECK
  (work_basis_frozen_at IS NULL OR (work_basis_frozen_by IS NOT NULL AND length(trim(COALESCE(work_basis_freeze_reason, ''))) > 0));

CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  parent_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('GROUP', 'ITEM')),
  code TEXT NOT NULL CHECK (length(trim(code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT '',
  contract_volume NUMERIC(18,6) NOT NULL CHECK (contract_volume >= 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  start_date DATE, end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE (project_id, code), UNIQUE (id, project_id),
  FOREIGN KEY (parent_id, project_id) REFERENCES work_items(id, project_id) ON DELETE RESTRICT,
  CHECK (parent_id IS NULL OR parent_id <> id),
  CHECK ((start_date IS NULL AND end_date IS NULL) OR (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)),
  CHECK ((kind = 'GROUP' AND contract_volume = 0 AND unit_price = 0 AND unit = '') OR (kind = 'ITEM' AND length(trim(unit)) > 0))
);
CREATE INDEX work_items_parent ON work_items(project_id, parent_id);
