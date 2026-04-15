---
name: Diplomado = só após registro pela UFMS
description: Um diplomado só deve ser listado em /diploma/diplomados após a registradora (UFMS) retornar o XML DiplomaDigital registrado — antes disso é apenas processo em emissão
type: feedback
---

**Regra:** A listagem de Diplomados em `/diploma/diplomados` deve conter EXCLUSIVAMENTE pessoas com pelo menos 1 diploma em status `registrado`, `gerando_rvdd`, `rvdd_gerado` ou `publicado` (ou seja, após retorno do XML registrado pela registradora UFMS — código MEC 694).

**Why:** FIC é apenas EMISSORA (gera 2 XMLs: HistoricoEscolar + DocAcademicaRegistro). O 3º XML (DiplomaDigital) é produzido pela REGISTRADORA (UFMS). Antes desse retorno, a pessoa é apenas "processo em emissão" — não é diplomada. Marcelo explicitou em 08/04/2026: "Os diplomados são apenas aqueles que tiveram o diploma registrado na UFMS. Um processo enquanto não houve ainda o retorno do XML registrado, não deve ser incluído em diplomados."

**How to apply:**
- Query da `/api/diplomados` GET deve filtrar por `diplomas!inner` com `status IN ('registrado','gerando_rvdd','rvdd_gerado','publicado')`
- Página `/diploma/processos` é o lugar de quem ainda está em emissão (até status < `registrado`)
- Cadastro de novo diplomado NÃO deve ser manual — diplomado "nasce" via processo que terminou com retorno da registradora
- O campo `codigo_validacao` do diploma só é populado pela registradora (NUNCA pela emissora) — é sinal alternativo de registro concluído
