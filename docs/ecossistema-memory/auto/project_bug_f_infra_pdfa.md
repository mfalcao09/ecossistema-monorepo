---
name: Bug #F infra — tabela diploma_documentos_comprobatorios + bucket documentos-pdfa
description: Infraestrutura inicial do Bug #F (PDF/A base64) aplicada em 2026-04-07 sessão 023
type: project
---

**Fato:** Em 2026-04-07 (sessão 023) foi aplicada a migration `20260407_documentos_comprobatorios_pdfa.sql` no projeto Supabase `ifdnjieklngcfodmtied` (sa-east-1). Criou:
- Enums `tipo_documento_comprobatorio` (RG, CNH, Passaporte, CertidaoNascimento, Outro) e `pdfa_engine` (ghostscript, cloudconvert, manual)
- Tabela `public.diploma_documentos_comprobatorios` (26 colunas, 6 índices, 4 policies RLS authenticated, trigger updated_at, 2 CHECK constraints)
- Bucket privado `documentos-pdfa` no Supabase Storage (15MB max, só application/pdf, read authenticated / write service_role)

**Why:** Bug #F é o único bloqueador restante do motor XML (11/12 resolvidos). O `<DocumentacaoComprobatoria>` do XML `DocumentacaoAcademicaRegistro` precisa de documento de identidade em PDF/A-2 base64. Decisão arquitetural chave (Marcelo, sessão 023): **reaproveitar uploads já existentes em `processo_arquivos`** em vez de criar novo fluxo de upload. Conversão é **lazy** (só quando clica Gerar XML) com **cache** por `arquivo_origem_id`. Engine escolhida: **Ghostscript em microserviço Railway** (US$5/mês, dados no perímetro, reaproveita depois para PDF/A do RVDD).

**How to apply:**
- Para inserir um novo comprobatório, use o padrão `processo_id + arquivo_origem_id + tipo_xsd` — o índice `uq_ddc_processo_arquivo` impede duplicatas.
- Para listar pendentes de backup R2: `WHERE r2_backed_up_at IS NULL AND pdfa_storage_path IS NOT NULL AND deleted_at IS NULL` (usa `idx_ddc_backup_pendente`).
- Para cache de conversão: antes de converter, checar se já existe linha com o mesmo `arquivo_origem_id` e `pdfa_storage_path IS NOT NULL` — se sim, reutiliza o PDF/A (economiza chamada ao Ghostscript).
- RLS segue padrão do projeto (authenticated full access, controle fino nas API routes com `protegerRota` + skipCSRF).
- Constraint `ddc_pdfa_coerencia` impede estado inconsistente: ou todos os campos PDF/A estão preenchidos, ou nenhum.
- Próximos passos pendentes: microserviço Ghostscript (Passo 2), docs deploy Railway (3), client TS (4), API route (5), atualizar doc-academica.generator.ts (6), regra negócio mínimo 1 doc (7), tela React (8), job R2 Trigger.dev (9), testes (10), deploy (11).

**Status do Caminho B (5 commits incrementais):**
- ✅ Commit 1 `ee6ec62` (READY `dpl_9F4Kf6GfJhDUGSVFw64tBtunpzUy`): converter-service.ts + client microserviço (producer-only)
- ✅ Commit 2 `3d074f4` (READY `dpl_5CYR8FQs6fJNEWg75Bd4webUkHST`): `gerarXMLs` aceita `comprobatorios` opcional via overload backwards-compat + tipo `DocumentosComprobatoriosNonEmpty` exportado + fix preventivo PDF/A > 15MB no converter-service (fail-fast + cleanup blob órfão). Ainda producer-only — zero risco em produção.
- ✅ Commit 3 `01215c7` (READY `dpl_J881KauKg2xZyab7uzvPAp5N7DUX`): route `gerar-xml` é PRIMEIRO consumer real — carrega PDF/A via `obterTodosPdfABase64DoProcesso` (service_role client inline), nova regra `DOCUMENTACAO_COMPROBATORIA_VAZIA` (422 com override), fix #1 (cadeia de custódia grava override_ativo + pdfa counts), fix #7 (doc_academica_registro NÃO persistido no caminho override com 0 docs).
- ✅ Commit 4 `6c94180` (READY `dpl_3jgkx3td3nz22iCKVBn1dsHNFcGD`): tela `SelecaoComprobatorios.tsx` (808 linhas, recuperada do revertido fccbbf2) + rota CRUD `src/app/api/processos/[id]/documentos-comprobatorios/route.ts` (GET/POST/DELETE soft-delete, admin client inline só para signed URLs, heurística sugerirTipoXsd, validação enum 9 valores). tsc limpo, next build limpo com NODE_OPTIONS=--max-old-space-size=4096.
- ✅ Commit 5 `139b5d5` (READY `dpl_Av4Kp5kCpuuSpxXRqKuVTQh1NCny`): dois arquivos de migração no repo (`20260407054356_documentos_comprobatorios_pdfa.sql` + `20260407065629_fix_tipo_documento_comprobatorio_enum_xsd_v105.sql`) sincronizando o histórico do repo com o estado real do Supabase. Puramente DDL, sem mudanças de código. **Caminho B fechado — Bug #F resolvido (12/12 motor XML 100%).**
