-- Adiciona colunas que o código já usa mas que não foram criadas na migration original.
-- Sem estas colunas, o INSERT em pagamentos falha silenciosamente sempre que
-- um plano é atribuído a um aluno com Asaas configurado.

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS descricao          TEXT,
  ADD COLUMN IF NOT EXISTS mes_referencia     DATE,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_copia_cola     TEXT,
  ADD COLUMN IF NOT EXISTS boleto_url         TEXT,
  ADD COLUMN IF NOT EXISTS boleto_linha       TEXT;
