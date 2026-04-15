---
name: Sessão 048 — Prompt v3 + Reducer Relacional
description: Sprint A implementada — prompt gavetas tipadas + consolidarDados() com JOIN relacional docente↔disciplina↔titulação + UI conceito/integralização
type: project
---

## Sessão 048 (10/04/2026)

**Commit:** `5d7ea69` — `feat(extracao): prompt v3 + Reducer relacional com gavetas tipadas`

### O que foi feito (Sprint A completa)

1. **extractor.js** — Prompt v3 reescrito do zero:
   - 15 tipos de documento com gavetas tipadas
   - `confianca_campos` por campo (não só global)
   - Disciplinas com `conceito`, `forma_integralizacao`, `docente`
   - `horarios_extraidos` e `titulacoes_historicas` como gavetas dedicadas
   - maxOutputTokens 65536, temperature 0.1, timeout 90s

2. **server.js** — `agregarDados()` substituído por `consolidarDados()`:
   - `normalizarNome()` — remove acentos, uppercase, tira prefixos acadêmicos
   - `similaridade()` — Jaccard tokens com threshold 0.6
   - `mergeCampoACampo()` — primeiro-não-nulo-ganha recursivo
   - JOIN disciplina × horário → descobre docente
   - JOIN docente × planilha_titulacao → descobre titulação temporal
   - `determinarTitulacao()` — grau mais alto na época da disciplina
   - Flatten RG object → `rg`, `rg_orgao`, `rg_uf`
   - Flatten naturalidade → `naturalidade_cidade`, `naturalidade_uf`
   - Mapping `data_ingresso` → `data_inicio`, `carga_horaria_total` → `carga_horaria`

3. **FormularioRevisao.tsx** — Novas colunas na tabela de disciplinas:
   - `<th>Conceito</th>` + `<td>` cell
   - `<th>Integraliz.</th>` + `<td>` cell (forma_integralizacao)

### Verificação
- TypeScript: 0 erros nos arquivos fonte (só vitest devDep)
- Coerência prompt ↔ reducer ↔ UI: ✅ verificado por agente independente
- Push: OK (`d50c597..5d7ea69 main → main`)
- Deploy Vercel: automático via GitHub integration

### Pendência (Sprints B-D)
- **Sprint B**: Reducer avançado (fuzzy matching mais robusto, edge cases)
- **Sprint C**: Contexto institucional (upload horários/titulações separado dos docs do aluno)
- **Sprint D**: Ajustes Tela 2 baseados em feedback real de extração

**Why:** Extração anterior tinha resultados inconsistentes. Arquitetura Fan-Out/Reducer com gavetas tipadas resolve correlação cross-document.
**How to apply:** Testar com documentos reais e avaliar qualidade da extração antes de avançar para Sprint B.
