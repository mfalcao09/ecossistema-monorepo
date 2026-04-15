# LGPD Asynchronous Data Purge Implementation

**Projeto:** Diploma Digital FIC — ERP Educacional
**Data:** 2026-03-26
**Status:** Ready for deployment
**Compliance:** LGPD (Lei 13.709/2018), Portarias MEC 554/2019 e 70/2025

---

## Overview

Este documento descreve a implementação completa do sistema de **purga assíncrona de dados LGPD** para o ERP Educacional FIC. O sistema atende aos requisitos de compliance da Lei Geral de Proteção de Dados (LGPD) brasileira, permitindo:

1. **Direito ao Esquecimento** — Exclusão completa de dados pessoais de um usuário
2. **Retenção Automática** — Purga de dados expirados conforme políticas predefinidas
3. **Retirada de Consentimento** — Remoção de dados associados a consentimento retirado
4. **Auditoria Completa** — Rastreamento de todas as operações para compliance

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      ERP Educacional FIC                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Next.js)                                          │
│  └─ Admin Panel                                              │
│     └─ Requisição de Purga                                   │
│        └─ POST /api/lgpd/request-purge                       │
│                                                               │
│  Database (Supabase PostgreSQL)                              │
│  ├─ lgpd_purge_queue          (Fila de requisições)         │
│  ├─ lgpd_purge_log            (Auditoria de purgas)         │
│  ├─ lgpd_retencao_config      (Políticas de retenção)       │
│  └─ audit_trail               (Trilha geral de auditoria)    │
│                                                               │
│  Supabase Edge Function (Deno)                               │
│  └─ POST /functions/v1/lgpd-purge                            │
│     ├─ Processa fila pendente                                │
│     ├─ Executa retenção expirada                             │
│     ├─ Anonimiza ou deleta registros                         │
│     └─ Retorna relatório de purga                            │
│                                                               │
│  Scheduling                                                   │
│  ├─ Cron (Vercel): 0 2 * * * (2 AM UTC diariamente)         │
│  ├─ On-Demand: Botão no Admin Panel                          │
│  └─ Webhook: POST via Zapier/Make                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. `lgpd_purge_queue` — Fila de Requisições

Armazena requisições de purga a processar.

```sql
CREATE TABLE lgpd_purge_queue (
  id UUID PRIMARY KEY,
  tipo TEXT NOT NULL,                 -- 'retencao' | 'exclusao' | 'consentimento'
  alvo_user_id UUID,                  -- Para exclusão de usuário
  alvo_tabela TEXT,                   -- Tabela alvo
  alvo_registro_id TEXT,              -- Registro específico (opcional)
  status TEXT DEFAULT 'pendente',     -- 'pendente' | 'processando' | 'concluido' | 'erro'
  contexto JSONB,                     -- Metadados da requisição
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  erro_mensagem TEXT
);
```

**Campos:**
- `tipo`: Classifica o tipo de purga (retenção automática, exclusão de usuário, consentimento)
- `status`: Pipeline de processamento (pendente → processando → concluido/erro)
- `contexto`: JSONB flexível para metadados (ex: motivo, campo_consentimento, etc.)

---

### 2. `lgpd_purge_log` — Auditoria de Purgas

Log imutável de todas as purgas executadas.

```sql
CREATE TABLE lgpd_purge_log (
  id UUID PRIMARY KEY,
  purge_queue_id UUID NOT NULL REFERENCES lgpd_purge_queue(id),
  tabela TEXT NOT NULL,               -- Qual tabela foi purgada
  coluna TEXT,                        -- Qual coluna (se aplicável)
  registros_afetados INTEGER,         -- Quantos registros
  acao TEXT NOT NULL,                 -- 'anonimizado' | 'excluido'
  detalhes JSONB,                     -- Contexto adicional
  executado_em TIMESTAMPTZ DEFAULT NOW()
);
```

**Propósito:** Compliance auditável — prova de que LGPD foi executada.

---

### 3. `lgpd_retencao_config` — Políticas de Retenção

Define regras automáticas de purga por tabela.

```sql
CREATE TABLE lgpd_retencao_config (
  id UUID PRIMARY KEY,
  tabela TEXT NOT NULL,               -- Ex: 'audit_trail'
  coluna_data TEXT NOT NULL,          -- Ex: 'created_at'
  dias_retencao INTEGER NOT NULL,     -- Ex: 90 (em dias)
  acao TEXT DEFAULT 'anonimizar',     -- 'anonimizar' | 'excluir'
  campos_anonimizar TEXT[],           -- ARRAY['nome', 'email', 'cpf']
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,                     -- Ex: 'Logs operacionais — 90 dias'
  motivo TEXT,                        -- Ex: 'Compliance LGPD'
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ
);
```

**Configurações Iniciais:**

