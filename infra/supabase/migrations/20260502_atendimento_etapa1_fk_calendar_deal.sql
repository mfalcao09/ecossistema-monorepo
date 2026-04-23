-- ═══════════════════════════════════════════════════════════════════════════
-- Etapa 1-D · P-068 · FK atendimento_calendar_events.deal_id → deals
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto:
--   A S5 (Templates + Agendamentos, PR #46) criou a coluna
--   `atendimento_calendar_events.deal_id UUID` como UUID solto porque a
--   tabela `deals` ainda não existia. A S4 (Kanban CRM, PR #44) criou
--   `deals` depois. Agora que ambas estão em main, podemos adicionar a FK.
--
-- Regra: `ON DELETE SET NULL` — deletar deal NÃO deleta histórico de
-- eventos Google Calendar.
--
-- Pré-requisitos:
--   - `atendimento_calendar_events` existe (S5)
--   - `deals` existe (S4, via infra/supabase/migrations/20260421000000_atendimento_s4_kanban.sql)
--
-- Rollback seguro:
--   ALTER TABLE public.atendimento_calendar_events
--     DROP CONSTRAINT IF EXISTS fk_calendar_events_deal;
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Só adiciona FK se as tabelas existirem e a constraint ainda não existir.
-- Isso deixa a migration idempotente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deals'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atendimento_calendar_events'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_calendar_events_deal'
      AND table_name = 'atendimento_calendar_events'
  ) THEN
    -- Validar que não há deal_id órfãos antes de adicionar a FK (fail-fast).
    -- Se houver, a constraint falha e avisa qual deal_id não existe em deals.
    EXECUTE '
      ALTER TABLE public.atendimento_calendar_events
        ADD CONSTRAINT fk_calendar_events_deal
        FOREIGN KEY (deal_id)
        REFERENCES public.deals(id)
        ON DELETE SET NULL
    ';
    RAISE NOTICE 'FK fk_calendar_events_deal adicionada com sucesso.';
  ELSE
    RAISE NOTICE 'FK fk_calendar_events_deal já existe OU tabelas precursoras ausentes — skip.';
  END IF;
END $$;

-- Sanity check: listar deal_id órfãos (caso precise limpar antes)
-- SELECT id, deal_id FROM public.atendimento_calendar_events
--   WHERE deal_id IS NOT NULL
--     AND deal_id NOT IN (SELECT id FROM public.deals);
