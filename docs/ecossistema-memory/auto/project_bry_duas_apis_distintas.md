---
name: BRy oferece DUAS APIs distintas — diploma vs documentos gerais da IES
description: Distinção crítica entre api-diploma-digital (para XMLs do Diploma MEC) e api-assinatura-digital (para todos os outros documentos da IES). Não é Lei 14.063 — são produtos separados do BRy.
type: project
---

Esclarecimento de Marcelo em 07/04/2026: o BRy oferece **duas APIs distintas** para cada finalidade. Não é distinção de assinatura eletrônica vs digital (Lei 14.063), são **dois produtos/endpoints separados** no portfólio BRy:

**1. API Diploma Digital (apenas XMLs do Diploma Digital MEC)**
- Endpoint homologação: `https://api-assinatura.hom.bry.com.br/api-diploma-digital`
- Finalidade exclusiva: assinar os 3 XMLs do Diploma Digital MEC
- Padrão: XAdES AD-RA, certificado ICP-Brasil A3
- Já documentado em `docs/bry-api-referencia-tecnica.md`
- Já integrado no projeto

**2. API Assinatura Digital (todos os demais documentos da IES)**
- Endpoint homologação: `https://api-assinatura.hom.bry.com.br/api-assinatura-digital`
- Finalidade: qualquer documento expedido pela IES — histórico em PDF, declaração de matrícula, atestado de frequência, certificado de conclusão pré-diploma, declaração para fins de estágio, contratos, etc.
- AINDA NÃO INTEGRADA no projeto
- Vai alimentar o módulo "Expedição de Documentos" (a planejar)

**Por que importa:**
Marcelo confirmou em 07/04/2026 que **toda documentação emitida pela IES deve ser digitalizada e assinada via BRy**. Isso significa um módulo "Expedição de Documentos" inteiro que ainda não existe. O histórico escolar em PDF é apenas o primeiro caso de uso desse módulo maior.

**Why:** Eu havia interpretado erroneamente que a "assinatura eletrônica BRy" mencionada por Marcelo se referia à Lei 14.063/2020 (eletrônica simples/avançada vs digital qualificada). Na verdade ele estava se referindo aos dois endpoints/produtos separados do BRy. Ambos provavelmente usam ICP-Brasil; a diferença é a finalidade (Diploma MEC vs documentos gerais IES).

**How to apply:**
- Ao planejar o módulo Expedição de Documentos, integrar com `api-assinatura-digital` BRy
- Manter a integração existente com `api-diploma-digital` BRy isolada — é específica do Diploma MEC
- Quando o histórico do XML for gerado no pipeline de criação do processo, ele pode opcionalmente disparar a geração paralela do PDF nato-digital via api-assinatura-digital
- Documentar ambos os endpoints na referência técnica do projeto
- Não confundir: "assinatura eletrônica BRy" no contexto deste projeto = endpoint api-assinatura-digital, NÃO Lei 14.063
