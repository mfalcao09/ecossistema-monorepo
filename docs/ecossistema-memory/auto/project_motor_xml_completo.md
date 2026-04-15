---
name: Motor XML v2 — Implementação completa
description: Motor XML v2 implementado com xmlbuilder2, 15+ arquivos, compilação limpa — Sprints 1-4 concluídos
type: project
---

Motor de geração XML v2 implementado e compilando sem erros (tsc --noEmit clean).

**Arquitetura:**
- `src/lib/xml/builders/` — 8 builders modulares (base, endereco, ato-regulatorio, diplomado, curso, ies-emissora, historico, dados-privados)
- `src/lib/xml/generators/` — 2 generators (historico-escolar, doc-academica)
- `src/lib/xml/validation/` — xsd-validator (fast-xml-parser) + business-rules (regras MEC)
- `src/lib/xml/legacy/` — gerador-v1.ts (referência)
- Facade backward-compatible: gerador.ts + validador.ts + index.ts

**Decisões técnicas:**
- xmlbuilder2 v3.1.1 para construção XML (builder pattern)
- fast-xml-parser para validação estrutural (serverless-compatible)
- Validação em 1 camada apenas (sem validador MEC externo — XMLs ainda não assinados)
- XSD v1.05 (versão vigente confirmada)
- `import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces'` — tipo não exportado do pacote principal
- crypto.randomBytes() no lugar de Math.random() para códigos de validação

**Why:** Módulo 2 do ERP — motor XML é pré-requisito para assinatura digital e RVDD
**How to apply:** Ao trabalhar com geração XML, usar os builders v2 em src/lib/xml/builders/, nunca o legado
