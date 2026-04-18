# S19 — WhatsApp Meta Cloud API (CFO-FIC)

**Sessão:** S19 · **Adição pós-S17** · **Branch:** `feature/whatsapp-meta-api`
**Duração estimada:** 3h
**Dependências:** ✅ S16 (CFO-FIC tools), ✅ S08 (SC-29 Edge Function)
**Bloqueia:** primeiro run real da régua de cobrança CFO-FIC

**Contexto:** Evolution API foi testada em sessões anteriores e não funcionou de forma confiável.
Decisão de Marcelo (2026-04-18): usar API oficial do WhatsApp (Meta Cloud API) — mais estável,
sem intermediário, sem risco de ban, suporte Meta direto.

---

## Leituras obrigatórias

1. `apps/fic/agents/cfo/tools/send_whatsapp_cobranca.ts` (implementação atual com Evolution API)
2. `apps/fic/agents/cfo/tools/shared.ts` (credentialsProxy, SC-29)
3. `infra/supabase/migrations/20260417_S16_cfo_fic_schema.sql` (tabela comunicacoes)
4. `docs/sessions/PENDENCIAS.md` — P-009 (credenciais sandbox CFO-FIC)

---

## Objetivo

Substituir Evolution API por **Meta WhatsApp Business Cloud API** no tool
`send_whatsapp_cobranca` do CFO-FIC, sem mudar a interface externa do tool.

**Resultado esperado:** CFO-FIC envia mensagens WhatsApp reais via Meta API usando
SC-29 proxy (agente nunca vê o token diretamente).

---

## Contexto técnico — Meta Cloud API

### Endpoint

```
POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {META_WHATSAPP_TOKEN}
Content-Type: application/json
```

### Payload texto simples

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5567999999999",
  "type": "text",
  "text": { "preview_url": false, "body": "Olá João, sua mensalidade..." }
}
```

### Resposta de sucesso

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "5567999999999", "wa_id": "5567999999999" }],
  "messages": [{ "id": "wamid.HBgLNTU2Nz..." }]
}
```

`messages[0].id` = message_id a gravar em `comunicacoes.message_id`

### Número WhatsApp

O campo `to` deve conter apenas dígitos com DDI+DDD+número, sem `@s.whatsapp.net`.
Atual `whatsapp_jid` = `"5567999999999@s.whatsapp.net"` → extrair só os dígitos antes do `@`.

---

## Credenciais necessárias (Meta)

| Credencial | O que é | Onde obter |
|---|---|---|
| `META_WHATSAPP_TOKEN` | Token de acesso permanente (System User) | Meta Business Suite → Configurações → Usuários do sistema |
| `META_PHONE_NUMBER_ID` | ID numérico do número registrado | Meta for Developers → WhatsApp → Números de telefone |
| `META_WABA_ID` | WhatsApp Business Account ID | Meta for Developers → WhatsApp → Conta |

> Para sandbox/teste: Meta fornece um número de teste gratuito em
> developers.facebook.com → WhatsApp → Introdução → número de teste.
> Token temporário (24h) disponível ali mesmo; token permanente via System User.

---

## Escopo exato

### 1. Atualizar `send_whatsapp_cobranca.ts`

- Remover lógica Evolution API (endpoint `/message/sendText/{instance}`)
- Implementar chamada Meta Cloud API via `credentialsProxy()`
- Extrair número do `whatsapp_jid` (strip `@s.whatsapp.net`)
- Usar `messages[0].id` como `message_id`
- Manter interface pública do tool 100% idêntica (sem breaking change)

### 2. Atualizar `shared.ts`

- Adicionar constante `META_GRAPH_URL = 'https://graph.facebook.com/v20.0'`
- Remover `EVOLUTION_INSTANCE` e `EVOLUTION_BASE_URL` se existirem

### 3. Substituir credential EVOLUTION_API_TOKEN no ECOSYSTEM

Inserir 2 novas credenciais em `ecosystem_credentials` (sandbox):
- `META_WHATSAPP_TOKEN` (`service='meta-whatsapp'`, `provider='meta'`)
- `META_PHONE_NUMBER_ID` (`service='meta-whatsapp'`, `provider='meta'`)

