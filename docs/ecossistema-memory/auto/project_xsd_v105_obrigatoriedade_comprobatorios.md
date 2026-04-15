---
name: XSD v1.05 — Obrigatoriedade e cardinalidade dos comprobatórios por rito
description: Análise direta do XSD v1.05 sobre quando DocumentacaoComprobatoria é obrigatória, mínimo de Documentos, e regra de repetição de tipos
type: project
---

Análise feita em 07/04/2026 lendo `xsd/v1.05/leiauteDocumentacaoAcademicaRegistroDiplomaDigital_v1.05.xsd` (autoritativo).

**Cardinalidade de `DocumentacaoComprobatoria` por rito de registro:**

| Rito | ComplexType | minOccurs | Status |
|------|-------------|-----------|--------|
| Normal (com fluxo seriado) | TRegistroReq | **1** | **OBRIGATÓRIA** (linha 38) |
| NSF (sem fluxo seriado) | TRegistroReqNSF | 0 | Opcional (linha 74) |
| Segunda via | TRegistroSegundaViaReq | 0 | Opcional (linha 113) |
| Por decisão judicial | TRegistroPorDecisaoJudicialReq | 0 | Opcional, com tipo especial `TDocumentacaoComprobatoriaPorDecisaoJudicial` que aceita `Documento_Indisponivel` (linha 150) |

**Cardinalidade de `Documento` dentro de `TDocumentacaoComprobatoria`:**
- `minOccurs="1" maxOccurs="unbounded"` → **mínimo 1, sem máximo** (linha 233).
- O atributo `tipo` (TTipoDocumentacao) NÃO é unique → **repetição de tipos é permitida** (ex: 2 ProvaColacao, 3 ComprovacaoEstagioCurricular).

**Enum TTipoDocumentacao (9 valores, linhas 278-286):**
1. DocumentoIdentidadeDoAluno
2. ProvaConclusaoEnsinoMedio
3. ProvaColacao
4. ComprovacaoEstagioCurricular
5. CertidaoNascimento
6. CertidaoCasamento
7. TituloEleitor
8. AtoNaturalizacao
9. Outros

**Estrutura do `<Documento>`:** flat — só atributos `tipo` (obrigatório) + `observacoes` (opcional) + base64 PDF/A (TPdfA). Sem subelementos numero/orgao/uf/data — esses ficam só como metadata interna do banco.

**Conclusão para FIC:** No rito normal (que é 99% dos casos), o XSD exige **pelo menos 1** comprobatório. O XSD NÃO especifica QUAIS tipos são obrigatórios — só que pelo menos 1 documento deve existir. Regras adicionais (ex: "RG sempre obrigatório", "histórico do EM obrigatório") são regras de NEGÓCIO da IES, não do XSD.

**Why:** Marcelo perguntou "o que o XSD fala sobre obrigatórios" para definir o gate de validação na tela de criação de processo. O XSD é menos restritivo do que parece — o mínimo absoluto é 1 documento de qualquer tipo. Tudo além disso é decisão da FIC.

**How to apply:** Ao implementar o gate de "Criar processo", validar `comprobatorios.length >= 1` no rito normal. Para regras adicionais (ex: exigir RG + histórico do EM), criar lista configurável separada — não cravar no código.
