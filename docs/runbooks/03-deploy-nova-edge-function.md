# Runbook 03 — Deploy de nova Edge Function

> **Quando:** criar/deployar nova EF em Supabase (ECOSYSTEM ou per-projeto).
> **Dono:** D-Infra.
> **Fontes canônicas:** ADR-008 (SC-29 como EF), V9 § Parte III (L3), § Parte XII estrutura.

## Pré-requisitos

- [ ] Nome canônico em kebab-case (`<nome>`)
- [ ] Projeto alvo: ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) ou per-projeto (project_ref)
- [ ] Slot de deploy livre (regra canônica §44 V9: **1 sessão/dia** por DB)
- [ ] Supabase CLI instalada: `supabase --version` (v1.200+)
- [ ] `SUPABASE_ACCESS_TOKEN` exportado

## Passo-a-passo

### 1. Scaffold da Edge Function

```bash
cd infra/supabase
supabase functions new <nome>
```

Estrutura mínima em `infra/supabase/functions/<nome>/index.ts`:

```ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  // 1. Auth (JWT ou service_role)
  // 2. Validação de payload (Data Contract - Art. XVIII)
  // 3. Lógica determinística
  // 4. Audit log (Art. IV)
  // 5. Response
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 2. Escrever testes de integração

Criar `infra/supabase/functions/<nome>/test/integration.test.ts` cobrindo:
- Happy path (auth válido, payload correto)
- Auth inválido → 401
- Payload inválido → 400
- Erro interno → 500 (com audit log)
- Idempotência (Art. III — dupla chamada com mesma `idempotency_key`)

### 3. Validar em branch Supabase

```bash
supabase db branch create <nome>-test
supabase functions deploy <nome> --project-ref <branch_ref>
```

Rodar testes de integração contra a branch.

### 4. Code review

- PR para `main` com: código da EF + testes + entry em `infra/supabase/functions/README.md`
- Reviewer: Claudinho (outra sessão) ou Marcelo
- CI green obrigatório antes de merge

### 5. Deploy em produção

```bash
supabase functions deploy <nome> --project-ref gqckbunsfjgerbuiyzvn
# ou per-projeto:
supabase functions deploy <nome> --project-ref <project_ref>
```

### 6. Smoke test em produção

```bash
curl -X POST https://<project>.supabase.co/functions/v1/<nome> \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '<payload_teste>'
```

Validar:
- Resposta HTTP 200 com body esperado
- Row nova em `audit_log` (Art. IV)
- Latência p95 < 1s (L3 rule V9)

### 7. Atualizar documentação

Adicionar em `infra/supabase/functions/README.md`:

```markdown
### <nome>
- **Projeto:** ECOSYSTEM | <business>
- **Escopo:** <o que faz, 1 frase>
- **Auth:** JWT | service_role | anon
- **Invocadores:** <agentes ou clientes>
- **SLA:** <latência alvo>
- **Idempotente:** sim/não
```

### 8. Notificar D-Infra

Entry no briefing diário: "EF `<nome>` deployada em `<projeto>`, smoke test OK".

## Rollback

Se smoke test (passo 6) falhar:

```bash
supabase functions delete <nome> --project-ref <project_ref>
```

Recuperar via git se já havia versão anterior:
```bash
git checkout <commit_anterior> -- infra/supabase/functions/<nome>/
supabase functions deploy <nome> --project-ref <project_ref>
```

## Critérios de sucesso

- [ ] EF responde 200 no smoke test
- [ ] Audit log registrou chamada
- [ ] Latência p95 < 1s em produção
- [ ] Documentação atualizada
- [ ] Sem erros em Langfuse/logs nas próximas 2h
