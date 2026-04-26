-- Sessão 2026-04-26: tabela append-only `diploma_auditorias` substitui o
-- cache volátil em sessionStorage por persistência forense completa.
-- Cada execução da auditoria de requisitos XSD fica registrada com
-- snapshot integral do resultado, permitindo:
--   • Comparação entre auditorias (issues resolvidas/persistentes/novas)
--   • Histórico cronológico na governança do diploma
--   • Hidratação imediata da UI (sem precisar re-rodar)
--   • Trilha de auditoria pro MEC

CREATE TABLE IF NOT EXISTS diploma_auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id uuid NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  auditado_em timestamptz NOT NULL DEFAULT now(),
  auditado_por uuid,
  -- Snapshot do diploma na hora da auditoria (chave de invalidação).
  diploma_updated_at timestamptz NOT NULL,
  -- Resultado completo da auditoria
  pode_gerar_xml boolean NOT NULL,
  totais jsonb NOT NULL,    -- { criticos, avisos, infos, total }
  grupos jsonb NOT NULL,    -- array de grupos com seus status
  issues jsonb NOT NULL     -- array planificado de issues (pra diff)
);

CREATE INDEX IF NOT EXISTS idx_diploma_auditorias_diploma_id
  ON diploma_auditorias(diploma_id, auditado_em DESC);

CREATE INDEX IF NOT EXISTS idx_diploma_auditorias_diploma_updated_at
  ON diploma_auditorias(diploma_id, diploma_updated_at);

ALTER TABLE diploma_auditorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read auditorias"
  ON diploma_auditorias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only service role can insert auditorias"
  ON diploma_auditorias FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "No deletes on auditorias"
  ON diploma_auditorias FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE diploma_auditorias IS
  'Histórico append-only de auditorias de requisitos XSD. Cada linha = 1
   execução. Permite governança rastreável: quando rodou, o que apontou,
   o que evoluiu entre execuções.';
