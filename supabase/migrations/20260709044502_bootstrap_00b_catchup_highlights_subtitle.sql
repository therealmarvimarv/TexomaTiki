DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='highlights' AND column_name='subtitle') THEN
    ALTER TABLE highlights ADD COLUMN subtitle text;
  END IF;
END $$;
