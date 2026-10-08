CREATE FUNCTION protect_approved_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'Versi disetujui tidak dapat diubah' USING ERRCODE='23514'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER immutable_approved_report BEFORE UPDATE OR DELETE ON daily_reports FOR EACH ROW EXECUTE FUNCTION protect_approved_report();
CREATE FUNCTION protect_approved_report_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM daily_reports WHERE id=OLD.report_id AND status='APPROVED') THEN
    RAISE EXCEPTION 'Rincian versi disetujui tidak dapat diubah' USING ERRCODE='23514';
  END IF;
  IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM daily_reports WHERE id=NEW.report_id AND status='APPROVED') THEN
    RAISE EXCEPTION 'Rincian versi disetujui tidak dapat diubah' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE child TEXT; BEGIN
  FOREACH child IN ARRAY ARRAY['daily_report_activities','daily_report_photos','daily_report_workforce','daily_report_weather','daily_report_materials','daily_report_problems'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_approved_child BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_approved_report_child()',child);
  END LOOP;
END $$;
