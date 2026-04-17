# Runbook 02 — Adicionar novo negócio ao ecossistema

> **Quando:** onboard de business unit novo (Splendori, Nexvy, ou futuros).
> **Dono:** Marcelo + D-Sinergia + D-Infra.
> **Fontes canônicas:** ADR-003 (ECOSYSTEM + per-projeto), ADR-010 (C-Suite per negócio), V9 § Parte VI §15.

## Pré-requisitos

- [ ] Nome canônico do negócio (`business_id` kebab, sem acentos — ex: `splendori`)
- [ ] Matriz C-Suite aprovada (quais diretores: CEO/CFO/CAO/CMO/CSO/CLO/COO/CTO/CPO/CHRO)
- [ ] Variant aplicável: `educacao` | `imobiliario` | `saas` | outro novo
- [ ] Virtual key LiteLLM definida (ex: `splendori-key`)
- [ ] Orçamento mensal USD decidido (budget LiteLLM)

## Passo-a-passo

### 1. Criar Supabase per-projeto

Via MCP do Supabase (ou dashboard):

- Organização: a mesma da ECOSYSTEM
- Região: `sa-east-1` (BR) preferencial
- Nome do projeto: `<business_id>-prod`

Anotar `project_ref`.

### 2. Copiar schema base (agents_base migrations)

```bash
cd infra/supabase
pnpm migrations:apply --project-ref <novo_ref> --schema agents_base
```

Contém: `audit_log`, `idempotency_cache`, `approval_requests` (em mirror do ECOSYSTEM ou como views foreign).

### 3. Configurar RLS per business_id

Nas tabelas compartilhadas de ECOSYSTEM (`memory_episodic`, `audit_log`, etc), adicionar `<business_id>` ao enum/lista:

```sql
-- Em ECOSYSTEM
insert into business_registry (id, name, created_at) values ('<business_id>', '<Nome>', now());
```

### 4. Criar virtual key no LiteLLM

Arquivo `infra/railway/litellm/config.yaml`:

```yaml
virtual_keys:
  - key: sk-<business_id>
    models: ["claude-sonnet-4-6", "claude-haiku-3-7", "gpt-4o-mini", "maritalk-sabia-4"]
    max_budget: <usd_mensal>
    budget_duration: 30d
    metadata:
      business_id: "<business_id>"
```

Reload LiteLLM via Railway (`railway redeploy`).

### 5. Instanciar C-Suite do negócio

Para cada diretor aprovado, criar `apps/<business_id>/agents/<diretor>.yaml`:

```yaml
# apps/<business_id>/agents/cfo.yaml
extends: "@ecossistema/c-suite-templates/CFO-IA/variants/<variant>"
business_name: "<Nome>"
business_id: "<business_id>"
supabase_project: "<project_ref>"
model: "claude-sonnet-4-6"
custom_context: |
  <contexto específico do negócio — 30-80 linhas>
hooks_extra: []
```

### 6. Configurar namespace memory

Namespace em Mem0/`memory_*` herda de `business_id`. Nenhuma ação manual necessária (filters estritos aplicam automaticamente se agentes forem configurados com `business_id`).

### 7. Adicionar MCP server do negócio

```bash
cd packages/mcp-servers
pnpm -F @ecossistema/mcp-server-generator create-mcp-server \
  --name <business_id>-mcp --scopes "<business_id>:read,<business_id>:write"
```

Deployar no Railway conforme `packages/mcp-servers/template/railway.json`.

### 8. Registrar em cockpit

```sql
-- Em ECOSYSTEM
insert into cockpit.businesses (id, display_name, supabase_ref, litellm_key, csuite_count, status)
values ('<business_id>', '<Nome>', '<project_ref>', 'sk-<business_id>', <n>, 'onboarding');
```

### 9. Smoke test E2E

- CFO-IA do novo negócio recebe mensagem teste
- Consulta simples (ex: "qual seu papel?") → resposta coerente com `custom_context`
- Tool call simples (ex: `list_alunos` ou equivalente) → sem erro auth/RLS

### 10. Ativar status

```sql
update cockpit.businesses set status = 'active' where id = '<business_id>';
```

## Critérios de sucesso

- [ ] Supabase per-projeto criado e reachable
- [ ] Virtual key LiteLLM respondendo
- [ ] C-Suite instanciado e com smoke test passando
- [ ] MCP server do negócio deployado
- [ ] Row em `cockpit.businesses` com status `active`
- [ ] Briefing D-Sinergia menciona o novo negócio
