# Tabelas legadas — `extracao_sessoes` + `processo_arquivos`

> **Descoberta:** sessão 028 (08/04/2026), durante Sprint 1 do plano v2.
> **Decisão:** Opção A (aditiva) — manter colunas legadas, adicionar as do plano v2 com ALTER TABLE.
> **Tech-debt no radar:** consolidação posterior ao MVP.

## Origens (via list_migrations Supabase)

| Tabela | Migration | Data | Sessão provável |
|---|---|---|---|
| `extracao_sessoes` | `20260321101335_criar_modulo_emissao_ia` | 21/03/2026 | 005-006 (IA Native — módulo de emissão IA) |
| `processo_arquivos` | `20260406003445_create_processo_arquivos_table` | 06/04/2026 | 013 (Skills Fixas Deploy + RAG) |

## Schema legado vs. plano v2

### `extracao_sessoes`
| Coluna | Origem | Tipo |
|---|---|---|
| `id`, `diploma_id`, `processo_id` | legado | uuid |
| `documentos_enviados`, `dados_extraidos`, `dados_confirmados`, `campos_faltando`, `historico_chat`, `confianca_campos` | legado | jsonb |
| `status`, `erro_mensagem` | legado | text |
| `confianca_geral` | legado | double precision |
| `created_at`, `updated_at` | legado | timestamptz |
| `usuario_id` | **v2 ADD** | uuid → auth.users |
| `version` | **v2 ADD** | int (optimistic locking) |
| `arquivos` | **v2 ADD** | jsonb (lista de arquivos da sessão antes de virar processo) |

### `processo_arquivos`
| Coluna | Origem | Tipo |
|---|---|---|
| `id`, `processo_id`, `diploma_id`, `acervo_doc_id`, `uploaded_by` | legado | uuid |
| `nome_original`, `tipo_documento`, `descricao_ia`, `storage_path`, `mime_type`, `sha256` | legado | text |
| `tamanho_bytes` | legado | bigint |
| `promovido_acervo` | legado | boolean |
| `created_at`, `updated_at` | legado | timestamptz |
| `sessao_id` | **v2 ADD** | uuid → extracao_sessoes |
| `destino_processo`, `destino_xml`, `destino_acervo` | **v2 ADD** | boolean (regra dos 3 destinos) |
| `tipo_xsd` | **v2 ADD** | text com CHECK enum (9 valores XSD v1.05) |
| `ddc_id` | **v2 ADD** | uuid → diploma_documentos_comprobatorios |

## Sobreposições funcionais (tech-debt para consolidação)

| Conceito | Coluna legada | Coluna nova | Estratégia futura |
|---|---|---|---|
| Tipo do documento | `tipo_documento` (text livre) | `tipo_xsd` (enum) | Migrar valores comuns; depreciar `tipo_documento` |
| Marca para acervo | `promovido_acervo` (bool) | `destino_acervo` (bool) | Sincronizar em trigger temporário; remover `promovido_acervo` na consolidação |
| Hash SHA-256 | `sha256` | (não duplicar — usar `sha256`) | Já decidido: não criar `hash_sha256` |
| FK acervo | `acervo_doc_id` | (não duplicar — usar `acervo_doc_id`) | Já decidido: não criar `acervo_documento_id` |

**Importante:** Decisão pragmática para Opção A — não vou criar `hash_sha256` nem `acervo_documento_id`. Vou reutilizar as colunas legadas `sha256` e `acervo_doc_id` que já fazem o trabalho. Isso reduz a sobreposição e simplifica a consolidação futura.

## Code paths que tocam essas tabelas (a respeitar no Sprint 1)

- `extracao_sessoes`: provavelmente usado em algum código de Dupla Checagem (removido na sessão 014 mas pode ter consumidores residuais). Verificar com grep antes do push.
- `processo_arquivos`: usado pelo módulo Skills Fixas (sessão 013), Acervo Acadêmico Digital (Decreto 10.278), e fluxo de upload. Verificar.

## Por que esta memória existe

Marcelo apontou na sessão 028: "estamos perdendo muita informação não registrada em memória". Esta página garante que futuras sessões saibam:
1. As tabelas existem desde antes do plano v2 (não são novas).
2. Opção A foi a escolha consciente — não é "preguiça", é redução de risco.
3. A consolidação é uma dívida técnica conhecida, não um esquecimento.
