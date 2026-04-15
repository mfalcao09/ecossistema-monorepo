# Análise: Skills para Agentes Internos do ERP

> Pergunta do Marcelo: "Há como subirmos skills para os nossos agentes? Tipo o que trazemos aqui para trabalharmos. Quero entender como podemos dar ferramentas ao nosso agente para ele trabalhar cada vez melhor e ir aprimorando."

---

## Como Skills Funcionam Aqui (Cowork/Claude Code)

No ambiente Claude Code/Cowork, uma "skill" é basicamente um arquivo `.md` (Markdown) que contém:

1. **Frontmatter** — metadados (nome, descrição, quando acionar)
2. **Corpo** — instruções detalhadas, regras, exemplos, padrões

Quando o Claude recebe uma tarefa, ele lê o SKILL.md relevante e incorpora aquelas instruções no seu raciocínio. É como dar um "manual de operações" ao agente antes dele trabalhar.

**A chave:** skills são essencialmente **texto injetado no contexto do modelo** antes dele responder. Não é mágica — é engenharia de prompt estruturada.

---

## Como Trazer Isso Para os Agentes do ERP

Existem **4 caminhos possíveis**, do mais simples ao mais avançado:

---

### Caminho 1 — Skills como Texto no Campo `persona` (Já Funciona Hoje)

**Como:** O campo `persona` da tabela `ia_configuracoes` já é um text sem limite. Podemos colocar instruções detalhadas diretamente ali — que é exatamente o que estamos fazendo com os 3 agentes de cadastro.

**Prós:**
- Zero mudança no banco ou código
- Funciona agora
- Editável pela tela de configuração de agentes

**Contras:**
- Tudo num campo só — fica difícil manter se crescer muito
- Não é reutilizável (se dois agentes precisam da mesma skill, precisa copiar o texto)
- Sem versionamento

**Veredicto:** Bom para começar, mas não escala.

---

### Caminho 2 — Tabela `ia_skills` + Relacionamento N:N com Agentes ⭐ RECOMENDADO

**Como:** Criar uma tabela `ia_skills` no banco, onde cada skill é um registro com nome, conteúdo markdown, e tipo. Depois, uma tabela de junção `ia_agente_skills` liga agentes a skills.

```sql
-- Nova tabela
CREATE TABLE ia_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,           -- ex: "Regulamentação MEC"
  slug TEXT NOT NULL,           -- ex: "regulamentacao-mec"
  descricao TEXT,               -- quando usar esta skill
  conteudo TEXT NOT NULL,       -- o markdown completo da skill
  tipo TEXT DEFAULT 'conhecimento', -- 'conhecimento', 'procedimento', 'validacao', 'tom'
  ativo BOOLEAN DEFAULT true,
  versao INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de junção
CREATE TABLE ia_agente_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES ia_configuracoes(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES ia_skills(id) ON DELETE CASCADE,
  prioridade INTEGER DEFAULT 1,  -- ordem de injeção no prompt
  UNIQUE(agente_id, skill_id)
);
```

**Fluxo no código:**
1. API de chat busca o agente (ex: `cadastro_aluno`)
2. Busca as skills vinculadas ao agente, ordenadas por prioridade
3. Concatena: `persona do agente` + `\n\n---\n\n` + `skill 1` + `skill 2` + ...
4. Envia tudo como system prompt

**Exemplo prático:**
- Skill "Regulamentação MEC" → vinculada ao agente de Aluno e Professor
- Skill "Legislação Trabalhista" → vinculada ao agente de Colaborador
- Skill "Tom da FIC" → vinculada a TODOS os agentes
- Skill "Validação de CPF" → vinculada a todos os agentes de cadastro

**Prós:**
- Skills reutilizáveis entre agentes
- Fácil de ativar/desativar skills por agente
- Versionamento simples (campo versao)
- Editável via UI (tela de configuração)
- O admin pode criar skills sem tocar em código
- Escala para dezenas de agentes e skills

