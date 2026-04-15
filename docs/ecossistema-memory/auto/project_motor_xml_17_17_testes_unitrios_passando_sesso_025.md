---
name: Motor XML 17/17 testes unitários passando (sessão 025)
description: Motor XML 17/17 testes unitários passando (sessão 025)
type: project
project: erp
tags: ["motor-xml", "testes", "vitest", "xsd"]
success_score: 0.9
supabase_id: ad917a65-9609-4d93-9cc6-6962f3b78ddd
created_at: 2026-04-13 09:19:20.356428+00
updated_at: 2026-04-13 16:05:45.039791+00
---

Motor XML tem 17/17 testes unitários passando. vitest.config.ts criado com path alias @/. gerador.test.ts corrigido para 3 mudanças de API: (1) gerarCodigoValidacao() depreciada lança erro, (2) gerarCodigoValidacaoHistorico() exige 7 campos incluindo codigoMecEmissora, (3) gerarXMLs() exige 2º argumento DocumentosComprobatoriosNonEmpty. Próximo: teste e2e após recriar processo Kauana (RA=1707458863, excluir processo legado + recriar pelo fluxo atual + inserir 1 doc comprobatório real + chamar POST /api/processos/{id}/gerar-xml).
