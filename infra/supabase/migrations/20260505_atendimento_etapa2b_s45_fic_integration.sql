-- ═══════════════════════════════════════════════════════════════════════════
-- Etapa 2-B · Sprint S4.5 · Integrações FIC (aluno + pagamento + processo)
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto:
--   Amarra o módulo de atendimento (S4-S11) ao módulo financeiro/acadêmico
--   da FIC existente (`alunos`, `cobrancas` na migration 20260412).
--
--   4 entregas:
--     1. FK `atendimento_contacts.aluno_id → public.alunos(id)` (coluna existia
--        solta desde S4 como UUID — agora vira FK real).
--     2. Coluna `atendimento_deals.aluno_id` + FK.
--     3. Tabela `atendimento_process_types` (CRUD extensível via UI admin) +
--        extensão de `protocols` com `process_type_id` e `aluno_id`.
--     4. Trigger AFTER UPDATE em `atendimento_deals`: quando stage muda pra
--        "Matrícula ativa" do pipeline ALUN, upsert aluno por CPF
--        (`contact_custom_fields.cpf`) + vincula contact + deal.
--
-- Pré-requisitos:
--   - 20260412_financeiro_modulo_init.sql (tabela `alunos`)
--   - 20260421000000_atendimento_s4_kanban.sql (pipelines, stages, deals, protocols)
--
-- Idempotente: todas as operações usam IF NOT EXISTS / DO $$ guards.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. FK atendimento_contacts.aluno_id → public.alunos(id)
-- ───────────────────────────────────────────────────────────────────────────
-- A coluna `aluno_id UUID` já foi criada pela S4 (sem FK porque `alunos`
-- ficava em outro projeto na época). Agora todos no mesmo DB.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='alunos'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='atendimento_contacts'
      AND column_name='aluno_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='fk_atendimento_contacts_aluno'
  ) THEN
    ALTER TABLE public.atendimento_contacts
      ADD CONSTRAINT fk_atendimento_contacts_aluno
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'FK atendimento_contacts.aluno_id adicionada';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_atendimento_contacts_aluno
  ON public.atendimento_contacts(aluno_id)
  WHERE aluno_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. ADD atendimento_deals.aluno_id + FK
-- ───────────────────────────────────────────────────────────────────────────
-- `deals` é a tabela real criada pela S4 com esse nome (não `atendimento_deals`).
-- Verifica qual nome existe e estende.

DO $$
DECLARE
  deals_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deals') THEN
    deals_table := 'deals';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='atendimento_deals') THEN
    deals_table := 'atendimento_deals';
  ELSE
    RAISE NOTICE 'Nenhuma tabela deals encontrada — skip ADD aluno_id';
    RETURN;
  END IF;

  -- ADD COLUMN idempotente
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS aluno_id UUID',
    deals_table
  );

  -- FK (só se `alunos` existe e constraint ainda não)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alunos')
  AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_deals_aluno') THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT fk_deals_aluno
         FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE SET NULL',
      deals_table
    );
    RAISE NOTICE 'FK %.aluno_id adicionada', deals_table;
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%I_aluno ON public.%I(aluno_id) WHERE aluno_id IS NOT NULL',
    deals_table, deals_table
  );
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. atendimento_process_types — tipos de processo acadêmico (CRUD via UI)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.atendimento_process_types (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT        NOT NULL UNIQUE,   -- slug usado em código
  name          TEXT        NOT NULL,          -- label exibido no dropdown
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  account_id    UUID,                          -- multi-tenant futuro (Fase 4)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_types_active
  ON public.atendimento_process_types(is_active, sort_order);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.atendimento_process_types_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_types_touch
  ON public.atendimento_process_types;
CREATE TRIGGER trg_process_types_touch
  BEFORE UPDATE ON public.atendimento_process_types
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_process_types_touch();

-- RLS (permissiva enquanto Fase 1-3; tightening em Fase 4)
ALTER TABLE public.atendimento_process_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='atendimento_process_types'
      AND policyname='process_types_authenticated_all'
  ) THEN
    CREATE POLICY process_types_authenticated_all
      ON public.atendimento_process_types FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='atendimento_process_types'
      AND policyname='process_types_service_role_all'
  ) THEN
    CREATE POLICY process_types_service_role_all
      ON public.atendimento_process_types FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Seed inicial (17 tipos — idempotente via ON CONFLICT key)
