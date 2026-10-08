ALTER TABLE projects ADD COLUMN contractor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD CONSTRAINT project_contractor_name_length CHECK (length(contractor_name) <= 250);
