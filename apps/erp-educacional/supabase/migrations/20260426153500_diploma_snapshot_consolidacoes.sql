-- Sessão 2026-04-26: nova tabela `diploma_snapshot_consolidacoes` registra
-- TODAS as consolidações de snapshot (versionamento histórico), não só a
-- corrente. Antes, dados_snapshot_* no `diplomas` era estado corrente —
-- destravar zerava, consolidar sobrescrevia. Resultado: histórico se perdia
-- a cada ciclo travar/destravar/travar.
--
-- Esta tabela é append-only (no deletes) e funciona em conjunto com
-- diploma_unlock_windows (que registra destravamentos). Juntas, formam o
-- histórico completo do snapshot ao longo do tempo.

CREATE TABLE IF NOT EXISTS diploma_snapshot_consolidacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id uuid NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  versao int NOT NULL,
  snapshot_id uuid,
  consolidado_em timestamptz NOT NULL DEFAULT now(),
  consolidado_por uuid,
  -- Cópia integral do snapshot na consolidação — auditoria forense.
  dados_snapshot jsonb NOT NULL,
  CONSTRAINT uq_diploma_versao UNIQUE (diploma_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_diploma_snapshot_consolidacoes_diploma_id
  ON diploma_snapshot_consolidacoes(diploma_id, consolidado_em DESC);

-- RLS — espelha o padrão de diploma_unlock_windows
ALTER TABLE diploma_snapshot_consolidacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read consolidacoes"
  ON diploma_snapshot_consolidacoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only service role can insert consolidacoes"
  ON diploma_snapshot_consolidacoes FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "No deletes on consolidacoes"
  ON diploma_snapshot_consolidacoes FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE diploma_snapshot_consolidacoes IS
  'Histórico append-only de consolidações de snapshot. Cada linha = 1 versão.
   Combinada com diploma_unlock_windows, permite reconstruir cronologia
   completa de ciclos travar/destravar/consolidar do snapshot.';

-- Backfill: pra diplomas atualmente com snapshot consolidado, registra
-- 1 entrada (a versão corrente). Histórico passado de sobrescritas é
-- irrecuperável — só temos o estado atual.
INSERT INTO diploma_snapshot_consolidacoes
  (diploma_id, versao, snapshot_id, consolidado_em, consolidado_por, dados_snapshot)
SELECT
  id,
  COALESCE(dados_snapshot_versao, 1),
  NULLIF(dados_snapshot_extracao->>'snapshot_id', '')::uuid,
  COALESCE(dados_snapshot_gerado_em, dados_snapshot_travado_em, now()),
  dados_snapshot_travado_por,
  dados_snapshot_extracao
FROM diplomas
WHERE dados_snapshot_extracao IS NOT NULL
  AND is_legado = false
ON CONFLICT (diploma_id, versao) DO NOTHING;