INSERT INTO public.atendimento_process_types (key, name, description, sort_order) VALUES
  ('trancamento',               'Trancamento de matrícula',                 'Aluno solicita pausa do vínculo acadêmico',                  10),
  ('destrancamento',            'Destrancamento / reativação',              'Aluno trancado quer reativar o vínculo',                     20),
  ('rematricula',               'Rematrícula semestral',                    'Renovação de matrícula para novo semestre',                  30),
  ('reingresso',                'Reingresso (após evasão)',                 'Aluno evadido solicita retorno',                             40),
  ('transferencia_interna',     'Transferência entre cursos FIC',           'Migração entre cursos da própria FIC',                       50),
  ('transferencia_externa',     'Transferência de/para outra IES',          'Transferência envolvendo outra instituição',                 60),
  ('equivalencia_externa',      'Equivalência de disciplinas externa',      'Aproveitar disciplinas cursadas em outra IES',               70),
  ('aproveitamento_disciplina', 'Aproveitamento interno de disciplina',     'Aproveitar disciplina já cursada internamente',              80),
  ('aproveitamento_horas',      'Horas complementares / atividades',        'Registro de atividades para horas complementares',           90),
  ('revisao_nota',              'Revisão de nota',                          'Contestação formal de nota de prova/trabalho',              100),
  ('segunda_via_historico',     '2ª via de histórico escolar',              'Emissão atualizada do histórico',                          110),
  ('segunda_via_declaracao',    '2ª via de declaração',                     'Declaração de matrícula, vínculo ou conclusão',            120),
  ('segunda_via_diploma',       '2ª via de diploma',                        'Reemissão de diploma já expedido',                         130),
  ('diploma_primeira_via',      '1ª via de diploma',                        'Emissão de diploma para recém-formado',                    140),
  ('alteracao_cadastral',       'Alteração cadastral',                      'Mudança de nome, endereço ou contato',                     150),
  ('solicitacao_documento',     'Outros documentos oficiais',               'Qualquer outro documento oficial institucional',           160),
  ('outros',                    'Outros (descrição obrigatória)',           'Processos não cobertos pelas categorias acima',            999)
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Estender `protocols` com process_type_id + aluno_id
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.protocols
  ADD COLUMN IF NOT EXISTS process_type_id UUID,
  ADD COLUMN IF NOT EXISTS aluno_id        UUID,
  ADD COLUMN IF NOT EXISTS description     TEXT;  -- pra "outros" obrigatório

