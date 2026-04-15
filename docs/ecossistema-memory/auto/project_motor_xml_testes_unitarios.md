---
name: Motor XML — testes unitários 17/17 passando (sessão 025)
description: Vitest configurado, gerador.test.ts corrigido para API atual — 17/17 testes passando. Próximo: teste e2e com processo real após excluir e recriar processo Kauana.
type: project
---

**Fato:** Motor XML tem 17/17 testes unitários passando (sessão 025). `vitest.config.ts` criado com path alias `@/`. `gerador.test.ts` corrigido para 3 mudanças de API: (1) `gerarCodigoValidacao()` depreciada lança erro, (2) `gerarCodigoValidacaoHistorico()` exige 7 campos incluindo `codigoMecEmissora`, (3) `gerarXMLs()` exige 2º argumento `DocumentosComprobatoriosNonEmpty`.

**Why:** Motor XML 12/12 bugs resolvidos (sessão 023). Testes são a validação antes do teste e2e com dados reais.

**How to apply:** Antes de testar e2e: (1) excluir processo Kauana legado + recriar pelo fluxo atual, (2) inserir ao menos 1 doc comprobatório real, (3) chamar `POST /api/processos/{id}/gerar-xml`. RA da Kauana já populado: `1707458863`.
