---
name: Bug #E — DataExpedicaoDiploma (Caminho C)
description: Fix definitivo do Bug #E no motor XML — DataExpedicaoDiploma derivada automaticamente, sem chance de a FIC preencher errado
type: project
---

Bug #E (Onda 2) resolvido em 2026-04-07 via Caminho C (refatoração completa). Commit `24755f2`, deploy Vercel `dpl_4eAYuGbtKtVGvtHXaioUswmsXppv` READY.

**O que mudou:**
1. Novo helper `gerarDataExpedicaoXML()` em `src/lib/xml/builders/base.builder.ts` — retorna data atual no fuso `America/Sao_Paulo` via `Intl.DateTimeFormat` (servidor Vercel roda UTC, então `new Date()` direto erraria após ~21h BRT).
2. `historico.builder.ts` chama o helper diretamente ao montar `TSituacaoFormado.DataExpedicaoDiploma` — NÃO lê mais do payload.
3. Removido `data_expedicao` de `DadosDiploma.diploma` e `data_expedicao_diploma` de `historico.situacao_discente` em `tipos.ts`. TypeScript agora bloqueia em compile-time qualquer chamador que tente passar esses campos.
4. Limpeza em cascata: `montador.ts` (não lê mais a coluna), `business-rules.ts` (removeu validação obsoleta), `exemplo-uso.ts`, `__tests__/gerador.test.ts`, `INTEGRACAO.md`.

**Why:** XSD `leiautehistoricoescolar_v1.05.xsd` linhas 415-421 (`TSituacaoFormado`) torna `DataExpedicaoDiploma` obrigatória (`minOccurs="1"`) quando o discente é "Formado". Semanticamente é a data em que a IES emissora expede o diploma — coincide com a data de geração do XML (per IN 05). A FIC NUNCA preenche `DataExpedicaoDiploma` dentro de `TLivroRegistro` (XSD diploma linhas 500/532) — isso é exclusivo da REGISTRADORA.

**How to apply:** Para qualquer novo campo do XML que (a) deva sempre vir do momento da geração e (b) não faça sentido o operador editar — derivar via helper no builder e remover do tipo de entrada. A trava por TypeScript é mais forte que validação runtime porque pega regressões em build, não em produção.