DO $$
BEGIN
  -- FK process_type_id → atendimento_process_types
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_protocols_process_type') THEN
    ALTER TABLE public.protocols
      ADD CONSTRAINT fk_protocols_process_type
      FOREIGN KEY (process_type_id) REFERENCES public.atendimento_process_types(id)
      ON DELETE RESTRICT;
  END IF;

  -- FK aluno_id → alunos (se tabela existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alunos')
  AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_protocols_aluno') THEN
    ALTER TABLE public.protocols
      ADD CONSTRAINT fk_protocols_aluno
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_protocols_aluno
  ON public.protocols(aluno_id)
  WHERE aluno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_protocols_process_type
  ON public.protocols(process_type_id)
  WHERE process_type_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Trigger Deal → Aluno (upsert automático na entrada em "Matrícula ativa")
-- ───────────────────────────────────────────────────────────────────────────
-- Dispara quando:
--   - deals.stage_id mudou
--   - novo stage é "Matrícula ativa" do pipeline ALUN
-- Comportamento:
--   - contact.aluno_id já preenchido → só espelha no deal
--   - CPF em contact_custom_fields → upsert aluno ON CONFLICT (cpf_norm)
--     + vincula contact + deal
--   - sem CPF → no-op, RAISE WARNING (UI mostra badge "⚠️ Falta CPF")

CREATE OR REPLACE FUNCTION public.atendimento_s45_deal_to_aluno()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_name   TEXT;
  v_pipeline_key TEXT;
  v_contact      RECORD;
  v_cpf_raw      TEXT;
  v_cpf_norm     TEXT;
  v_aluno_id     UUID;
BEGIN
  -- Fast path: só dispara se stage mudou.
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  -- Identifica stage + pipeline do novo stage_id.
  SELECT s.name, p.key
    INTO v_stage_name, v_pipeline_key
    FROM public.pipeline_stages s
    JOIN public.pipelines p ON p.id = s.pipeline_id
    WHERE s.id = NEW.stage_id;

  -- Só age se pipeline ALUN + stage "Matrícula ativa"
  IF v_pipeline_key <> 'ALUN' OR v_stage_name <> 'Matrícula ativa' THEN
    RETURN NEW;
  END IF;

  -- Lê dados do contact
  SELECT id, name, phone_number, email, aluno_id
    INTO v_contact
    FROM public.atendimento_contacts
    WHERE id = NEW.contact_id;

  IF v_contact IS NULL THEN
    RAISE WARNING 'atendimento_s45_deal_to_aluno: contact % não encontrado (deal %)',
                  NEW.contact_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Caso 1: contact já vinculado → só espelha deal.aluno_id
  IF v_contact.aluno_id IS NOT NULL THEN
    NEW.aluno_id := v_contact.aluno_id;
    RETURN NEW;
  END IF;

  -- Busca CPF no custom_fields (normaliza removendo não-dígitos)
  SELECT field_value INTO v_cpf_raw
    FROM public.contact_custom_fields
    WHERE contact_id = v_contact.id AND field_key = 'cpf'
    LIMIT 1;

  v_cpf_norm := regexp_replace(COALESCE(v_cpf_raw, ''), '[^0-9]', '', 'g');

  -- Caso 3: CPF ausente ou inválido → no-op + warning
  IF length(v_cpf_norm) <> 11 THEN
    RAISE WARNING
      'atendimento_s45_deal_to_aluno: deal % entrou em Matrícula ativa mas contact % não tem CPF válido (custom_fields.cpf=%)',
      NEW.id, v_contact.id, v_cpf_raw;
    RETURN NEW;
  END IF;

  -- Caso 2: CPF presente → upsert aluno ON CONFLICT (cpf)
  INSERT INTO public.alunos (nome, cpf, telefone, email, status)
    VALUES (
      v_contact.name,
      v_cpf_norm,
      v_contact.phone_number,
      v_contact.email,
      'ativo'
    )
    ON CONFLICT (cpf) DO UPDATE SET
      nome     = COALESCE(NULLIF(EXCLUDED.nome, ''), public.alunos.nome),
      telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), public.alunos.telefone),
      email    = COALESCE(NULLIF(EXCLUDED.email, ''), public.alunos.email),
      status   = CASE WHEN public.alunos.status = 'inativo' THEN 'ativo' ELSE public.alunos.status END
    RETURNING id INTO v_aluno_id;

  -- Vincula contact e espelha no deal (o NEW é do BEFORE, persiste no commit)
  UPDATE public.atendimento_contacts
    SET aluno_id = v_aluno_id
    WHERE id = v_contact.id;

  NEW.aluno_id := v_aluno_id;

  RAISE NOTICE 'atendimento_s45_deal_to_aluno: deal % → aluno % (cpf %)',
               NEW.id, v_aluno_id, v_cpf_norm;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Usa BEFORE UPDATE pra poder setar NEW.aluno_id (evita segundo UPDATE).
DROP TRIGGER IF EXISTS trg_s45_deal_to_aluno ON public.deals;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deals') THEN
    EXECUTE '
      CREATE TRIGGER trg_s45_deal_to_aluno
        BEFORE UPDATE OF stage_id ON public.deals
        FOR EACH ROW EXECUTE FUNCTION public.atendimento_s45_deal_to_aluno()
    ';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Fim S4.5 FIC integration
-- ═══════════════════════════════════════════════════════════════════════════
