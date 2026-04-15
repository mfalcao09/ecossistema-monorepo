---
name: Motor XML — Assinantes (TInfoAssinantes) XSD v1.05
description: Estrutura correta do bloco Assinantes dentro de DadosDiploma — só CPF + Cargo|OutroCargo, sem Nome
type: project
---

Implementado em `src/lib/xml/builders/assinantes.builder.ts` (sessão 021, commit `0c25a58`).

**Posicionamento**: dentro de `<DadosDiploma>`, APÓS `<IesEmissora>` e ANTES das `<ds:Signature>` (que serão adicionadas pela API BRy depois).

**Estrutura emitida:**
```xml
<Assinantes>
  <Assinante>
    <CPF>00000000000</CPF>
    <Cargo>Reitor</Cargo>           <!-- ou <OutroCargo>Vice-Reitor</OutroCargo> -->
  </Assinante>
</Assinantes>
```

**IMPORTANTE — diferença vs documentos internos**: O XSD `TInfoAssinantes` NÃO tem `<Nome>` dentro de `<Assinante>`. Só CPF + (Cargo OU OutroCargo). O nome é apenas referência interna do nosso banco. Não duplicar no XML.

**Enum `TCargosAssinantes` (8 cargos válidos do XSD v1.05):**
1. Reitor
2. Reitor em Exercício
3. Responsável pelo registro
4. Coordenador de Curso
5. Subcoordenador de Curso
6. Coordenador de Curso em exercício
7. Chefe da área de registro de diplomas
8. Chefe em exercício da área de registro de diplomas

Qualquer cargo fora desse enum vai como `<OutroCargo>`. Comparação case-sensitive.

**Cardinalidade**: `<Assinantes>` é opcional dentro de `<DadosDiploma>`, mas `<Assinante>` tem `minOccurs=1` dentro de `<Assinantes>`. Por isso, se não houver assinantes válidos, o builder OMITE o bloco inteiro em vez de emitir `<Assinantes/>` vazio (que quebra o XSD).

**Ordenação**: por `ordem_assinatura` (asc). O eCNPJ deve ter o maior número (assinar por último, conforme regra ICP-Brasil).

**How to apply**: ao mexer em qualquer XML que vai para a registradora, lembrar que `<Assinantes>` ≠ `AutoridadesIesEmissora` (nome legacy de docs antigos) e que NÃO leva `<Nome>`.
