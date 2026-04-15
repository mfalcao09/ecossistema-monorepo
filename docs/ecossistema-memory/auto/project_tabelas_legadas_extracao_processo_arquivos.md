---
name: Tabelas legadas extracao_sessoes + processo_arquivos
description: Descoberta na sessão 028 — ambas as tabelas já existiam ANTES do plano v2, com schema diferente do proposto. Origem mapeada nas migrations.
type: project
---

# Tabelas legadas — descoberta na sessão 028 (08/04/2026)

Durante o Sprint 1 do plano v2 (fluxo novo processo), tentei criar as tabelas `extracao_sessoes` e `processo_arquivos` via `CREATE TABLE`. Ambas **já existiam** com schema diferente.

## Origens mapeadas

| Tabela | Migration | Data | Contexto |
|---|---|---|---|
| `extracao_sessoes` | `20260321101335_criar_modulo_emissao_ia` | 21/03/2026 | Módulo de emissão IA (sessões 005-006 IA Native). Estava ligada a fluxo `diploma_id`/`processo_id`, dupla checagem, chat IA |
| `processo_arquivos` | `20260406003445_create_processo_arquivos_table` | 06/04/2026 | Sessão 013/013b — Skills Fixas Deploy + RAG. Já vinha com `descricao_ia`, `tipo_documento` (text livre), `promovido_acervo` |

## Schema atual (descoberto via information_schema)

### `extracao_sessoes` (legado)
- `id`, `diploma_id`, `processo_id`, `documentos_enviados`, `dados_extraidos`, `dados_confirmados`, `campos_faltando`, `historico_chat`, `status`, `confianca_geral`, `confianca_campos`, `erro_mensagem`, `created_at`, `updated_at`
- **Falta** para o plano v2: `usuario_id`, `version`, `arquivos`

### `processo_arquivos` (legado)
- `id`, `processo_id`, `diploma_id`, `nome_original`, `tipo_documento`, `descricao_ia`, `storage_path`, `mime_type`, `tamanho_bytes`, `sha256`, `uploaded_by`, `promovido_acervo`, `acervo_doc_id`, `created_at`, `updated_at`
- **Falta** para o plano v2: `sessao_id`, `destino_processo`, `destino_xml`, `destino_acervo`, `tipo_xsd`, `ddc_id`

## Sobreposições funcionais (a consolidar futuramente)

| Conceito | Coluna legada | Coluna nova v2 |
|---|---|---|
| Tipo do documento | `tipo_documento` (text livre) | `tipo_xsd` (enum XSD v1.05) |
| Marca para acervo | `promovido_acervo` (bool) | `destino_acervo` (bool) |
| Hash | `sha256` | `hash_sha256` |
| FK acervo | `acervo_doc_id` | `acervo_documento_id` |

## Decisão Sprint 1 (aprovada por Marcelo 08/04/2026)

**Opção A — aditiva**: ADD COLUMN das colunas faltantes, mantendo o legado intacto. Migration de consolidação fica como tech-debt para sprint futura, depois que o novo fluxo estiver estável em produção.

## Why
Marcelo levantou (08/04/2026) que estamos perdendo informação não registrada. Esta memória existe para que futuras sessões saibam:
1. Que essas tabelas existem desde antes do plano v2
2. Quem as criou e em que contexto
3. Que há uma dívida técnica de consolidação no radar

## How to apply
Antes de qualquer ALTER em `extracao_sessoes` ou `processo_arquivos`, conferir esta memória + listar colunas atuais via `information_schema.columns`. Nunca assumir que o schema do plano v2 é o que está em produção.
