# Runbook — Etapa 2-A · Deploy operacional do módulo Atendimento (FIC prod)

> **Status:** aguardando merge dos PRs #66, #70, #75 antes de executar.
> **Duração estimada:** 4-6h execução + 24-48h aguardando aprovação template Meta (paralelo).
> **Janela ideal:** após-horário comercial (18h em diante Brasília), para dar ~12h de margem antes do 1º turno FIC usar.
> **Feature flags como safety net:** tudo default `false` — se algo falhar após o deploy, basta `vercel env rm <FLAG>` e o módulo volta ao estado pré-S4.

---

## Pré-requisitos (antes de começar)

Colete isso no ambiente local + tenha acesso a:

| Item | Onde | Propósito |
|---|---|---|
| `supabase` CLI ≥ 1.200 + login | `supabase login` | Aplicar migrations |
| `vercel` CLI ≥ 52 + login | `vercel login` + `vercel link` no `apps/erp-educacional/` | Setar env vars |
| `gh` CLI | já configurado | Checar CI dos PRs |
| Acesso Dashboard Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) | login do Marcelo | Popular vault |
| Acesso Dashboard Supabase ERP (`ifdnjieklngcfodmtied`) | login do Marcelo | Aplicar migrations |
| Acesso Meta Business Manager → WhatsApp → FIC WABA | login do Marcelo | Template + provider_config |
| Azure portal → Entra → app `ecossistema-agentes-fic` | login do Marcelo | Verificar secret válido |
| Acesso Google AI Studio | login do Marcelo | Confirmar/gerar `GEMINI_API_KEY` |
| Email `@fic.edu.br` dos 4 atendentes | pessoalmente ou RH | Mapear `users.email` → UPN M365 |
| Credenciais cadastradas no vault | já cadastradas 2026-04-20 (ADR-018) | `OFFICE365_FIC_{TENANT,CLIENT_ID,CLIENT_SECRET}` |

### Credenciais que precisam estar em mãos

```
# Supabase ERP (target das migrations)
SUPABASE_PROJECT_REF=ifdnjieklngcfodmtied

# Supabase ECOSYSTEM (fonte do vault SC-29)
ECOSYSTEM_PROJECT_REF=gqckbunsfjgerbuiyzvn

# Vercel (target das env vars)
VERCEL_PROJECT_ID=prj_VIEmyVHGD61ow5uf5pmBJp5W7eAX   # erp-educacional

# Microsoft (tenant FIC)
MS_GRAPH_TENANT_ID=c157f62b-4c1f-450e-96e5-3110bed2ecb6
MS_GRAPH_CLIENT_ID=f8a3027c-87fa-4c0d-8812-bb2297b6628d
# MS_GRAPH_CLIENT_SECRET → vault OFFICE365_FIC_CLIENT_SECRET (nunca logar)

# Meta WABA
# → phone_number_id, waba_id, access_token → coletar via Meta Business Manager
```

---

## Estrutura do deploy — 6 blocos sequenciais

