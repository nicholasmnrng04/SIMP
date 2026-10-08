ALTER TABLE projects ADD COLUMN daily_report_counter BIGINT NOT NULL DEFAULT 0;
CREATE TABLE daily_reports (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 report_number TEXT NOT NULL, report_date DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','NEEDS_REVISION','APPROVED')),
 edit_version INTEGER NOT NULL DEFAULT 1 CHECK (edit_version > 0),
 plan_version_id TEXT NOT NULL, project_name TEXT NOT NULL, contract_number TEXT NOT NULL,
 general_notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 submitted_at TIMESTAMPTZ,
 UNIQUE(id,project_id), UNIQUE(project_id,report_number), UNIQUE(project_id,report_date,created_by),
 FOREIGN KEY(plan_version_id,project_id) REFERENCES project_plan_versions(id,project_id) ON DELETE RESTRICT
);
CREATE TABLE daily_report_activities (
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL, project_id TEXT NOT NULL, work_item_id TEXT,
 description TEXT NOT NULL CHECK(length(trim(description))>0), location TEXT NOT NULL, quantity NUMERIC(18,6) CHECK(quantity >= 0),
 unit TEXT NOT NULL, work_code TEXT NOT NULL, work_name TEXT NOT NULL, notes TEXT NOT NULL,
 UNIQUE(id,report_id,project_id),
 FOREIGN KEY(report_id,project_id) REFERENCES daily_reports(id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(work_item_id,project_id) REFERENCES work_items(id,project_id) ON DELETE RESTRICT,
 CHECK(quantity IS NULL OR work_item_id IS NOT NULL)
);
CREATE TABLE daily_report_workforce (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT, position INTEGER NOT NULL, data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'));
CREATE TABLE daily_report_weather (LIKE daily_report_workforce INCLUDING ALL);
ALTER TABLE daily_report_weather ADD FOREIGN KEY(report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT;
CREATE TABLE daily_report_materials (LIKE daily_report_workforce INCLUDING ALL);
ALTER TABLE daily_report_materials ADD FOREIGN KEY(report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT;
CREATE TABLE daily_report_problems (LIKE daily_report_workforce INCLUDING ALL);
ALTER TABLE daily_report_problems ADD FOREIGN KEY(report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT;
CREATE TABLE daily_report_photos (
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL, project_id TEXT NOT NULL, activity_id TEXT NOT NULL,
 caption TEXT NOT NULL, location TEXT NOT NULL, taken_date DATE NOT NULL,
 uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 5242880),
 FOREIGN KEY(report_id,project_id) REFERENCES daily_reports(id,project_id) ON DELETE RESTRICT,
 FOREIGN KEY(activity_id,report_id,project_id) REFERENCES daily_report_activities(id,report_id,project_id) ON DELETE RESTRICT
);
CREATE INDEX reports_project_date ON daily_reports(project_id,report_date DESC);
CREATE INDEX activities_report ON daily_report_activities(report_id);
CREATE INDEX photos_report ON daily_report_photos(report_id);
