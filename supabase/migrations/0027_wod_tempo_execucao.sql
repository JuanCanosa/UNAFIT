-- Add time cap and AMRAP duration to WODs
ALTER TABLE wods ADD COLUMN IF NOT EXISTS time_cap_min INTEGER;
ALTER TABLE wods ADD COLUMN IF NOT EXISTS duracao_min  INTEGER;
