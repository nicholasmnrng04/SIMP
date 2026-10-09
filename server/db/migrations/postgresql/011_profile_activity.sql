ALTER TABLE users ADD COLUMN avatar_photo_id TEXT;

CREATE INDEX audit_events_recent ON audit_events(created_at DESC, id DESC);
CREATE INDEX audit_events_project_recent ON audit_events(project_id, created_at DESC, id DESC);
