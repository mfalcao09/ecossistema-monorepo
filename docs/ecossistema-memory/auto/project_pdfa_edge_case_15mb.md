---
name: PDF/A > 15MB edge case (RESOLVIDO commit 3d074f4)
description: Edge case do converter-service quando PDF/A excede 15MB — fail-fast + cleanup do blob órfão aplicados no commit 2 do Caminho B do Bug #F
type: project
---

**Status: RESOLVIDO** — fix preventivo aplicado no commit `3d074f4` (deploy `dpl_5CYR8FQs6fJNEWg75Bd4webUkHST` READY em 2026-04-07).

Mudanças no `src/lib/pdfa/converter-service.ts`:

1. **Constante exportada `MAX_PDFA_BYTES = 15 * 1024 * 1024`** — espelha o CHECK constraint da tabela `diploma_documentos_comprobatorios`.
2. **Fail-fast** antes do upload: se `pdfaBuffer.length > MAX_PDFA_BYTES`, lança `PdfAConversionError` ANTES de tocar o Storage. Zero blob órfão neste caminho.
3. **Cleanup em UPDATE failure**: se o UPDATE da metadata falhar, deleta o blob de `documentos-pdfa` E re-throw `PdfAConversionError` (em vez de apenas logar). Quebra o loop infinito.

**Why:** Descoberto durante self-review do commit 1 do Caminho B (Bug #F). Aplicado preventivamente no commit 2 (que ainda é producer-only) antes que qualquer consumer pudesse disparar o loop.

**How to apply:**
- Quando o RG escaneado vier muito grande (alta resolução), o gerador XML agora vai falhar **com mensagem clara** apontando o `ddcId` em vez de loopar silenciosamente
- Se na prática RGs > 15MB se tornarem comuns, considerar widening para 30MB via migration + atualizar `MAX_PDFA_BYTES`
- A constante está exportada — outros consumers (ex.: tela de upload de comprobatórios) podem reutilizar para validação client-side preventiva
