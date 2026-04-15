---
name: Bug #F tela React pronta
description: Tela SelecaoComprobatorios.tsx criada, fixes #1+#7 aplicados, type-check OK, commit travado por .git/index.lock
type: project
---

Bug #F finalizado do lado do código (sessão 2026-04-07). Motor XML 12/12 (100%).

**Arquivos modificados (type-check limpo):**
- `src/app/api/processos/[id]/gerar-xml/route.ts` — fix #1 (auditoria grava override_ativo + override_justificativa + counts pdfa_ok/fail) e fix #7 (no caminho override com 0 docs, só o histórico vai para xml_gerados; doc_academica_registro NÃO é inserido vazio)
- `src/lib/xml/exemplo-uso.ts` — mock `DocumentoComprobatorioParaXml` atualizado para o schema `PdfAResult { base64, tamanho_bytes, sha256, validation_ok, validation_errors, cached }`
- `src/components/diploma/SelecaoComprobatorios.tsx` — criado (~700 linhas), Tailwind puro + lucide-react, header resumo, grid de CardArquivo, StatusPdfA (válido/avisos/aguardando), DialogSelecao com tipo_xsd + observação (500 chars) + metadata interna colapsável. Edit = DELETE+POST porque API não tem PATCH.

**Why:** Bug #F era o último bloqueante do motor XML. Fixes #1 e #7 vieram do self-review do orquestrador (sessão anterior, MCP MiniMax deu timeout). Tela React é o entregável do "caminho 1" solicitado pelo Marcelo ("Vamos no caminho 1 e 3").

**How to apply:** Commit pendente — `.git/index.lock` de 06/04 travado por bindfs `--delete-deny`. Marcelo precisa rodar `rm .git/index.lock` no host Mac. Mensagem de commit pronta:

```
feat(diploma): tela de seleção de comprobatórios + fixes orquestrador XML

- SelecaoComprobatorios.tsx: tela de seleção de docs para XML (Bug #F caminho 1)
- gerar-xml route: fix #1 auditoria grava override + fix #7 não salva doc_academica vazio
- exemplo-uso.ts: mock atualizado para novo shape DocumentoComprobatorioParaXml

Motor XML agora em 12/12 (100%).
```

**Não aplicado (follow-up):**
- Fix #2 race condition em delete+insert de xml_gerados (precisa advisory lock ou mudança de schema — UNIQUE (diploma_id, tipo, status) DEFERRABLE)
- Fix #3 dead code (select de codigo_validacao nunca usado)
- Fix #6 Sentry no catch principal

**Pendentes sessão seguinte:**
1. Commit + push
2. Job Trigger.dev backup R2 dos PDF/A
3. Testes unit + integração + XSD
4. Deploy Vercel + Railway
