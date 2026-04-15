---
name: XSD MEC versão vigente é 1.05
description: O motor XML do Diploma Digital FIC usa XSD v1.05 (NÃO v1.06). Marcelo confirmou e enviou todos os schemas em 07/04/2026.
type: project
---

XSD vigente do MEC para o Diploma Digital é **v1.05**, não v1.06.

O CLAUDE.md do projeto tinha uma menção errada a "XSD v1.06" — desconsiderar.

**Why:** Marcelo enviou os 17 arquivos XSD em 07/04/2026 durante a sessão 023 do Bug #F e confirmou explicitamente: "Nós estamos utilizando a versão 1.05, grave isso".

**How to apply:** Sempre que escrever, validar ou referenciar XSD do Diploma Digital, MEC, Documentação Acadêmica, Histórico Escolar ou Currículo, usar v1.05. Os arquivos estão em `/sessions/intelligent-adoring-ramanujan/mnt/uploads/`:
- `documentacaoacademicaregistrodiplomadigital_v1-05.xsd.xml` (tipos)
- `leiautedocumentacaoacademicaregistrodiplomadigital_v1-05.xsd.xml` (root element)
- `diplomadigital_v1-05.xsd.xml` + `leiautediplomadigital_v1-05.xsd.xml`
- `historicoescolardigital_v1-05.xsd.xml` + `leiautehistoricoescolar_v1-05.xsd.xml`
- `curriculoescolardigital_v1-05.xsd.xml` + `leiautecurriculoescolar_v1-05.xsd.xml`
- `arquivofiscalizacao_v1-05.xsd.xml` + `leiautearquivofiscalizacao_v1-05.xsd.xml`
- `tiposbasicos_v1-05.xsd.xml` (TInfoAssinantes, enums, tipos primitivos)
- `xmldsig-core-schema_v1-1.xsd.xml` (assinatura XAdES)

Documentação técnica: `nota-tecnica.pdf`, `anexo_1_versao_1.01.pdf`, `in-05-versao-completa-anexos-i-ii-e-iii-v1.05.pdf`.