| Tabela | Dias | Ação | Descrição |
|--------|------|------|-----------|
| `audit_trail` | 90 | DELETE | Logs operacionais |
| `ia_usage_log` | 90 | DELETE | Logs de uso de IA |
| `portal_logs_consulta` | 365 | ANONIMIZAR | Logs do portal público |
| `extracao_sessoes` | 30 | DELETE | Sessões temporárias |
| `config_audit_log` | 365 | DELETE | Logs de configuração |

---

## Edge Function: `lgpd-purge`

### Location
```
supabase/functions/lgpd-purge/
├── index.ts          (Main handler)
└── deno.json         (Dependencies)
```

### Invocation

#### 1. Cron (Automatizado)
```bash
# Configurar em Vercel Cron
POST /functions/v1/lgpd-purge
Cron: 0 2 * * *  # 2 AM UTC diariamente
```

#### 2. HTTP POST (On-Demand)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/lgpd-purge \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto"}'
```

#### 3. Webhook (External)
```bash
# Via Zapier/Make
POST /functions/v1/lgpd-purge
Body: {"mode": "retention"}
```

### Request Body

```json
{
  "mode": "auto"  // Options: "auto" | "queue" | "retention"
}
```

**Modes:**
- `auto`: Processa fila + retenção expirada (padrão)
- `queue`: Apenas fila de requisições pendentes
- `retention`: Apenas retenção automática

### Response

```json
{
  "status": "success",
  "processados": 15,
  "total_registros_purgados": 1250,
  "duracao_ms": 3420,
  "resultados": [
    {
      "purge_queue_id": "uuid-...",
      "tabela": "audit_trail",
      "registros_afetados": 450,
      "acao": "excluido",
      "sucesso": true
    }
  ]
}
```

---

## Processing Flow

### 1. Processamento de Fila Pendente

```
1. Buscar requisições com status='pendente' (LIMIT 50)
2. Para cada requisição:
   a. Marcar como 'processando'
   b. Determinar tipo:
      - 'exclusao': Purgar todos os dados do usuário
      - 'consentimento': Remover dados sem consentimento
      - 'retencao': Proceder para Step 2
   c. Executar ação correspondente
   d. Registrar em lgpd_purge_log
   e. Marcar como 'concluido' ou 'erro'
```

### 2. Processamento de Retenção Expirada

```
1. Buscar todas as configs ativas em lgpd_retencao_config
2. Para cada config:
   a. Calcular data_limite = TODAY - dias_retencao
   b. Contar registros com data_coluna < data_limite
   c. Processar em batches (50 registros por vez)
   d. Executar ação:
      - ANONIMIZAR: Substituir PII com "DADOS_REMOVIDOS"
      - EXCLUIR: Hard delete
   e. Registrar em lgpd_purge_log
