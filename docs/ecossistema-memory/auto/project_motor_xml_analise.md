---
name: Análise Motor XML — plano de 4 sprints
description: Análise profunda do motor de geração XML com 7 gaps identificados, arquitetura modular proposta, e plano de 4 sprints (9-13 dias)
type: project
---

## Motor de Geração XML — Estado e Plano (05/04/2026)

**Estado atual:** Motor funcional em `src/lib/xml/` com 4 arquivos (gerador.ts 24KB, tipos.ts 9KB, montador.ts 17KB, validador.ts 9KB). Gera 2 XMLs da emissora. Usa string concatenation manual, validação apenas regex.

**7 gaps identificados:**
1. 🔴 String concatenation frágil (migrar para xmlbuilder2)
2. 🔴 Validação XSD fake (apenas regex, não valida contra schema real)
3. 🟡 Arquivo monolítico 24KB (modularizar em builders)
4. 🟡 Sem testes automatizados de conformidade XSD
5. 🟡 Math.random() no código de validação (trocar por crypto)
6. 🟡 Versão XSD hardcoded
7. 🟢 xmlbuilder2 instalado mas não usado

**Decisões técnicas propostas:**
- Geração: Migrar para xmlbuilder2 (escape automático, -60% código)
- Validação: fast-xml-parser (estrutural) + verificador MEC (conformidade)
- Testes: Vitest com snapshots XML + validação estrutural

**Plano de 4 sprints:**
- Sprint XML-1 (3-4d): Fundação modular com xmlbuilder2 + builders
- Sprint XML-2 (3-4d): Geradores completos + validação
- Sprint XML-3 (2-3d): Integração no endpoint + migração
- Sprint XML-4 (1-2d): Qualidade + verificador MEC + documentação

**XSD alvo:** v1.05 (confirmado por Marcelo em 05/04/2026)

**Why:** Motor XML é o coração do Diploma Digital, precisa ser robusto e validado antes de integrar assinatura.
**How to apply:** Consultar ao iniciar sprints de XML. Documento completo em `ANALISE-MOTOR-XML.md`.