```
┌──────────────────────────────────────────────────────────────────┐
│ 0. Pré-flight checks                         (10min)             │
├──────────────────────────────────────────────────────────────────┤
│ 1. Aplicar migrations Supabase ERP           (30min)             │
│    1.1 S4 Kanban (20260421000000)                               │
│    1.2 S5 Templates (20260421)                                   │
│    1.3 S6 Cargos (20260422)                                      │
│    1.4 S7 Dashboards (20260425)                                  │
│    1.5 S8a Automations (20260426)                                │
│    1.6 S8b Chat interno (20260427)                               │
│    1.7 S9 DS Voice (20260428)                                    │
│    1.8 S10 DS Agente (20260429 — com vector 768)                │
│    1.9 S11 DS Bot (20260430)                                     │
│    1.10 Etapa 1-D FK (20260502)                                  │
│    1.11 Etapa 1-D vault refs (20260503)                          │
│    1.12 Etapa 2-B MS Graph (20260504)                            │
│    1.13 S4.5 FIC integration (20260505)                          │
├──────────────────────────────────────────────────────────────────┤
│ 2. Popular vault SC-29                       (15min)             │
│    2.1 WABA access_token FIC                                     │
│    2.2 Confirmar Office365_FIC_*                                 │
│    2.3 Seed GEMINI_API_KEY                                       │
├──────────────────────────────────────────────────────────────────┤
│ 3. Env vars Vercel (erp-educacional)         (20min)             │
│    3.1 Secrets compartilhados                                    │
│    3.2 Flags de habilitação                                      │
│    3.3 Pull local e smoke build                                  │
├──────────────────────────────────────────────────────────────────┤
│ 4. Mapping usuário → UPN M365                (15min)             │
├──────────────────────────────────────────────────────────────────┤
│ 5. Meta WABA & provider_config               (30min + ⏳24-48h)  │
│    5.1 Popular inbox FIC provider_config                         │
│    5.2 Submeter template fic_boleto_emitido                      │
├──────────────────────────────────────────────────────────────────┤
│ 6. Seeds acl / permissões                    (10min)             │
├──────────────────────────────────────────────────────────────────┤
│ 7. Smoke tests end-to-end                    (30min)             │
├──────────────────────────────────────────────────────────────────┤
│ 8. Rollback plan                                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Bloco 0 — Pré-flight checks (10min)

Objetivo: garantir que os 3 PRs foram mergeados na main e que a main está verde.

```bash
cd <monorepo>
git checkout main && git pull
git log --oneline -5 | grep -E "(Etapa 1-D|MS Graph|S4\.5)"
# Deve listar os 3 commits de merge em sequência
```

Checar CI:

```bash
gh pr list --state merged --search "head:feature/atnd-etapa" --limit 5
gh run list --branch main --limit 3
# Últimos runs devem estar success
```

Checkpoint ✅: 3 commits merged, main verde, nada em dirty.

---

## Bloco 1 — Aplicar migrations Supabase ERP (30min)

### 1.0 Backup preventivo

Antes de tocar em prod, snapshot de segurança no Supabase Dashboard:

**Dashboard → Project `ifdnjieklngcfodmtied` → Database → Backups → Create manual backup**

Nome do backup: `pre-etapa-2a-atendimento-YYYYMMDD`. Aguardar conclusão (~2min).

### 1.1-1.9 Migrations existentes S4-S11

Se alguma dessas **ainda não foi aplicada em prod**, aplicar agora na ordem. Verificar primeiro:

```bash
# Lista migrations já aplicadas no projeto
supabase migration list --linked --project-ref ifdnjieklngcfodmtied
```

Para cada migration faltante no range 20260421000000..20260430, aplicar via:

```bash
supabase db push --linked --project-ref ifdnjieklngcfodmtied --include-all
```

Ou via Dashboard → SQL Editor → colar + run.

**Observação:** migrations S10 (DS Agente) foram atualizadas para `vector(768)` em vez de `1536` (P-130 Gemini). Se S10 já foi aplicada como 1536, rodar ajuste manual — ver [Apêndice A](#apêndice-a-migração-de-vector-dim) no final.

### 1.10 Etapa 1-D · FK calendar_events → deals

```bash
supabase db push --linked --project-ref ifdnjieklngcfodmtied \
  --file infra/supabase/migrations/20260502_atendimento_etapa1_fk_calendar_deal.sql
```

Validar:

```sql
SELECT conname FROM pg_constraint WHERE conname = 'fk_calendar_events_deal';
-- deve retornar 1 linha
```

### 1.11 Etapa 1-D · vault refs

```bash
supabase db push --linked --project-ref ifdnjieklngcfodmtied \
  --file infra/supabase/migrations/20260503_atendimento_etapa1_vault_refs.sql
```

Validar:

```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'atendimento_google_tokens'
    AND column_name = 'refresh_token_vault_ref';
-- retorna 1 linha se sucesso (essa tabela é dropada no passo 1.12)
```

### 1.12 Etapa 2-B · MS Graph

```bash
supabase db push --linked --project-ref ifdnjieklngcfodmtied \
  --file infra/supabase/migrations/20260504_atendimento_etapa2b_ms_graph.sql
```

Validar:

```sql
-- Colunas renomeadas
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'atendimento_calendar_events'
    AND column_name IN ('provider_event_id','provider_calendar_id','provider','organizer_email');
-- deve retornar 4 linhas