```

### 3. Anonimização vs. Exclusão

**Anonimizar:** Substitui campos de PII com placeholder
```sql
UPDATE audit_trail
SET usuario_id = '00000000-0000-0000-0000-000000000000'
WHERE created_at < '2025-12-26'::date;
```

**Excluir:** Remove o registro completamente
```sql
DELETE FROM audit_trail
WHERE created_at < '2025-12-26'::date;
```

---

## Usage Examples

### 1. Requerer Exclusão de Usuário (Admin Panel)

```typescript
// src/actions/lgpd.ts
export async function solicitarExclusaoUsuario(userId: string, motivo: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .insert({
      tipo: 'exclusao',
      alvo_user_id: userId,
      contexto: { motivo, solicitado_por: 'admin', timestamp: new Date() },
      status: 'pendente'
    })
    .select()

  if (error) throw error

  // Dispara a function (opcional)
  await disparirPurgeFunction()

  return data[0]
}
```

### 2. Invocar Edge Function Manualmente

```typescript
// src/actions/lgpd.ts
export async function executarPurgaLGPD(modo: 'auto' | 'queue' | 'retention' = 'auto') {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/lgpd-purge`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: modo })
    }
  )

  if (!response.ok) {
    throw new Error(`LGPD purge failed: ${response.statusText}`)
  }

  return response.json()
}
```

### 3. Monitorar Status de Purga

```typescript
export async function verificarStatusPurga(purgeId: string) {
  const supabase = await createClient()

  // Buscar requisição
  const { data: request } = await supabase
    .from('lgpd_purge_queue')
    .select('*')
    .eq('id', purgeId)
    .single()

  // Buscar logs associados
  const { data: logs } = await supabase
    .from('lgpd_purge_log')
    .select('*')
    .eq('purge_queue_id', purgeId)

  return { request, logs }
}
```

### 4. Criar Requisição de Consentimento Retirado

```typescript
export async function solicitarPurgaPorConsentimento(
  tabela: string,
  campoConsentimento: string = 'consentimento_ativo'
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lgpd_purge_queue')
    .insert({
      tipo: 'consentimento',
      alvo_tabela: tabela,
      contexto: {
        campo_consentimento: campoConsentimento,
        motivo: 'Retirada de consentimento'
      },
      status: 'pendente'
    })
    .select()

  return data[0]
}
```

---

## Scheduling (Vercel Cron)

### Setup via `vercel.json`

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

### API Route Handler

```typescript
// src/app/api/cron/lgpd-purge/route.ts
import { executarPurgaLGPD } from '@/actions/lgpd'

export async function POST(req: Request) {
  // Validar Vercel Cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const resultado = await executarPurgaLGPD('auto')

  console.log('[CRON] LGPD Purge executed:', resultado)

  return new Response(JSON.stringify(resultado), { status: 200 })
}
```

---

## Security & Compliance

### 1. Authentication

- **Edge Function:** Usa `SUPABASE_SERVICE_ROLE_KEY` (servidor apenas)
- **API Route:** Valida `CRON_SECRET` ou JWT autenticado
- **Frontend:** Requer role `admin` verificado via RLS

### 2. Row Level Security (RLS)

```sql
-- Service role tem acesso completo
CREATE POLICY "Service role can manage purge queue"
  ON lgpd_purge_queue
  TO service_role
  USING (true);

-- Admins podem ler/gerenciar
CREATE POLICY "Admins can manage purge queue"
  ON lgpd_purge_queue
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin');
```

### 3. Audit Trail

Cada purga registra:
- `lgpd_purge_queue` — O QUE foi solicitado
- `lgpd_purge_log` — O QUE foi executado
- `audit_trail` — Quem executou (via trigger)

### 4. LGPD Compliance

- ✅ Direito ao esquecimento (exclusão de usuário)
- ✅ Portabilidade de dados (via DSAR reports)
- ✅ Retenção mínima (configurable por tabela)
- ✅ Processamento de consentimento
- ✅ Auditoria imutável

---

## Error Handling

### Retry Logic

Se uma requisição falhar:
1. Status muda para `erro`
2. `erro_mensagem` é preenchido
3. A requisição pode ser manualmente retentada
4. Logs continuam sendo gravados

### Common Errors

| Erro | Causa | Solução |
|------|-------|---------|
| `Missing SUPABASE_URL` | Env var não configurada | Verificar `.env` |
| `Failed to fetch pending purge requests` | RLS bloqueado | Usar service role key |
| `Count error on {tabela}` | Tabela não existe | Verificar nome em minúsculas |
| `Fetch error` | Query inválida | Verificar coluna_data |

---

## Monitoring & Alerts

### Dashboard Queries

```sql
-- Purgas em progresso
SELECT * FROM lgpd_purge_queue WHERE status = 'processando';

-- Purgas falhadas
SELECT * FROM lgpd_purge_queue WHERE status = 'erro';

-- Total de registros purgados hoje
SELECT SUM(registros_afetados) as total_purgado
FROM lgpd_purge_log
WHERE DATE(executado_em) = CURRENT_DATE;

-- Políticas de retenção que não rodaram
SELECT tabela, dias_retencao, acao
FROM lgpd_retencao_config
WHERE ativo = true AND tabela NOT IN (
  SELECT DISTINCT tabela FROM lgpd_purge_log
  WHERE DATE(executado_em) = CURRENT_DATE
);
```

### Alertas Recomendados

1. **Requisições com erro:** Se `lgpd_purge_queue.status = 'erro'` → Notificar Admin
2. **Processamento longo:** Se `duracao_ms > 60000` → Log warning
3. **Retenção vencida:** Se registros > 1000 sem processar → Escalar

---

## Deployment Checklist

- [ ] Executar migration `20260326_lgpd_purge_tables.sql` em produção
- [ ] Deploy Edge Function via Supabase CLI:
  ```bash
  supabase functions deploy lgpd-purge
  ```
- [ ] Testar invocation:
  ```bash
  curl -X POST https://your-project.supabase.co/functions/v1/lgpd-purge \
    -H "Authorization: Bearer YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"mode": "retention"}'
  ```
- [ ] Configurar Cron em `vercel.json`
- [ ] Criar API route para `/api/cron/lgpd-purge`
- [ ] Adicionar botão no Admin Panel
- [ ] Testar exclusão de usuário de teste
- [ ] Validar logs em `lgpd_purge_log`
- [ ] Documentar em runbook interno

---

## Future Enhancements

1. **Batch Processing Distribuído:** Usar Supabase Jobs para purgas muito grandes
2. **Notificação ao Usuário:** Email após exclusão bem-sucedida
3. **DSAR (Data Subject Access Request):** Relatório automático de dados pessoais
4. **Encryption at Rest:** Criptografar dados antes de anonimizar
5. **Rate Limiting:** Limitar requisições por usuário/IP
6. **Multi-tenancy:** Suportar múltiplas IES na mesma instância

---

## References

- **LGPD:** Lei 13.709/2018 (https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
- **Portaria MEC 554/2019:** Marco original de diploma digital
- **Portaria MEC 70/2025:** Ampliação de prazos
- **Supabase Docs:** https://supabase.com/docs

---

**Desenvolvido por:** Diploma Digital FIC (Equipe IA)
**Última atualização:** 2026-03-26
