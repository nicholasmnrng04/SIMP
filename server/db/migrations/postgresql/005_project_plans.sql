CREATE TABLE project_plan_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  is_baseline BOOLEAN NOT NULL,
  previous_version_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  description TEXT NOT NULL DEFAULT '',
  effective_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date AND end_date - start_date < 3660),
  granularity TEXT NOT NULL CHECK (granularity IN ('WEEKLY','MONTHLY')),
  basis_token TEXT NOT NULL,
  basis JSONB NOT NULL CHECK (jsonb_typeof(basis) = 'array'),
  changed_item_ids JSONB NOT NULL CHECK (jsonb_typeof(changed_item_ids) = 'array'),
  schedule_changed BOOLEAN NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, version_number), UNIQUE (project_id, effective_date), UNIQUE (id, project_id),
  FOREIGN KEY (previous_version_id, project_id) REFERENCES project_plan_versions(id, project_id) ON DELETE RESTRICT,
  CHECK ((is_baseline AND version_number = 1 AND previous_version_id IS NULL) OR (NOT is_baseline AND version_number > 1 AND previous_version_id IS NOT NULL)),
  CHECK (effective_date BETWEEN start_date AND end_date)
);
CREATE UNIQUE INDEX one_plan_baseline ON project_plan_versions(project_id) WHERE is_baseline;
CREATE TABLE project_plan_items (
  plan_version_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  targets JSONB NOT NULL CHECK (jsonb_typeof(targets) = 'array'),
  PRIMARY KEY (plan_version_id, work_item_id),
  FOREIGN KEY (plan_version_id, project_id) REFERENCES project_plan_versions(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (work_item_id, project_id) REFERENCES work_items(id, project_id) ON DELETE RESTRICT
);
CREATE FUNCTION reject_published_plan_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Rencana terbit tidak dapat diubah atau dihapus; buat versi baru.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_plan_versions BEFORE UPDATE OR DELETE ON project_plan_versions FOR EACH ROW EXECUTE FUNCTION reject_published_plan_change();
CREATE TRIGGER immutable_plan_items BEFORE UPDATE OR DELETE ON project_plan_items FOR EACH ROW EXECUTE FUNCTION reject_published_plan_change();