-- Tabela Google tokens dropada
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'atendimento_google_tokens'
);
-- deve retornar FALSE
```

### 1.13 S4.5 · Integrações FIC

```bash
supabase db push --linked --project-ref ifdnjieklngcfodmtied \
  --file infra/supabase/migrations/20260505_atendimento_etapa2b_s45_fic_integration.sql
```

Validar:

```sql
-- FK contacts → alunos
SELECT conname FROM pg_constraint WHERE conname = 'fk_atendimento_contacts_aluno';

-- Tabela process_types com 17 tipos
SELECT count(*) FROM public.atendimento_process_types;
-- deve retornar 17

-- Trigger s45_deal_to_aluno
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_s45_deal_to_aluno';
-- deve retornar 1 linha
```

Checkpoint ✅: todas migrations aplicadas, validações passam.

---

## Bloco 2 — Popular vault SC-29 (15min)

Via Dashboard Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) → Table Editor → `ecosystem_credentials`.

### 2.1 WABA access_token FIC (P-160)

```sql
-- Inserir credencial nova
INSERT INTO public.ecosystem_credentials (
  name, service, project, environment, scope, acl, created_at, updated_at
) VALUES (
  'WABA_TOKEN_FIC',
  'meta-whatsapp',
  'fic',
  'prod',
  'proxy',
  ARRAY['erp-atendimento','claudinho'],
  NOW(), NOW()
);

-- Armazenar o valor real no Vault via Supabase CLI (nunca em SQL editor!):
-- supabase secrets set --project-ref gqckbunsfjgerbuiyzvn WABA_TOKEN_FIC=<token-real>
```

Atualizar o inbox FIC para referenciar:

```sql
-- Na ERP (ifdnjieklngcfodmtied), popular access_token_vault_ref e zerar plaintext
UPDATE public.atendimento_inboxes
   SET provider_config = provider_config
       || jsonb_build_object('access_token_vault_ref','WABA_TOKEN_FIC')
       - 'access_token'
 WHERE channel_type = 'whatsapp';
```

Validar:

```sql
SELECT id, provider_config->'access_token_vault_ref' AS ref,
       provider_config->'access_token' AS plaintext
  FROM public.atendimento_inboxes;
-- ref deve aparecer, plaintext deve ser NULL
```

### 2.2 Confirmar credenciais Office365_FIC (P-164)

```sql
-- No ECOSYSTEM
SELECT name, service, environment, acl
  FROM public.ecosystem_credentials
  WHERE name LIKE 'OFFICE365_FIC_%';
-- deve listar 3 linhas (TENANT_ID / CLIENT_ID / CLIENT_SECRET)
-- ACL deve incluir 'erp-atendimento'
```

Se ACL não contém `erp-atendimento`:

```sql
UPDATE public.ecosystem_credentials
   SET acl = acl || 'erp-atendimento'
 WHERE name LIKE 'OFFICE365_FIC_%'
   AND NOT acl @> ARRAY['erp-atendimento'];
```

Testar que o secret ainda é válido:

```bash
curl -X POST "https://login.microsoftonline.com/$MS_GRAPH_TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$MS_GRAPH_CLIENT_ID" \
  -d "client_secret=<secret-do-vault>" \
  -d "grant_type=client_credentials" \
  -d "scope=https://graph.microsoft.com/.default"
# Resposta 200 com access_token → secret válido
# Resposta 401 com "invalid_client" → secret expirou (Azure portal → regenerar → atualizar vault)
```

### 2.3 Seed GEMINI_API_KEY (P-130)

```sql
-- Conferir se já existe (F0.6 Diploma já pode ter seedado)
SELECT name FROM public.ecosystem_credentials WHERE name = 'GEMINI_API_KEY_ECOSYSTEM';
```

Se não existe:

```sql
INSERT INTO public.ecosystem_credentials (
  name, service, project, environment, scope, acl, created_at, updated_at
) VALUES (
  'GEMINI_API_KEY_ECOSYSTEM',
  'google-genai',
  'ecosystem',
  'prod',
  'proxy',
  ARRAY['erp-atendimento','diploma-digital','claudinho'],
  NOW(), NOW()
);
```

```bash
supabase secrets set --project-ref gqckbunsfjgerbuiyzvn GEMINI_API_KEY_ECOSYSTEM=<chave>
```

Checkpoint ✅: WABA ref no vault + inbox referenciando + Office365 com ACL correto + Gemini disponível.

---

## Bloco 3 — Env vars Vercel (erp-educacional) (20min)

### 3.1 Secrets compartilhados

```bash
cd apps/erp-educacional
vercel link --project erp-educacional   # confirma context

