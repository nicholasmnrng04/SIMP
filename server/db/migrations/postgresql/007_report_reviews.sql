ALTER TABLE daily_reports ADD COLUMN logical_id TEXT;
UPDATE daily_reports SET logical_id=id;
ALTER TABLE daily_reports ALTER COLUMN logical_id SET NOT NULL;
ALTER TABLE daily_reports ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0);
ALTER TABLE daily_reports ADD COLUMN previous_report_id TEXT;
ALTER TABLE daily_reports ADD COLUMN correction_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE daily_reports DROP CONSTRAINT daily_reports_project_id_report_date_created_by_key;
ALTER TABLE daily_reports DROP CONSTRAINT daily_reports_project_id_report_number_key;
ALTER TABLE daily_reports ADD UNIQUE(project_id,report_number,revision);
ALTER TABLE daily_reports ADD UNIQUE(logical_id,revision);
ALTER TABLE daily_reports ADD UNIQUE(logical_id,id,project_id);
ALTER TABLE daily_reports ADD FOREIGN KEY(logical_id,project_id) REFERENCES daily_reports(id,project_id);
ALTER TABLE daily_reports ADD FOREIGN KEY(previous_report_id,project_id) REFERENCES daily_reports(id,project_id);
ALTER TABLE daily_reports ADD CHECK ((revision=1 AND logical_id=id AND previous_report_id IS NULL) OR (revision>1 AND logical_id<>id AND previous_report_id IS NOT NULL AND length(trim(correction_reason))>=3));
CREATE UNIQUE INDEX daily_report_identity ON daily_reports(project_id,report_date,created_by) WHERE revision=1;
CREATE UNIQUE INDEX daily_report_pending_revision ON daily_reports(logical_id) WHERE status<>'APPROVED';

-- Exactly one authoritative revision per logical report. T07 must join this table.
CREATE TABLE approved_report_sources (
  logical_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  FOREIGN KEY(logical_id,report_id,project_id) REFERENCES daily_reports(logical_id,id,project_id) ON DELETE RESTRICT
);
INSERT INTO approved_report_sources SELECT logical_id,id,project_id FROM daily_reports WHERE status='APPROVED';
CREATE TABLE report_reviews (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('TECHNICAL_NOTE','APPROVE','REQUEST_CHANGES')),
  edit_version INTEGER NOT NULL,
  note TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id,edit_version)
);
CREATE INDEX report_review_history ON report_reviews(report_id,created_at);
CREATE FUNCTION check_approved_report_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM daily_reports WHERE id=NEW.report_id AND status='APPROVED') THEN
    RAISE EXCEPTION 'Sumber resmi harus disetujui' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approved_source_guard BEFORE INSERT OR UPDATE ON approved_report_sources FOR EACH ROW EXECUTE FUNCTION check_approved_report_source();