**Contras:**
- Precisa criar a tabela e a UI de gerenciamento
- Precisa cuidar do limite de tokens (skills grandes podem estourar o contexto)

**Veredicto:** Melhor custo-benefício. Dá poder ao admin sem complexidade excessiva.

---

### Caminho 3 — Skills como Arquivos .md no Storage + Hot Reload

**Como:** Salvar as skills como arquivos `.md` no Supabase Storage (bucket `ia-skills/`). O agente busca os arquivos relevantes antes de cada resposta.

**Prós:**
- Mais fácil de editar (upload de .md pelo painel)
- Pode versionar via nome de arquivo (v1, v2)
- Parecido com como funciona no Claude Code

**Contras:**
- Mais complexo de implementar (leitura de Storage + parse)
- Latência extra (buscar arquivos antes de cada resposta)
- Menos controle granular que o banco

**Veredicto:** Interessante mas overengineering para o momento.

---

### Caminho 4 — RAG (Retrieval-Augmented Generation) com Embeddings

**Como:** Cada skill é dividida em chunks, embeddings são gerados e armazenados no pgvector. Antes de responder, o agente faz uma busca semântica para encontrar os trechos mais relevantes.

**Prós:**
- Escala para centenas de skills
- Só injeta o que é relevante (economia de tokens)
- Base de conhecimento gigante sem estourar contexto

**Contras:**
- Muito mais complexo (embeddings, pgvector, pipeline de indexação)
- Overengineering brutal para 3 agentes
- Latência de busca semântica

**Veredicto:** Para o futuro, quando o ERP tiver muitos módulos e agentes.

---

## Minha Recomendação: Caminho 2 (Tabela ia_skills)

### Por quê?

1. **É o que mais se parece com o sistema de skills do Cowork**, mas adaptado ao nosso banco
2. **É reutilizável** — uma skill de "Tom de comunicação FIC" serve para todos os agentes
3. **O admin controla tudo pela UI** — sem precisar mexer em código
4. **Escala naturalmente** — quando vier o módulo de XML, módulo de assinatura, portal do diplomado, cada um terá seus agentes com suas skills
5. **É simples de implementar** — uma tabela, uma junção, um SELECT a mais na API

### Skills que já poderíamos criar de cara:

| Skill | Tipo | Agentes |
|-------|------|---------|
| Tom e Identidade FIC | tom | Todos |
| Documentos Pessoais Brasileiros | conhecimento | Aluno, Professor, Colaborador |
| Regulamentação MEC (Diploma Digital) | conhecimento | Aluno |
| Legislação Trabalhista Básica | conhecimento | Colaborador |
| Validação de Documentos (CPF, CEP, etc.) | validacao | Todos |
| Processo de Matrícula FIC | procedimento | Aluno |
| Processo de Contratação Docente FIC | procedimento | Professor |
| Processo de Admissão FIC | procedimento | Colaborador |

### Fluxo de Aprimoramento Contínuo

A ideia é que, com o tempo, possamos:
1. **Criar novas skills** quando surgirem padrões ou necessidades
2. **Vincular/desvincular** skills de agentes sem mexer no prompt principal
3. **Versionar** skills (v1 → v2) mantendo histórico
4. **Medir eficácia** (futuro: feedback do operador → nota → skill melhor ranqueada)

---

## Implementação Sugerida (Fases)

### Fase 1 — Agora
- Criar os 3 agentes com o `persona` completo (o prompt que já redigimos)
- Funciona perfeitamente sem skills separadas

### Fase 2 — Próxima Sprint
- Criar tabela `ia_skills` + `ia_agente_skills`
- Criar UI básica para gerenciar skills (CRUD)
- Extrair partes reutilizáveis dos prompts para skills separadas
- Ajustar API de chat para concatenar skills ao prompt

### Fase 3 — Futuro
- Feedback loop (operador avalia resposta → ajusta skill)
- RAG para skills muito grandes
- Skills automáticas (o agente sugere criar uma skill quando descobre um padrão)