# Credential gateway (P-162) — habilita o resolver a buscar refs no vault
vercel env add CREDENTIAL_GATEWAY_URL production
# valor: https://gqckbunsfjgerbuiyzvn.supabase.co/functions/v1
vercel env add CREDENTIAL_GATEWAY_URL preview
vercel env add CREDENTIAL_GATEWAY_URL development

vercel env add CREDENTIAL_GATEWAY_TOKEN production
# valor: service_role_key do projeto ECOSYSTEM (Dashboard → API)
vercel env add CREDENTIAL_GATEWAY_TOKEN preview
vercel env add CREDENTIAL_GATEWAY_TOKEN development

# Microsoft Graph (P-164) — FIC tenant defaults hardcoded
vercel env add MS_GRAPH_TENANT_ID production
# valor: c157f62b-4c1f-450e-96e5-3110bed2ecb6
vercel env add MS_GRAPH_CLIENT_ID production
# valor: f8a3027c-87fa-4c0d-8812-bb2297b6628d
# MS_GRAPH_CLIENT_SECRET fica SÓ no vault — o resolver busca via CREDENTIAL_GATEWAY

# Gemini LLM (P-130) — acesso direto enquanto não passar pelo gateway
vercel env add GEMINI_API_KEY production
# valor: o mesmo da credencial GEMINI_API_KEY_ECOSYSTEM
vercel env add GEMINI_API_KEY preview

# Cron secret (P-107) — para os workers de automação e dispatch
openssl rand -hex 32 | pbcopy          # gera, copia pro clipboard
vercel env add CRON_SECRET production  # cola
vercel env add CRON_SECRET preview
vercel env add CRON_SECRET development
# Também exportar como ADMIN_SECRET (alias legado P-120):
vercel env add ADMIN_SECRET production  # valor idêntico
```

### 3.2 Flags de habilitação

Default é `false` — ligar uma por vez após validar no próximo bloco.

```bash
# Começar tudo com false (server e client)
for flag in ATENDIMENTO_AUTOMATIONS_ENABLED \
            ATENDIMENTO_DASHBOARDS_ENABLED \
            ATENDIMENTO_DS_VOICE_ENABLED \
            ATENDIMENTO_DS_AGENTE_ENABLED \
            ATENDIMENTO_RBAC_ENABLED; do
  vercel env add $flag production   # valor: false
done

# E os pares NEXT_PUBLIC_ (client-side render)
for flag in NEXT_PUBLIC_ATENDIMENTO_DS_VOICE_ENABLED \
            NEXT_PUBLIC_ATENDIMENTO_DS_AGENTE_ENABLED; do
  vercel env add $flag production   # valor: false
done
```

### 3.3 Pull local + smoke build

```bash
vercel env pull --environment=production .env.production.local
pnpm --filter diploma-digital build
# Deve compilar sem erro. Avisos de env ausente = problema antes do prod.
```

Deploy de preview pra validar:

```bash
vercel deploy --prebuilt
# Abrir URL de preview, fazer login, navegar nas telas pra validar
```

Checkpoint ✅: build passa local, preview responde, nenhum `missing env` no log.

---

## Bloco 4 — Mapping usuário → UPN M365 (15min) (P-163)

Pra cada atendente que vai usar agendamentos (criar eventos Calendar), confirmar que `auth.users.email` no Supabase bate com o email FIC M365.

### 4.1 Listar atendentes atuais

```sql
-- Supabase ERP
SELECT u.id, u.email, u.raw_user_meta_data->>'name' AS nome
  FROM auth.users u
  WHERE u.email IS NOT NULL
  ORDER BY u.email;
```

### 4.2 Validação 1-a-1 contra Graph

Para cada email listado, rodar:

```bash
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/$MS_GRAPH_TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$MS_GRAPH_CLIENT_ID" \
  -d "client_secret=$MS_GRAPH_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=https://graph.microsoft.com/.default" \
  | jq -r .access_token)

for EMAIL in atendente1@fic.edu.br atendente2@fic.edu.br; do
  curl -s "https://graph.microsoft.com/v1.0/users/$EMAIL" \
    -H "Authorization: Bearer $TOKEN" | jq '{email: .mail, upn: .userPrincipalName, id: .id}'
