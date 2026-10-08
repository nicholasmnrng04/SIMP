ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN archived_by TEXT REFERENCES users(id);
ALTER TABLE projects ADD COLUMN archive_reason TEXT;
ALTER TABLE projects ADD CONSTRAINT project_archive_reason CHECK
  (archived_at IS NULL OR (archived_by IS NOT NULL AND length(trim(COALESCE(archive_reason, ''))) > 0));
ALTER TABLE project_members ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE project_members ADD COLUMN updated_by TEXT REFERENCES users(id);
CREATE INDEX project_members_project ON project_members(project_id, user_id);
CREATE INDEX projects_archived ON projects(archived_at);
