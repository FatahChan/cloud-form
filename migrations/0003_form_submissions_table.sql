ALTER TABLE forms ADD COLUMN submissions_table TEXT;
UPDATE forms SET submissions_table = 'f_' || lower(replace(id, '-', '')) WHERE submissions_table IS NULL;
