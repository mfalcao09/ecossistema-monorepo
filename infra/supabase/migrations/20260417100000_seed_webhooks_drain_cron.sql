-- ================================================================
-- S08 pendências P-005 + P-007
-- P-005: seed webhook_targets (is_active=false — URLs a confirmar no deploy)
-- P-007: drain_dual_write_queue() + pg_cron job a cada minuto
-- ================================================================

-- ----------------------------------------------------------------
-- P-005 — webhook_targets seed (4 providers conhecidos)
-- secret_key = nome da credential em ecosystem_credentials para HMAC
-- target_url = endpoint interno pós-validação (Railway/EF)
-- is_active=false até URL e secret confirmados por provider
-- ----------------------------------------------------------------
INSERT INTO webhook_targets
  (provider, target_url, secret_key, signature_header, hmac_algo, rate_limit_rpm, is_active, metadata)
VALUES
  (
    'inter',
    'https://orchestrator.railway.app/webhooks/inter',
    'INTER_WEBHOOK_SECRET',
    'x-inter-signature',
    'sha256',
    60,
    false,
    '{"doc": "Banco Inter — cobrança e PIX. Secret via magic link vault."}'::jsonb
  ),
  (
    'bry',
    'https://orchestrator.railway.app/webhooks/bry',
    'BRY_WEBHOOK_SECRET',
    'x-bry-signature',
    'sha256',
    30,
    false,
    '{"doc": "BRy Easy Signer — assinaturas digitais."}'::jsonb
  ),
  (
    'stripe',
    'https://orchestrator.railway.app/webhooks/stripe',
    'STRIPE_WEBHOOK_SECRET',
    'stripe-signature',
    'sha256',
    120,
    false,
    '{"doc": "Stripe — pagamentos internacionais."}'::jsonb
  ),
  (
    'evolution',
    'https://orchestrator.railway.app/webhooks/evolution',
    'EVOLUTION_WEBHOOK_SECRET',
    'x-evolution-signature',
    'sha256',
    200,
    false,
    '{"doc": "Evolution API — WhatsApp Business. Alta frequência esperada."}'::jsonb
  )
ON CONFLICT (provider) DO NOTHING;

-- ----------------------------------------------------------------
-- P-007 — drain_dual_write_queue()
-- Processa entradas pending com next_attempt_at <= now().
-- Handles ECOSYSTEM inserts via SQL dinâmico.
-- Cross-project: marca failed com instrução clara.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION drain_dual_write_queue(batch_size int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item        RECORD;
  v_table     text;
  v_op        text;
  v_payload   jsonb;
  processed   int := 0;
  skipped     int := 0;
BEGIN
  FOR item IN
    SELECT *
    FROM dual_write_queue
    WHERE status = 'pending'
      AND next_attempt_at <= now()
    ORDER BY created_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    v_table   := item.mirror_table;
    v_op      := item.mirror_op;
    v_payload := item.mirror_payload->'payload';

    IF item.mirror_project != 'ecosystem' THEN
      UPDATE dual_write_queue SET
        status     = 'failed',
        last_error = format(
          'cross-project mirror (%s) requer drain-mirror-queue EF com %s_SERVICE_ROLE_KEY',
          item.mirror_project, upper(item.mirror_project)
        ),
        updated_at = now()
      WHERE id = item.id;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      IF v_op = 'insert' THEN
        IF jsonb_typeof(v_payload) = 'array' THEN
          EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1)',
            v_table, v_table
          ) USING v_payload;
        ELSE
          EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1)',
            v_table, v_table
          ) USING v_payload;
        END IF;
      ELSE
        RAISE EXCEPTION '% op não suportado no drain SQL — use drain-mirror-queue EF', v_op;
      END IF;

      UPDATE dual_write_queue SET
        status     = 'done',
        updated_at = now()
      WHERE id = item.id;
      processed := processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE dual_write_queue SET
        status          = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
        attempts        = attempts + 1,
        last_error      = SQLERRM,
        next_attempt_at = now() + (interval '1 minute' * LEAST(POWER(2, attempts + 1)::int, 60)),
        updated_at      = now()
      WHERE id = item.id;
      skipped := skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', processed, 'skipped', skipped);
END;
$$;

COMMENT ON FUNCTION drain_dual_write_queue(int) IS
  'P-007: drena dual_write_queue para mirrors ECOSYSTEM com insert. Cross-project e upsert/update/delete: marcar failed — usar drain-mirror-queue EF.';

-- pg_cron — toda vez que já existir, recria
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-dual-write-queue') THEN
    PERFORM cron.unschedule('drain-dual-write-queue');
  END IF;
END $$;

SELECT cron.schedule(
  'drain-dual-write-queue',
  '* * * * *',
  'SELECT drain_dual_write_queue()'
);