Opcional: `META_WABA_ID` se necessário para relatórios/webhooks futuros.

Marcar `EVOLUTION_API_TOKEN` como `is_active=false` (não deletar — histórico).

### 4. Atualizar SC-29 `credentials-proxy` Edge Function

Verificar se o Edge Function aceita `service='meta-whatsapp'` no `acl`.
Se não aceitar, adicionar ACL entry para `agent_pattern='cfo-fic'`.

### 5. Atualizar testes de integração

- `apps/fic/agents/cfo/tests/integration.test.ts`
- Ajustar mock do `mockFetch` para resposta no formato Meta API
- Verificar que `send_whatsapp_cobranca — idempotência` ainda passa
- Manter 8/8 testes passing

### 6. Atualizar documentação

- `apps/fic/agents/cfo/evolved-config/domain-knowledge.md`
  - Seção WhatsApp: Evolution API → Meta Cloud API
  - Formato de número, endpoint, credential names
- `apps/fic/agents/cfo/skills/regua-cobranca/SKILL.md`
  - Referências ao canal WhatsApp

### 7. Registrar ca.crt Inter como constante no SC-29

O `ca.crt` enviado por Marcelo (CA chain do Inter sandbox) deve ser incorporado
como constante no Edge Function `credentials-proxy` para verificação TLS mTLS.
Não vai para `ecosystem_credentials` (é público, não é segredo).

---

## Arquivos a modificar

```
apps/fic/agents/cfo/tools/send_whatsapp_cobranca.ts   ← principal
apps/fic/agents/cfo/tools/shared.ts                    ← constantes
apps/fic/agents/cfo/tests/integration.test.ts          ← mocks Meta API
apps/fic/agents/cfo/evolved-config/domain-knowledge.md ← docs
apps/fic/agents/cfo/skills/regua-cobranca/SKILL.md    ← docs
infra/supabase/edge-functions/credentials-proxy/       ← ACL meta-whatsapp
```

---

## Credenciais a provisionar no ECOSYSTEM antes do run real

Execute via Supabase Studio → Editor SQL (projeto `gqckbunsfjgerbuiyzvn`):

```sql
-- Inserir credenciais Meta WhatsApp
INSERT INTO ecosystem_credentials
  (name, service, scope, location, project, environment, provider, proxy_only, is_active, acl, description)
VALUES
  ('META_WHATSAPP_TOKEN', 'meta-whatsapp', 'proxy', 'PENDENTE_CONFIGURAR',
   'fic', 'sandbox', 'meta', true, false,
   '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]',
   'Meta Cloud API — Bearer token (System User permanente ou temp 24h)'),
  ('META_PHONE_NUMBER_ID', 'meta-whatsapp', 'proxy', 'PENDENTE_CONFIGURAR',
   'fic', 'sandbox', 'meta', true, false,
   '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]',
   'Meta Cloud API — Phone Number ID do número registrado')
ON CONFLICT (name, project, environment) DO NOTHING;

-- Desativar Evolution (manter histórico)
UPDATE ecosystem_credentials SET is_active = false
WHERE name = 'EVOLUTION_API_TOKEN' AND project = 'fic' AND environment = 'sandbox';
```

---

## Entregáveis

- [ ] `send_whatsapp_cobranca.ts` usando Meta Cloud API
- [ ] `shared.ts` sem referências Evolution
- [ ] 8/8 testes passing (mocks atualizados)
- [ ] Credenciais Meta inseridas no ECOSYSTEM (is_active=false aguardando valores)
- [ ] domain-knowledge.md e SKILL.md atualizados
- [ ] PENDENCIAS.md: P-009 atualizado (Evolution → Meta)
- [ ] Commit `feat(cfo-fic): whatsapp meta cloud api [S19]`

---

## O que NÃO fazer nesta sessão

- Não implementar templates aprovados pela Meta (HSM/mensagens template)
  — usar mensagens livres por ora (sandbox permite texto livre)
- Não configurar webhooks de entrega/leitura — Fase 1
- Não migrar outros agentes do ecossistema — apenas CFO-FIC
