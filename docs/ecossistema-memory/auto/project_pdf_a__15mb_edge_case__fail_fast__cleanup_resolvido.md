---
name: PDF/A > 15MB edge case — fail-fast + cleanup resolvido
description: PDF/A > 15MB edge case — fail-fast + cleanup resolvido
type: project
project: erp
tags: ["pdfa", "converter", "15mb", "bug-f"]
success_score: 0.9
supabase_id: 1dc41e39-e880-43cd-b0a9-87479f20432b
created_at: 2026-04-13 09:26:27.981004+00
updated_at: 2026-04-13 20:06:25.388185+00
---

RESOLVIDO commit 3d074f4, deploy dpl_5CYR READY (07/04/2026). Mudanças converter-service.ts: (1) MAX_PDFA_BYTES = 15MB constante exportada (espelha CHECK constraint tabela); (2) fail-fast antes do upload se buffer > 15MB → PdfAConversionError ANTES de tocar Storage (zero blob órfão); (3) cleanup em UPDATE failure → deleta blob de documentos-pdfa + re-throw (quebra loop infinito). How to apply: se RGs > 15MB tornarem-se comuns, widening 30MB via migration + atualizar MAX_PDFA_BYTES. Constante exportada — outros consumers podem reutilizar para validação client-side.
