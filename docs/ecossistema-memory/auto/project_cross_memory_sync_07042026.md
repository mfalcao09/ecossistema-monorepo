---
name: Cross-Memory Sync 07/04/2026
description: Registro do alinhamento cross-project feito em 07/04/2026 — divergências encontradas e corrigidas
type: project
---

# Cross-Memory Sync — 07/04/2026

Sincronização completa entre ERP-Educacional/memory/, intentus-plataform/memory/ e CENTRAL-MEMORY.md.

## Divergências Encontradas e Corrigidas

### 1. XSD versão incorreta (CRÍTICA)
- **Problema:** CLAUDE.md (ERP), CENTRAL-MEMORY.md e SINTESE.md diziam "XSD v1.06"
- **Correto:** XSD vigente é **v1.05** (confirmado por Marcelo em 07/04/2026 com envio dos 17 arquivos)
- **Arquivos corrigidos:** `ERP-Educacional/CLAUDE.md`, `ERP-Educacional/memory/MEMORY.md`, `ERP-Educacional/memory/sessions/SINTESE.md`, `CENTRAL-MEMORY.md`

### 2. Contagem de sessões desatualizada na CENTRAL
- **ERP:** "10 sessões + squad-init" → **22 sessões + cross + squad-init**
- **Intentus:** "113 sessões" → **116 sessões** (correto, MEMORY.md do projeto já estava atualizado)

### 3. Edge Functions desatualizadas na CENTRAL
- **Intentus:** "88 EFs" → **101+ EFs** (alinhado com CLAUDE.md do projeto)

### 4. ERP — Vercel e GitHub como "a configurar"
- **Vercel:** está configurado com 40+ deploys automáticos
- **GitHub:** `github.com/mfalcao09/diploma-digital` (PAT configurado)

### 5. Status do ERP desatualizado
- **Antes:** "Diploma Digital 🔄 (Fase 1-2)"
- **Depois:** Motor XML 🔄 (11/12 bugs ~92%), Skills+RAG ✅

### 6. Novo módulo Parcelamento de Solo ausente na CENTRAL
- **Intentus:** PRD v0.2 aprovado (137 US), Caminho A+C+Brasil, geoespacial prioridade

### 7. Modelo Gemini desatualizado na CENTRAL
- **Antes:** "Gemini 2.0 Flash" (descontinuado)
- **Depois:** `gemini-2.5-flash`

### 8. Sentry ausente na CENTRAL
- Instalado em ambos os projetos: `@sentry/react+vite-plugin` (Intentus) + `@sentry/nextjs` (ERP)
- Org: `mfalcao-organization`

## Arquivos Modificados
1. `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md` — 7 edições
2. `/ERP-Educacional/CLAUDE.md` — fix XSD v1.06 → v1.05
3. `/ERP-Educacional/memory/MEMORY.md` — fix tensão XSD
4. `/ERP-Educacional/memory/sessions/SINTESE.md` — fix prioridade XSD
5. `/intentus-plataform/memory/MEMORY.md` — nota de sync adicionada

**Why:** CENTRAL-MEMORY.md estava 2 dias desatualizada (última atualização 05/04/2026), acumulando 8 divergências. O mais crítico era a versão XSD incorreta que poderia causar erros no desenvolvimento do motor XML.

**How to apply:** Ao iniciar qualquer sessão que envolva motor XML ou conformidade, sempre verificar se XSD referenciado é v1.05.