done
```

**Se 200 com `userPrincipalName` batendo ao email Supabase:** OK, sem ação.

**Se 404 ou UPN diferente:** duas opções:

- **Alterar email no Supabase** pra bater com UPN FIC (recomendado se atendente usa só o ERP)
- **Criar coluna `users.ms_upn`** e ajustar `calendar-events/route.ts` pra usar `ms_upn ?? email`. Fora do escopo Etapa 2-A — virar P-169 se necessário.

Checkpoint ✅: os atendentes que vão usar Calendar têm email Supabase = UPN FIC.

---

## Bloco 5 — Meta WABA & provider_config (30min + ⏳ 24-48h)

### 5.1 Popular provider_config do inbox FIC

No Meta Business Manager → WhatsApp Manager → FIC WABA → coletar:

- `phone_number_id` (no cabeçalho de cada número)
- `waba_id` (BA number, canto superior)

Atualizar o inbox:

```sql
UPDATE public.atendimento_inboxes
   SET provider_config = jsonb_build_object(
         'phone_number_id', '<PHONE_NUMBER_ID>',
         'waba_id',         '<WABA_ID>',
         'access_token_vault_ref', 'WABA_TOKEN_FIC'
       )
 WHERE channel_type = 'whatsapp' AND name LIKE '%FIC%';
```

Validar que o token resolve:

```bash
# Chamar qualquer endpoint que lê waba-credentials
# (ex: sync de templates — quando migration aplicada, endpoint existe)
curl -X POST "https://<erp-prod-domain>/api/cron/sync-meta-templates" \
  -H "Authorization: Bearer $CRON_SECRET"
# Esperado: 200 com lista de templates sincronizados da Meta
```

### 5.2 Submeter template `fic_boleto_emitido` (P-166)

No Meta Business Manager → WhatsApp Manager → Message Templates → **Create Template**:

```
Nome:       fic_boleto_emitido
Categoria:  UTILITY
Idioma:     pt_BR

Cabeçalho:  nenhum

Corpo:
Olá, {{1}}! 👋

Seu boleto FIC foi emitido:

💰 Valor: R$ {{2}}
📅 Vencimento: {{3}}

📎 Baixe o PDF ou pague via PIX aqui: {{4}}

Qualquer dúvida é só responder essa mensagem.

Exemplo:
  {{1}}: Ana
  {{2}}: 750,00
  {{3}}: 29/04/2026
  {{4}}: https://fic.edu.br/boletos/abc123.pdf

Rodapé:     nenhum
Botões:     nenhum
```

Aguardar aprovação Meta: **24-48h**. Status muda de `PENDING → APPROVED` (ou `REJECTED` com feedback).

Até aprovação, fluxo do botão "Solicitar pagamento" assume janela WABA aberta (<24h desde última msg do contato). Janela fechada + template pendente = mensagem fica em `pending` e não é enviada. **Não bloqueia Etapa 2-A** — é pré-requisito operacional pra pagamentos em janela fechada.

Checkpoint ✅: provider_config preenchido, sync de templates retorna OK, template submetido à Meta.

---

## Bloco 6 — Seeds acl / permissões (10min)

### 6.1 Permissão `settings:edit/delete` para Admin (P-167)

Sem isso, botão "➕ Novo tipo" no ProtocolModal e CRUD em `/atendimento/configuracoes/tipos-de-processo` retornam 403.

```sql
-- Confere o ID do cargo Admin na FIC
SELECT id, name FROM public.atendimento_roles
 WHERE name ILIKE '%admin%' AND account_id IS NULL
 LIMIT 1;

-- Seed as permissões (idempotente via ON CONFLICT)
INSERT INTO public.role_permissions (role_id, module, action, granted)
SELECT id, 'settings', action, true
  FROM public.atendimento_roles, UNNEST(ARRAY['view','edit','delete']) AS action
 WHERE name ILIKE '%admin%' AND account_id IS NULL
ON CONFLICT (role_id, module, action) DO UPDATE SET granted = true;
```

Validar:

```sql
SELECT r.name, rp.module, rp.action
  FROM public.role_permissions rp
  JOIN public.atendimento_roles r ON r.id = rp.role_id
  WHERE rp.module = 'settings' AND rp.granted = true;
