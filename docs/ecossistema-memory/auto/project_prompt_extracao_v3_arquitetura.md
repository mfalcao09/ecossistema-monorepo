---
name: Prompt Extração v3 + Arquitetura Fan-Out/Reducer
description: Decisão arquitetural aprovada — prompt isolado por documento + Reducer relacional para correlação cross-document (docente↔disciplina↔titulação)
type: project
---

## Decisão (10/04/2026)

Marcelo propôs e Claude validou nova arquitetura de extração:

**Arquitetura: Fan-Out → Worker Individual → Reducer Relacional → Tela 2**

### Prompt v3 (PROMPT_EXTRACAO_ISOLADA)
- Cada arquivo vai individualmente ao Gemini (mantém Cenário B)
- Prompt com "gavetas" tipadas por tipo de documento
- 15 tipos de documento reconhecidos
- Gavetas específicas: `horarios_extraidos`, `titulacoes_historicas`, `enem`, `enade`, `historico_ensino_medio`
- `confianca_campos` por campo (não só global)
- Genitores com estrutura `{ nome, sexo }` (XSD TFiliacao)
- Disciplinas com `conceito`, `forma_integralizacao`, `docente`

### Reducer (substituirá agregarDados())
- JOIN relacional: disciplina × horário (por nome+ano+semestre) → descobre professor
- JOIN relacional: professor × planilha_titulacao (por nome+data) → descobre titulação na época
- Merge escalares: primeiro-não-nulo-ganha (por campo, não spread)
- Fuzzy matching obrigatório: normalize BR (acentos, prefixos acadêmicos, Levenshtein)

### Pendência: Fonte dos dados institucionais
- Horário de Aulas e Planilha de Titulação são docs INSTITUCIONAIS (não do aluno)
- 3 opções: (A) upload semestral, (B) tabela docentes no banco, (C) híbrida
- Não definido ainda — Marcelo precisa decidir

### Lembrete Backend: nota vs conceito
- XSD exige OU nota OU conceito por disciplina, não ambos
- Backend (montarDadosDiploma) deve: `const avaliacao = disciplina.nota ? { Nota: disciplina.nota } : { Conceito: disciplina.conceito }`
- Tratar no builder XML, não no prompt

### Status
- **Prompt v3: ✅ APROVADO** (10/04/2026) — Marcelo + Claude + consultor externo
- Próximo passo: implementação Sprint A (substituir extractor.js no Railway)

**Why:** Extração atual (prompt genérico + agregarDados shallow) tem resultado ruim com muita inconsistência.
**How to apply:** Implementar em 4 sprints: A (novo prompt), B (novo Reducer), C (contexto institucional), D (ajustes Tela 2).
