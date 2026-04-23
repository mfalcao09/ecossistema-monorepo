-- =============================================================================
-- Atendimento · Expansão do catálogo de widgets (PR B do ADR-020)
-- -----------------------------------------------------------------------------
-- 13 widgets novos oriundos do benchmark Nexvy × outros SaaS
-- (Chatwoot, Digisac, Whaticket, Zaapy, PressTicket).
--
-- Fonte: docs/research/nexvy-outrossaas/CONSOLIDADO-WIDGETS-BENCHMARK.md
--
-- Estrutura:
--   - P1 (10 widgets): dados já disponíveis
--   - P2 (3 widgets):  dados parcialmente disponíveis
--
-- Também cria RPC get_reply_time_heatmap para o widget P2 #1.
--
-- Idempotente: INSERT ... ON CONFLICT (slug) DO UPDATE.
-- =============================================================================

BEGIN;

-- =============================================================================
-- RPC: get_reply_time_heatmap(range_days INTEGER)
-- -----------------------------------------------------------------------------
-- Matriz hora × dia-da-semana de tempos de primeira resposta (em segundos).
-- Usa first_response_sec calculado on-the-fly (não depende de pré-agregado).
-- =============================================================================
CREATE OR REPLACE FUNCTION get_reply_time_heatmap(range_days INTEGER DEFAULT 30)
RETURNS TABLE (
  dow           INTEGER,  -- 0=dom ... 6=sáb
  hour_of_day   INTEGER,  -- 0..23
  avg_sec       INTEGER,
  p50_sec       INTEGER,
  samples       INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH convs AS (
    SELECT
      c.id,
      c.created_at,
      (SELECT MIN(m.created_at)
         FROM atendimento_messages m
        WHERE m.conversation_id = c.id
          AND m.message_type IN ('outgoing','template')
          AND m.sender_type IN ('agent','system')
      ) AS first_reply_at
    FROM atendimento_conversations c
    WHERE c.created_at >= NOW() - (range_days || ' days')::interval
  ),
  clean AS (
    SELECT
      EXTRACT(DOW  FROM created_at)::INTEGER AS dow,
      EXTRACT(HOUR FROM created_at)::INTEGER AS hour_of_day,
      EXTRACT(EPOCH FROM (first_reply_at - created_at))::INTEGER AS sec
    FROM convs
    WHERE first_reply_at IS NOT NULL
      AND first_reply_at > created_at
  )
  SELECT
    dow,
    hour_of_day,
    AVG(sec)::INTEGER AS avg_sec,
    percentile_disc(0.5) WITHIN GROUP (ORDER BY sec)::INTEGER AS p50_sec,
    COUNT(*)::INTEGER AS samples
  FROM clean
  GROUP BY dow, hour_of_day
  ORDER BY dow, hour_of_day;
$$;

COMMENT ON FUNCTION get_reply_time_heatmap(INTEGER) IS
  'ADR-020/PR B: matriz 7×24 de tempo de primeira resposta para heatmap do widget reply_time_heatmap.';

-- =============================================================================
-- Catálogo — 13 widgets novos
-- =============================================================================
INSERT INTO atendimento_widget_catalog
  (slug, label, description, category, widget_type, metric_key, component_slug,
   default_layout, default_config, icon, order_weight, min_permission)
VALUES
  -- ── P1 #1 — agent_workload_live ─────────────────────────────────────────────
  ('agent_workload_live',       'Carga dos Atendentes',
   'Grid de atendentes com status online/pausa/offline e conversas ativas',
    'quality', 'component', NULL, 'agent-workload-live',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{"limit":12}'::jsonb,
    'users', 170, 'dashboard::view'),

  -- ── P1 #2 — live_queue_status ──────────────────────────────────────────────
  ('live_queue_status',         'Filas em Tempo Real',
   'Filas/equipes com quantidade aguardando e tempo médio de espera',
    'status', 'component', NULL, 'live-queue-status',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{}'::jsonb,
    'list-ordered', 180, 'dashboard::view'),

  -- ── P1 #3 — messages_throughput ────────────────────────────────────────────
  ('messages_throughput',       'Mensagens Recebidas × Enviadas',
   'Linhas duplas com volume diário IN vs OUT',
    'chart', 'line_chart', 'messages_in', 'messages-throughput',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'message-circle', 190, 'dashboard::view'),

  -- ── P1 #4 — channel_performance ────────────────────────────────────────────
  ('channel_performance',       'Desempenho por Canal',
   'Comparativo canal × volume × 1ª resposta × resolução',
    'chart', 'table', 'volume_by_inbox', 'channel-performance',
    '{"w":8,"h":3,"minW":6,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'radio', 200, 'dashboard::view'),

  -- ── P1 #5 — kanban_pipeline_mini ───────────────────────────────────────────
  ('kanban_pipeline_mini',      'Pipeline CRM (resumo)',
   'Contagem e valor por estágio do pipeline principal',
    'crm', 'component', NULL, 'kanban-pipeline-mini',
    '{"w":8,"h":3,"minW":6,"minH":2}'::jsonb, '{"pipeline":"default"}'::jsonb,
    'kanban', 210, 'dashboard::view'),

  -- ── P1 #6 — scheduled_messages_pending ─────────────────────────────────────
  ('scheduled_messages_pending','Mensagens Agendadas',
   'Próximas mensagens/templates agendados',
    'activity', 'component', NULL, 'scheduled-messages-pending',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"limit":6}'::jsonb,
    'calendar-clock', 220, 'dashboard::view'),

  -- ── P1 #7 — conversation_funnel ────────────────────────────────────────────
  ('conversation_funnel',       'Funil de Conversas',
   'Created → Replied → Resolved → With deal → Won',
    'chart', 'funnel', NULL, 'conversation-funnel',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'filter', 230, 'dashboard::view'),

  -- ── P1 #8 — transfer_chain_trace ───────────────────────────────────────────
  ('transfer_chain_trace',      'Transferências Recentes',
   'Últimas transferências entre filas/atendentes com motivo',
    'activity', 'component', NULL, 'transfer-chain-trace',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"limit":8}'::jsonb,
    'arrow-right-left', 240, 'dashboard::view'),

  -- ── P1 #9 — quick_replies_usage ────────────────────────────────────────────
  ('quick_replies_usage',       'Respostas Rápidas (uso)',
   'Top templates/respostas-rápidas mais usados no período',
    'activity', 'component', NULL, 'quick-replies-usage',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"range_days":30,"limit":8}'::jsonb,
    'zap', 250, 'dashboard::view'),

  -- ── P1 #10 — automation_execution_audit ────────────────────────────────────
  ('automation_execution_audit','Automações (execução)',
   'Execuções recentes de regras com taxa de sucesso',
    'custom', 'component', NULL, 'automation-execution-audit',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{"range_days":7,"limit":10}'::jsonb,
    'workflow', 260, 'dashboard::view'),

  -- ── P2 #11 — reply_time_heatmap ────────────────────────────────────────────
  ('reply_time_heatmap',        'Mapa de Calor — 1ª Resposta',
   'Matriz hora × dia-da-semana do tempo médio de primeira resposta',
    'chart', 'heatmap', NULL, 'reply-time-heatmap',
    '{"w":8,"h":4,"minW":6,"minH":3}'::jsonb, '{"range_days":30}'::jsonb,
    'grid-3x3', 270, 'dashboard::view'),

  -- ── P2 #12 — classification_tags_cloud ─────────────────────────────────────
  ('classification_tags_cloud', 'Nuvem de Etiquetas',
   'Distribuição visual das etiquetas/tags mais frequentes',
    'chart', 'component', NULL, 'classification-tags-cloud',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"range_days":30,"limit":20}'::jsonb,
    'tag', 280, 'dashboard::view'),

  -- ── P2 #13 — ai_assistant_status ───────────────────────────────────────────
  ('ai_assistant_status',       'Agentes IA (configuração)',
   'Modelo, temperatura e saúde de cada agente DS',
    'agent_ia', 'component', NULL, 'ai-assistant-status',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{}'::jsonb,
    'brain', 290, 'dashboard::view')

ON CONFLICT (slug) DO UPDATE SET
  label          = EXCLUDED.label,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  widget_type    = EXCLUDED.widget_type,
  metric_key     = EXCLUDED.metric_key,
  component_slug = EXCLUDED.component_slug,
  default_layout = EXCLUDED.default_layout,
  default_config = EXCLUDED.default_config,
  icon           = EXCLUDED.icon,
  order_weight   = EXCLUDED.order_weight,
  min_permission = EXCLUDED.min_permission,
  updated_at     = NOW();

COMMIT;
