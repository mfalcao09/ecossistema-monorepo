---
name: project_sessao_050_naturalidade_ibge
description: Sessão 050 (11/04): fix naturalidade — campo único→3 campos XSD (Município, Código IBGE 7 dígitos, UF) + auto-preenchimento API IBGE. Commit 0a1cacf.
type: project
---

Sessão 050 (11/04/2026): fix naturalidade FormularioRevisao.tsx

**Problema:** FormularioRevisao.tsx (Tela 2, `/diploma/processos/novo/revisao/[sessaoId]`) tratava naturalidade como campo ÚNICO de texto "Cidade - UF", mas o XSD v1.05 (`TNaturalidade` → `GMunicipio`) exige 3 campos obrigatórios:
- `NomeMunicipio` (texto, max 255)
- `CodigoMunicipio` (TCodMunIBGE, exatamente 7 dígitos)
- `UF` (enum 27 siglas)

**Causa:** O componente `SecaoPessoais.tsx` (Tela 3, `/diploma/processos/[id]`) já tinha os 3 campos corretos, mas `FormularioRevisao.tsx` (Tela 2) foi escrito na sessão 041 com campo único por simplificação.

**Fix (commit 0a1cacf):**
- Substituiu campo único por 3: Município, Código IBGE (com auto-preenchimento via `GET /api/ibge-municipios`), UF
- Adicionou `naturalidade_codigo_municipio` na interface `Diplomado`
- Auto-preenchimento com debounce 600ms usando a API IBGE que já existia
- Fallback para campo legado combinado (parse regex "Cidade - UF" ou "Cidade/UF")
- Badge contador atualizado de 7→9

**Código IBGE de referência:** Chapadão do Sul/MS = `5002951`

**Why:** Sem o campo `CodigoMunicipio`, o motor XML geraria XML inválido contra o XSD v1.05.

**How to apply:** Qualquer novo formulário que colete naturalidade DEVE ter os 3 campos separados (nunca campo único combinado).
