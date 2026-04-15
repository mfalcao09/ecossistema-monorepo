# LGPD Asynchronous Data Purge — Deployment Guide

**Status:** Ready for Production
**Date:** 2026-03-26
**Components:** Database Migration + Edge Function + Frontend Integration

---

## Quick Start

### 1. Apply Database Migration

```bash
# Via Supabase CLI
supabase migration up

# Or manually in Supabase Studio:
# - Copy contents of supabase/migrations/20260326_lgpd_purge_tables.sql
# - Paste into SQL editor
# - Click "RUN"
```

### 2. Deploy Edge Function

```bash
# Via Supabase CLI
supabase functions deploy lgpd-purge

# Verify deployment
supabase functions list
```

### 3. Test Invocation

```bash
# Test locally
supabase functions serve

# In another terminal
curl -X POST http://localhost:54321/functions/v1/lgpd-purge \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "retention"}'
```

---

## Step-by-Step Deployment

### Step 1: Database Setup

**File:** `supabase/migrations/20260326_lgpd_purge_tables.sql`

This migration creates:
- `lgpd_purge_queue` — Requisições de purga a processar
- `lgpd_purge_log` — Auditoria imutável de purgas
- `lgpd_retencao_config` — Políticas de retenção
- Índices e RLS policies
- 5 políticas iniciais de retenção
- Helper function `anonimizar_registro()`
- View `v_lgpd_purge_status` para monitoramento
- Trigger para auditoria automática

**Verification:**
```sql
-- Check tables created
SELECT tablename FROM pg_tables WHERE tablename LIKE 'lgpd_%';

-- Check initial policies loaded
SELECT tabela, dias_retencao, acao FROM lgpd_retencao_config;

-- Expected output:
-- audit_trail        | 90    | excluir
-- ia_usage_log       | 90    | excluir
-- portal_logs_consulta | 365 | anonimizar
-- extracao_sessoes   | 30    | excluir
-- config_audit_log   | 365   | excluir
```

### Step 2: Edge Function Setup

**Files:**
- `supabase/functions/lgpd-purge/index.ts` — Main handler (Deno)
- `supabase/functions/lgpd-purge/deno.json` — Dependencies

**Function Features:**
- Processes pending purge queue (LIMIT 50 per run)
- Executes expired retention policies
- Supports 3 purge modes: `auto`, `queue`, `retention`
- Batch processing (50 records per batch)
- Full error handling & logging
- Returns detailed response with metrics

**Deploy:**
```bash
cd /path/to/ERP-Educacional
supabase functions deploy lgpd-purge --no-verify-jwt
```

**Environment Variables (in `.env` or Supabase dashboard):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (your service role key)
```

### Step 3: Configure Cron Scheduling

**Option A: Vercel Cron** (Recommended)

Edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/lgpd-purge",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Create API route `src/app/api/cron/lgpd-purge/route.ts`:
```typescript
import { executarPurgaLGPD } from '@/lib/lgpd'