-- deve listar 3 linhas pro cargo Admin
```

Checkpoint ✅: Admin tem settings:edit/delete.

---

## Bloco 7 — Smoke tests end-to-end (30min)

Executar com feature flags ainda `false` inicialmente, então ligar cada uma + re-testar.

### 7.1 Conectividade base

```bash
# 1. Health check
curl https://<erp-prod>/api/health
# 2. Autenticação (login manual Marcelo)
# 3. /atendimento carrega?
# 4. GET /api/atendimento/labels responde 200?
```

### 7.2 MS Graph Calendar

1. Ligar flag não-necessária (calendar não tem flag — é a rota base de S5)
2. Abrir `/atendimento/agendamentos`
3. Criar evento teste: `POST /api/atendimento/calendar-events` com body mínimo
4. Verificar evento aparece no OWA do atendente (mailbox organizer)
5. Verificar `join_url` do Teams gerado

Log esperado: `[calendar-events] OK organizer=<email>`. 502 = credencial inválida — voltar ao Bloco 2.2.

### 7.3 DS Agente + RAG (Gemini)

```bash
# Com ATENDIMENTO_DS_AGENTE_ENABLED=true
vercel env add ATENDIMENTO_DS_AGENTE_ENABLED production   # value: true
vercel env add NEXT_PUBLIC_ATENDIMENTO_DS_AGENTE_ENABLED production  # value: true
vercel redeploy
```

Playground do DS Agente → perguntar qualquer coisa → deve retornar resposta Gemini + ranking RAG. Se 500 `GEMINI_API_KEY` ausente, voltar 2.3.

### 7.4 Automações S8a

Ligar `ATENDIMENTO_AUTOMATIONS_ENABLED=true` + redeploy. Criar regra simples "message_created contendo 'teste' → add_tag". Enviar mensagem via Meta Cloud API simulator. Tag deve aparecer no contact.

### 7.5 S4.5 Deal → Aluno

1. Criar contact teste + `contact_custom_fields.cpf` = '00000000191'
2. Criar deal no pipeline ALUN, stage inicial
3. Arrastar até "Matrícula ativa"
4. Conferir:
   ```sql
   SELECT a.cpf, a.nome, c.aluno_id, d.aluno_id
     FROM alunos a
     JOIN atendimento_contacts c ON c.aluno_id = a.id
     JOIN deals d ON d.contact_id = c.id
    WHERE a.cpf = '00000000191';
   ```
   Deve retornar 1 linha com os 3 aluno_id iguais.

### 7.6 S4.5 Solicitar Pagamento (manual)

Precondição: aluno tem pelo menos 1 `cobrancas` row `status IN (gerado, enviado, vencido)`. Se não tiver, rodar emit-boletos Python primeiro.

1. Abrir conversa do contact vinculado ao aluno
2. Clicar 💰 na toolbar
3. Modal lista cobranças pendentes
4. Clicar "Enviar PIX no chat"
5. Confirmar:
   - Mensagem outbound aparece no chat (via Realtime)
   - `atendimento_messages.metadata.pix_demanda_id` preenchido
   - Toast "Enviado ✓"
6. Verificar destino (número WhatsApp de teste) recebeu a mensagem

### 7.7 S4.5 ProtocolModal + tipos

1. Abrir protocolo numa conversa
2. Dropdown lista os 17 tipos seeded
3. Selecionar "Trancamento" + preencher assunto → criar
4. Verificar que `protocols.process_type_id` e `aluno_id` foram preenchidos
5. Como Admin: clicar "➕ Novo tipo" → criar tipo custom → aparece no dropdown
6. Acessar `/atendimento/configuracoes/tipos-de-processo` → CRUD funcional
7. Acessar `/atendimento/alunos/<id>/processos` → lista o protocolo

Checkpoint ✅: todos os smoke tests passam.

---

## Bloco 8 — Rollback plan

### 8.1 Rollback por feature flag (sem redeploy)

```bash
# Desabilitar feature problemática
vercel env rm <FLAG_PROBLEMATICA> production
vercel env add <FLAG_PROBLEMATICA> production   # valor: false
vercel redeploy --prod
```

Tempo estimado: ~2min. Zero perda de dados.

### 8.2 Rollback de migration individual

Cada migration tem rollback SQL em `infra/supabase/migrations/rollback/` ou inline no comentário do arquivo. Para desfazer:

```bash
# Via Dashboard → SQL Editor → colar rollback SQL → run
# OU via CLI com arquivo custom:
psql "$SUPABASE_DB_URL" < infra/supabase/migrations/rollback/<file>.down.sql
```

**Atenção:** migration 20260504 dropa a tabela `atendimento_google_tokens`. Rollback requer restore de backup manual (Bloco 1.0) — dados de refresh_token per-user são perdidos. Mas como o MVP inteiro de calendar passou pra MS Graph, essa perda é irrelevante.

### 8.3 Rollback full Etapa 2-A

Se houver falha crítica que o feature flag não resolve:

1. `vercel rollback <deploy-anterior>` — Vercel Dashboard → Deployments → escolher último pré-deploy → Promote
2. Restore do backup Supabase (Bloco 1.0) via Dashboard
3. Tempo total: ~15min pro código, ~30min pro DB

### 8.4 Contato de escalação

- **Marcelo Silva** (CEO) — aprovação final de rollback DB
- **Dashboard Supabase alarms** — ativar alertas em `atendimento_messages.status='failed'` > 10/5min
- **Vercel logs** — monitorar `[calendar-events]`, `[enviar-pix]`, `[ds-agente-runner]`

---

## Apêndice A — Migração de vector dim (se S10 já estava em prod com 1536)

Cenário: S10 foi aplicada antes de Etapa 1-D, com `vector(1536)` original.

```sql
-- 1. Backup da tabela
CREATE TABLE public.ds_agent_knowledge_backup AS
  SELECT * FROM public.ds_agent_knowledge;

