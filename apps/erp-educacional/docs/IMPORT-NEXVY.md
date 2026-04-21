# Import Nexvy → ERP (S4)

Migração dos deals reais do Nexvy para o Kanban do ERP-Educacional.

## 1. Exportar CSV do Nexvy

1. Acesse `console.nexvy.tech`
2. Vá em **API → Export → Deals**
3. Selecione a pipeline "ATENDIMENTOS-GERAL" (ou outra)
4. Baixe o arquivo `.csv`

## 2. Formato esperado

Colunas mínimas (nomes case-sensitive):

| Coluna           | Obrigatório | Observação                                                     |
|------------------|-------------|----------------------------------------------------------------|
| `contact_name`   | sim (ou phone) | Nome do contato                                              |
| `contact_phone`  | sim (ou name)  | Fone; será normalizado para formato E.164 BR (prefixo 55)     |
| `contact_email`  | não         |                                                                 |
| `deal_title`     | sim         | Título do card                                                  |
| `stage_name`     | não         | Case-insensitive; match com `pipeline_stages.name` da pipeline alvo |
| `assignee_email` | não         | Usado só para matching futuro (S6)                              |
| `value`          | não         | Aceita "R$ 1.500,00", "1500", "1500.00"                         |
| `source`         | não         | Default: `nexvy_import`                                        |
| `tags`           | não         | (ignorado por ora — S5)                                         |
| `created_at`     | não         | ISO-8601 (preservado em `custom_fields.nexvy_original`)         |

Linhas que não tiverem `phone` nem `name` **são puladas com log** (não aborta).

## 3. Rodar dry-run

```bash
cd apps/erp-educacional

# Env obrigatórias:
export SUPABASE_URL="https://gqckbunsfjgerbuiyzvn.supabase.co"        # projeto ECOSYSTEM
export SUPABASE_SERVICE_ROLE_KEY="<service_role do vault>"

pnpm dlx tsx scripts/nexvy_import.ts \
  --csv ~/Downloads/nexvy-deals.csv \
  --pipeline-key ATND \
  --dry-run
```

Saída esperada:

```
🟢 171 linhas lidas de /Users/.../nexvy-deals.csv
📦 Import run id: 2f6a…
[dry] contato=João Silva phone=5567999112233 stage=secretaria
…
✅ Concluído: 0 contatos novos · 171 deals
```

## 4. Rodar import real

Remove o flag `--dry-run`:

```bash
pnpm dlx tsx scripts/nexvy_import.ts \
  --csv ~/Downloads/nexvy-deals.csv \
  --pipeline-key ATND
```

No fim, o script imprime o `import_run_id` que você usa para rollback se algo der errado:

```
🔁 Para desfazer: pnpm tsx scripts/nexvy_import.ts --rollback 2f6a…
```

## 5. Rollback

```bash
pnpm dlx tsx scripts/nexvy_import.ts --rollback 2f6a...
```

Todos os deals criados naquela run são deletados via query em `custom_fields->>import_run_id`. Contatos **não** são removidos (podem ter sido criados por outras rotas).

## 6. Stage mapping Nexvy → FIC

| Nexvy column        | ERP stage            |
|---------------------|----------------------|
| AGUARDANDO          | AGUARDANDO           |
| EM ATENDIMENTO      | SECRETARIA           |
| SECRETARIA          | SECRETARIA           |
| FINANCEIRO          | FINANCEIRO           |
| NOVAS MATRICULAS    | NOVAS MATRÍCULAS     |
| _vazio ou outro_    | AGUARDANDO (primeira stage) |

O match é `lowercase` e faz `indexOf` exato pelo nome — se precisar alias, edite o `stageMap` em `scripts/nexvy_import.ts`.

## 7. Pendências conhecidas

- **Assignee matching** (ligar `assignee_email` ao `atendimento_agents.user_id`) — só em S6 após Cargos.
- **Tags** — reservado para S5 Templates.
- **Anexos do deal** — Nexvy exporta URLs no CSV; fica em `custom_fields.nexvy_original`, pipeline de copy-to-R2 em S6+.
