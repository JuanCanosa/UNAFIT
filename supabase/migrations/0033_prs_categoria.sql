-- Adiciona coluna categoria à tabela prs para suportar 4 categorias (rx/intermediario/scaled/iniciante)
-- Mantém rx BOOLEAN para compatibilidade com código existente

ALTER TABLE prs ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Migra dados existentes: rx=true → 'rx', rx=false → 'scaled'
UPDATE prs SET categoria = CASE WHEN rx THEN 'rx' ELSE 'scaled' END WHERE categoria IS NULL;
