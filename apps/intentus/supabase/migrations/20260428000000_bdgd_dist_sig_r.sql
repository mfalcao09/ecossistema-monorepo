-- ============================================================================
-- BDGD — colunas oficiais Manual Rev 3 (Anexo III, vigência 2/01/2024)
-- ============================================================================
-- Sessão 155 (2026-04-28) — P-194
--
-- Manual Rev 3 do BDGD (vigência 2/01/2024) inclui no Anexo III a tabela
-- oficial das 116 distribuidoras numeradas DIST 1-116 (pula 71, total 115)
-- com mapeamento SIGLA → COD_ARAT → DIST(SIG-R) → DIST(SARI).
--
-- O cod_aneel que vem do DCAT/título do dataset é o DIST(SARI). Este patch
-- adiciona o DIST(SIG-R) (numeração canônica 1-116) e a sigla oficial.
-- ============================================================================

ALTER TABLE bdgd_distribuidoras
  ADD COLUMN IF NOT EXISTS dist_sig_r    INTEGER,
  ADD COLUMN IF NOT EXISTS sigla_oficial TEXT;

CREATE INDEX IF NOT EXISTS bdgd_distribuidoras_dist_sig_r_idx
  ON bdgd_distribuidoras (dist_sig_r);

COMMENT ON COLUMN bdgd_distribuidoras.dist_sig_r IS
  'DIST(SIG-R) do Manual BDGD Rev3 Anexo III, 1-116. Numeração canônica ANEEL.';
COMMENT ON COLUMN bdgd_distribuidoras.sigla_oficial IS
  'Sigla curta do Manual BDGD Rev3 Anexo III (ex: EMS, CEMIG-D, ENEL SP).';
