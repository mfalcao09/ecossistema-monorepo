-- Sprint 2 / Etapa 1.2 — Callback Railway → Next.js com nonce de 1 uso + lock lógico
--
-- Decisões Marcelo (sessão atual):
--   1C: nonce 1-uso para autenticação do callback (anti-replay)
--   2B: signed URL TTL = 600s (gerenciado em código)
--   3B: lock por processo_id (1 extração ativa por processo); fallback por
--       usuario_id quando o processo ainda não existe (drag-and-drop pré-criação)
--
-- Já aplicada via Supabase MCP em 2026-04-08. Este arquivo é o mirror para
-- versionamento / replicação em ambientes futuros (RLS, branches, etc).
--
-- Compatibilidade: tabela `extracao_sessoes` estava vazia no momento da
-- aplicação, então todas as colunas são nullable e nenhum dado pré-existente
-- precisou ser migrado.

BEGIN;

-- ─── 1. Colunas novas ──────────────────────────────────────────────────────

ALTER TABLE public.extracao_sessoes
  ADD COLUMN IF NOT EXISTS callback_nonce         text,
  ADD COLUMN IF NOT EXISTS callback_nonce_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS iniciado_em            timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_em          timestamptz,
  ADD COLUMN IF NOT EXISTS processing_ms          integer,
  ADD COLUMN IF NOT EXISTS erro_parcial           text;

COMMENT ON COLUMN public.extracao_sessoes.callback_nonce IS
  'Nonce de 1 uso (256 bits hex) embutido na callback_url. Validado em tempo constante e consumido atomicamente via UPDATE...WHERE callback_nonce_used_at IS NULL.';

COMMENT ON COLUMN public.extracao_sessoes.callback_nonce_used_at IS
  'Timestamp de consumo do nonce. NULL = ainda válido. Anti-replay.';

COMMENT ON COLUMN public.extracao_sessoes.iniciado_em IS
  'Quando POST /api/extracao/iniciar criou a sessão e disparou Railway.';

COMMENT ON COLUMN public.extracao_sessoes.finalizado_em IS
  'Quando o callback do Railway atualizou a sessão (sucesso ou erro).';

COMMENT ON COLUMN public.extracao_sessoes.processing_ms IS
  'Duração da extração no Railway, em milissegundos.';

COMMENT ON COLUMN public.extracao_sessoes.erro_parcial IS
  'Mensagens de falha em arquivos individuais quando a extração no agregado teve sucesso (status final = rascunho).';

-- ─── 2. Índice único do nonce (cobertura/lookup) ───────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_extracao_sessoes_callback_nonce
  ON public.extracao_sessoes (callback_nonce)
  WHERE callback_nonce IS NOT NULL;

-- ─── 3. Lock lógico via índice parcial único ──────────────────────────────
--
-- Garante: no máximo 1 sessão com status='processando' por (processo_id),
-- ou por (usuario_id) quando processo_id ainda é NULL.
--
-- Tentativa de criar 2ª sessão pendente para o mesmo processo/usuário falha
-- com código 23505 (unique_violation), tratado como 409 na rota.

CREATE UNIQUE INDEX IF NOT EXISTS idx_extracao_sessoes_lock_processo
  ON public.extracao_sessoes (processo_id)
  WHERE status = 'processando' AND processo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_extracao_sessoes_lock_usuario_sem_processo
  ON public.extracao_sessoes (usuario_id)
  WHERE status = 'processando' AND processo_id IS NULL AND usuario_id IS NOT NULL;

-- ─── 4. Constraint de integridade do nonce ────────────────────────────────
--
-- Não pode existir `callback_nonce_used_at` sem `callback_nonce`.

ALTER TABLE public.extracao_sessoes
  DROP CONSTRAINT IF EXISTS extracao_sessoes_nonce_used_requires_nonce;

ALTER TABLE public.extracao_sessoes
  ADD CONSTRAINT extracao_sessoes_nonce_used_requires_nonce
  CHECK (callback_nonce_used_at IS NULL OR callback_nonce IS NOT NULL);

COMMIT;
