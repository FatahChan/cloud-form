ALTER TABLE forms ADD COLUMN updated_by TEXT REFERENCES users(id);
UPDATE forms SET updated_by = created_by WHERE updated_by IS NULL;