export async function POST(req: Request) {
  // Validate Vercel Cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const resultado = await executarPurgaLGPD('auto')
    console.log('[CRON] LGPD Purge completed:', resultado)
    return Response.json(resultado)
  } catch (error) {
    console.error('[CRON] LGPD Purge failed:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

**Option B: Supabase Webhooks**

1. Create HTTP webhook trigger on schedule
2. POST to: `https://your-function-url/functions/v1/lgpd-purge`
3. Body: `{"mode": "auto"}`

**Option C: External Cron Service (Zapier/Make)**

1. Set up schedule in Zapier
2. Action: Send HTTP request
3. URL: `https://your-project.supabase.co/functions/v1/lgpd-purge`
4. Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
5. Body: `{"mode": "auto"}`

### Step 4: Frontend Integration

**Files Created:**
- `src/lib/lgpd/types.ts` — TypeScript types & interfaces
- `src/lib/lgpd/actions.ts` — Server actions (use server)
- `src/lib/lgpd/index.ts` — Public API

**Usage in Components:**

```typescript
'use client'

import { useState } from 'react'
import {
  solicitarExclusaoUsuario,
  executarPurgaLGPD,
  buscarRequisioesRecentes,
  obterStatusFilaPurga,
} from '@/lib/lgpd'

export function AdminPurgePanel() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function handlePurgeUsuario(userId: string) {
    setLoading(true)
    try {
      // 1. Criar requisição de purga
      const req = await solicitarExclusaoUsuario(userId, 'Manual request from admin')
      console.log('Purge request created:', req)

      // 2. Disparar processamento (opcional)
      const resultado = await executarPurgaLGPD('auto')
      setResultado(resultado)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleMonitorarFila() {
    const status = await obterStatusFilaPurga()
    console.log('Queue status:', status)
  }

  return (
    <div>
      <button onClick={() => handlePurgeUsuario('user-id')} disabled={loading}>
        Solicitar Exclusão de Usuário
      </button>
      <button onClick={handleMonitorarFila}>Verificar Fila</button>
      {resultado && <pre>{JSON.stringify(resultado, null, 2)}</pre>}
    </div>
  )
}
```

---

## Configuration Files Summary

### Criados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/20260326_lgpd_purge_tables.sql` | SQL Migration | Tabelas, índices, RLS, políticas iniciais |
| `supabase/functions/lgpd-purge/index.ts` | Edge Function | Handler principal (Deno/TypeScript) |
| `supabase/functions/lgpd-purge/deno.json` | Config | Dependências Deno |
| `src/lib/lgpd/types.ts` | TypeScript | Tipos e interfaces compartilhadas |
| `src/lib/lgpd/actions.ts` | Server Actions | Funções para frontend invocar |
| `src/lib/lgpd/index.ts` | Module Export | API pública do módulo |
| `docs/LGPD-PURGE-IMPLEMENTATION.md` | Documentation | Documentação técnica completa |

### A Modificar

| Arquivo | Mudança | Exemplo |
|---------|---------|---------|
| `vercel.json` | Adicionar cron | `"crons": [{"path": "/api/cron/lgpd-purge", "schedule": "0 2 * * *"}]` |
| `src/app/api/cron/lgpd-purge/route.ts` | Criar novo | Ver "Step 3" acima |
| `.env.local` (dev) | Adicionar SECRET | `CRON_SECRET=your-random-secret` |
| `.env.production` (Vercel) | Adicionar SECRET | Mesmo que acima em Vercel dashboard |

---

## Testing Checklist

### Unit Tests

```typescript
// __tests__/lib/lgpd.test.ts
import { describe, it, expect } from 'vitest'
import {
  createPurgeRequestPayload,
  formatDuration,
  createExclusaoContext,
} from '@/lib/lgpd/types'

describe('LGPD Utils', () => {
  it('should format duration correctly', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.50s')
  })

  it('should create exclusao context with timestamp', () => {
    const ctx = createExclusaoContext('User requested deletion', 'admin-123')
    expect(ctx.motivo).toBe('User requested deletion')
    expect(ctx.timestamp).toBeDefined()
  })
})
```

### Integration Tests

```bash
# 1. Test Edge Function locally
supabase functions serve

# 2. In another terminal, test request
curl -X POST http://localhost:54321/functions/v1/lgpd-purge \
  -H "Authorization: Bearer eyJh..." \
  -H "Content-Type: application/json" \
  -d '{"mode": "queue"}'

# 3. Check queue status
SELECT COUNT(*) FROM lgpd_purge_queue WHERE status = 'concluido';
```

### Manual Testing in Admin Panel

1. **Create Test User**
   ```sql
   INSERT INTO auth.users (email, encrypted_password)
   VALUES ('test-lgpd@example.com', ...);
   ```

2. **Request Deletion**
   - Go to Admin Panel → LGPD Management
   - Click "Request User Deletion"
   - Select test user
   - Submit

3. **Monitor Queue**
   - Watch `lgpd_purge_queue` table
   - Status should be: `pendente` → `processando` → `concluido`

4. **Verify Logs**
   ```sql
   SELECT * FROM lgpd_purge_log
   WHERE purge_queue_id = 'test-id'
   ORDER BY executado_em DESC;
   ```

5. **Check Audit Trail**
   ```sql
   SELECT * FROM audit_trail
   WHERE acao = 'lgpd_purge_completed'
   ORDER BY criado_em DESC LIMIT 5;
   ```

---

## Monitoring & Maintenance

### Daily Health Check

```sql
-- 1. Pending requests (should be processed within 1 hour)
SELECT COUNT(*) as pendentes FROM lgpd_purge_queue
WHERE status = 'pendente' AND criado_em < NOW() - INTERVAL '1 hour';

-- 2. Failed requests (investigate)
SELECT id, tipo, alvo_user_id, erro_mensagem
FROM lgpd_purge_queue
WHERE status = 'erro'
ORDER BY criado_em DESC LIMIT 10;

-- 3. Retention policies not running
SELECT tabela, dias_retencao, acao
FROM lgpd_retencao_config
WHERE ativo = true AND tabela NOT IN (
  SELECT DISTINCT tabela FROM lgpd_purge_log
  WHERE DATE(executado_em) = CURRENT_DATE
);

-- 4. Total records purged today
SELECT
  COALESCE(SUM(registros_afetados), 0) as total_purgado,
  COUNT(DISTINCT purge_queue_id) as requisicoes
FROM lgpd_purge_log
WHERE DATE(executado_em) = CURRENT_DATE;
```

### Weekly Report

```typescript
// Generate summary
import { gerarRelatorioPurgas } from '@/lib/lgpd'

const hoje = new Date()
const semanaAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)

const relatorio = await gerarRelatorioPurgas(semanaAtras, hoje)
console.log(relatorio)

// Output:
// {
//   periodo: { inicio: '...', fim: '...' },
//   total_requisicoes: 5,
//   total_registros_purgados: 1250,
//   tempo_medio_processamento_ms: 3420,
//   taxa_sucesso_percent: 100,
//   detalhes_por_tabela: { audit_trail: {...} }
// }
```

### Alerting

Set up alerts in your monitoring tool (DataDog, New Relic, etc.):

```
Alert 1: IF lgpd_purge_queue.status='erro' count > 5 in 1 hour → Page on-call
Alert 2: IF lgpd_purge_queue.status='pendente' AND age > 2 hours → Investigate
Alert 3: IF purge_queue → total_registros_purgados/day > 10000 → Monitor
```

---

## Troubleshooting

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Cause:** Edge Function can't find environment variable.

**Fix:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy "Service Role Key" (labeled `service_role`)
3. Set environment variable in Vercel/deployment platform
4. Redeploy function

### Error: "Failed to fetch pending purge requests"

**Cause:** RLS policy blocked access.

**Fix:**
```sql
-- Ensure Service Role has access
SELECT * FROM lgpd_purge_queue;  -- Should work as service role

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'lgpd_purge_queue';
```

### Edge Function Times Out

**Cause:** Processing too many records at once.

**Fix:** Reduce `BATCH_SIZE` in `index.ts` or configure function timeout:
```bash
supabase functions deploy lgpd-purge \
  --memory 512 \
  --timeout 120
```

### Cron Not Running

**Cause:** Vercel cron not configured or secret mismatch.

**Fix:**
```bash
# Verify in Vercel
vercel logs --follow

# Check if route exists
curl -X POST https://your-app.vercel.app/api/cron/lgpd-purge \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Should return 200, not 401/404
```

---

## Performance Tuning

### Optimize Edge Function

```typescript
// In index.ts, adjust:
const BATCH_SIZE = 100  // Up from 50 for larger tables
const MAX_CONCURRENT_OPERATIONS = 10  // Parallel processing
```

### Add Database Indexes

Already included in migration, but if needed:
```sql
-- Partial index for pending/processing
CREATE INDEX idx_lgpd_queue_active
ON lgpd_purge_queue(criado_em DESC)
WHERE status IN ('pendente', 'processando');

-- Composite for retention query
CREATE INDEX idx_lgpd_retencao_search
ON lgpd_retencao_config(ativo, tabela, dias_retencao);
```

---

## Rollback Plan

If something goes wrong in production:

### Option 1: Pause Purges (No Data Loss)
```sql
-- Disable all retention policies
UPDATE lgpd_retencao_config SET ativo = false;

-- Edge Function will skip retention, queue still works
-- Admin can manually re-enable policies
```

### Option 2: Restore from Backup
```bash
# Supabase automatically backs up daily
# Go to Supabase Dashboard → Database → Backups
# Restore to point-in-time before migration
```

### Option 3: Partial Rollback (Keep Logs, Remove Tables)
```bash
# Drop lgpd_purge_queue and lgpd_retencao_config
# Keep lgpd_purge_log for audit trail
supabase db reset  # Or selective DROP TABLE
```

---

## Production Checklist

- [ ] Database migration applied successfully
- [ ] Edge Function deployed and tested locally
- [ ] Cron job configured in Vercel/scheduler
- [ ] Environment variables set in production
- [ ] API routes created (`/api/cron/lgpd-purge`)
- [ ] Frontend integration tested (create purge request)
- [ ] Admin panel UI added (LGPD management section)
- [ ] Monitoring queries created
- [ ] Alerts configured
- [ ] Documentation shared with team
- [ ] Backup plan tested
- [ ] First cron run monitored (check logs)

---

## Support & Questions

For issues with this implementation:
1. Check `LGPD-PURGE-IMPLEMENTATION.md` for technical details
2. Review error logs: `lgpd_purge_queue.erro_mensagem`
3. Query `lgpd_purge_log` for execution history
4. Contact Diploma Digital team

---

**Version:** 1.0
**Last Updated:** 2026-03-26
**Status:** Production Ready
