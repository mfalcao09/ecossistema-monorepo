---
name: Bug #F — Motor XML 12/12 (100%) completo — PDF/A + SelecaoComprobatorios
description: Bug #F — Motor XML 12/12 (100%) completo — PDF/A + SelecaoComprobatorios
type: project
project: erp
tags: ["motor-xml", "bug-f", "pdfa", "ghostscript", "railway"]
success_score: 0.95
supabase_id: 4d669c20-f6dd-4c81-9974-7b19a34a3e96
created_at: 2026-04-13 09:19:20.356428+00
updated_at: 2026-04-13 16:05:47.887694+00
---

Bug #F fechado com 5 commits do Caminho B. Infraestrutura: tabela diploma_documentos_comprobatorios + bucket documentos-pdfa (15MB max, Ghostscript no Railway US$5/mês). Commits: ee6ec62 (converter-service + client), 3d074f4 (gerarXMLs aceita comprobatorios opcional + fix PDF/A >15MB), 01215c7 (route gerar-xml consumer real + regra DOCUMENTACAO_COMPROBATORIA_VAZIA + override), 6c94180 (tela SelecaoComprobatorios.tsx 808 linhas + CRUD API), 139b5d5 (migrations sincronizadas). Motor XML 100%. Próximo: teste e2e com processo Kauana.