-- 2. Drop coluna + recria com 768 + reprocessar embeddings via Gemini
ALTER TABLE public.ds_agent_knowledge DROP COLUMN embedding;
ALTER TABLE public.ds_agent_knowledge ADD COLUMN embedding vector(768);

-- 3. Rebuild HNSW index
DROP INDEX IF EXISTS ds_agent_knowledge_embedding_idx;
CREATE INDEX ds_agent_knowledge_embedding_idx
  ON public.ds_agent_knowledge USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Rodar seed reprocessando
-- No worktree: pnpm --filter diploma-digital tsx scripts/reindex-ds-agent.ts
```

Tempo: ~10min por 100 documentos RAG (rate-limited pela quota free Gemini).

---

## Apêndice B — Lista de PENDENCIAS que esta Etapa fecha/cria

**Fechadas pela Etapa 2-A:**
- P-160 (seed WABA vault) — via Bloco 2.1
- P-162 (env vars gateway) — via Bloco 3.1
- P-163 (mapping users.email) — via Bloco 4
- P-164 (env vars MS Graph) — via Bloco 3.1 + Bloco 2.2
- P-166 (template `fic_boleto_emitido`) — parcial, aguarda aprovação Meta
- P-167 (seed Admin permissions) — via Bloco 6

**Novas pendências que podem surgir:**
- P-169 (se UPN FIC divergir do email Supabase): criar coluna `users.ms_upn`
- P-170 (se quota Gemini free esgotar): habilitar billing Google Cloud

---

## Checkpoints resumo

| Checkpoint | Bloco | Validação |
|---|---|---|
| 3 PRs merged + CI verde | 0 | `gh pr list --state merged` |
| Backup manual criado | 1.0 | Dashboard Supabase → Backups |
| 13 migrations aplicadas | 1.1-1.13 | `SELECT count(*) FROM schema_migrations` |
| Vault populated | 2 | `SELECT name FROM ecosystem_credentials WHERE name LIKE '%FIC%'` |
| Env vars setadas | 3 | `vercel env ls` |
| UPN mapeado | 4 | Graph `/users/{email}` retorna 200 |
| provider_config + template submitted | 5 | Dashboard Meta |
| Admin com settings | 6 | `SELECT ... FROM role_permissions` |
| Smoke tests passam | 7 | 7.1-7.7 todos ✅ |

---

**Autor:** Claudinho · 2026-04-22
**Revisão humana:** _aguardando Marcelo_
**Execução:** planejada para após merge dos 3 PRs (#66, #70, #75).
