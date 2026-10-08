ALTER TABLE project_plan_versions
  ADD COLUMN week_convention TEXT NOT NULL DEFAULT 'PROJECT_START'
  CHECK (week_convention IN ('PROJECT_START', 'MONDAY_SUNDAY'));
