# Plano Unificado: Skills + RAG — IA Native ERP Educacional

> **Autor:** Claude (Opus 4) — Arquiteto-chefe
> **Data:** 05/04/2026
> **Status:** Aguardando aprovação
> **Escopo:** Caminho 2 (tabela ia_skills N:N) + Caminho 4 (RAG com embeddings pgvector)
> **Princípio:** Sistema 100% IA Native — a IA não é add-on, é fundação

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    OPERADOR (Browser)                    │
│         Cadastro Aluno / Professor / Colaborador         │
└──────────────────────┬──────────────────────────────────┘
                       │ pergunta / documento
                       ▼
┌──────────────────────────────────────────────────────────┐
│              API Route: /api/ia/chat                     │
│                                                          │
│  1. Identifica agente (cadastro_aluno, cadastro_prof...) │
│  2. Busca skills FIXAS vinculadas (ia_agente_skills)     │
│  3. Busca skills SEMÂNTICAS via RAG (pgvector)           │
│  4. Monta system prompt:                                 │
│     persona + skills fixas + chunks RAG + contexto       │
│  5. Chama LLM via OpenRouter                             │
└──────────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌─────────┐ ┌──────────┐
   │ ia_skills  │ │pgvector │ │ia_config │
   │ (markdown) │ │(chunks) │ │(agentes) │
   └────────────┘ └─────────┘ └──────────┘
```

### Duas Camadas de Conhecimento

| Camada | Mecanismo | Quando Usar | Exemplo |
|--------|-----------|-------------|---------|
| **Skills Fixas** | JOIN direto (ia_agente_skills) | Conhecimento que o agente SEMPRE precisa | "Tom da FIC", "Validação de CPF", "Processo de Matrícula" |
| **Skills RAG** | Busca semântica (pgvector) | Conhecimento sob demanda, quando relevante | "Portaria MEC 554/2019", "CLT Art. 29", "Manual do eSocial" |

**Por que duas camadas?**

- Skills fixas são injetadas SEMPRE (garantia de comportamento consistente)
- Skills RAG são injetadas SOMENTE quando a conversa demanda (economia de tokens)
- Um agente pode ter 3 skills fixas + acessar 50 skills via RAG sem estourar contexto

---

## 2. Modelo de Dados

### 2.1 Tabela `ia_skills`

Armazena o conteúdo completo de cada skill em markdown.

```sql
-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Tabela principal de skills
CREATE TABLE ia_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Identidade
  nome TEXT NOT NULL,                    -- "Regulamentação MEC — Diploma Digital"
  slug TEXT NOT NULL,                    -- "regulamentacao-mec-diploma"
  descricao TEXT,                        -- Quando usar esta skill (para o admin entender)

  -- Conteúdo
  conteudo TEXT NOT NULL,                -- Markdown completo da skill
  conteudo_resumo TEXT,                  -- Resumo de 2-3 frases (gerado por IA)

  -- Classificação
  tipo TEXT NOT NULL DEFAULT 'conhecimento',
    -- 'conhecimento'  = fatos, legislação, dados de referência
    -- 'procedimento'  = passo-a-passo, fluxos, checklists
    -- 'validacao'     = regras de validação, formatos, limites
    -- 'tom'           = personalidade, tom de voz, identidade
    -- 'contexto'      = informações institucionais, organograma

  categoria TEXT,                        -- agrupamento livre (ex: "legislacao", "processos_rh")

  -- Controle
  ativo BOOLEAN DEFAULT true,
  versao INTEGER DEFAULT 1,
  tamanho_tokens INTEGER,                -- estimativa de tokens (calculado no save)

  -- Metadados
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(tenant_id, slug)
);

-- Índices
CREATE INDEX idx_skills_tenant ON ia_skills(tenant_id);
CREATE INDEX idx_skills_tipo ON ia_skills(tipo);
CREATE INDEX idx_skills_ativo ON ia_skills(ativo) WHERE ativo = true;
```

### 2.2 Tabela `ia_agente_skills` (Junção N:N — Skills Fixas)

```sql
CREATE TABLE ia_agente_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id UUID NOT NULL REFERENCES ia_configuracoes(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES ia_skills(id) ON DELETE CASCADE,
  prioridade INTEGER DEFAULT 1,          -- ordem de injeção no prompt (1 = primeiro)
  modo TEXT DEFAULT 'fixo',              -- 'fixo' = sempre injetado, 'condicional' = só se RAG trouxer
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(agente_id, skill_id)
);

CREATE INDEX idx_agente_skills_agente ON ia_agente_skills(agente_id);
```

### 2.3 Tabela `ia_skill_chunks` (Chunks para RAG)

```sql
CREATE TABLE ia_skill_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES ia_skills(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Conteúdo do chunk
  conteudo TEXT NOT NULL,                -- Trecho de ~500 tokens
  posicao INTEGER NOT NULL,              -- Ordem do chunk na skill (1, 2, 3...)

  -- Metadados para retrieval
  titulo_secao TEXT,                     -- Título da seção de onde veio (ex: "Art. 5º — Requisitos")
  palavras_chave TEXT[],                 -- Keywords extraídas (para hybrid search)

  -- Embedding
  embedding vector(1536) NOT NULL,       -- Vetor de embedding (dimensão depende do modelo)

  -- Controle
  modelo_embedding TEXT NOT NULL,        -- Qual modelo gerou (ex: "text-embedding-3-small")
  versao_skill INTEGER NOT NULL,         -- Versão da skill quando o chunk foi gerado

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice HNSW para busca semântica rápida
CREATE INDEX idx_chunks_embedding ON ia_skill_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índices auxiliares
CREATE INDEX idx_chunks_skill ON ia_skill_chunks(skill_id);
CREATE INDEX idx_chunks_tenant ON ia_skill_chunks(tenant_id);

-- Índice GIN para hybrid search (palavras-chave)
CREATE INDEX idx_chunks_keywords ON ia_skill_chunks USING gin(palavras_chave);
```

### 2.4 Tabela `ia_skill_feedback` (Loop de Aprimoramento)

```sql
CREATE TABLE ia_skill_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  skill_id UUID REFERENCES ia_skills(id),
  chunk_id UUID REFERENCES ia_skill_chunks(id),
  agente_id UUID REFERENCES ia_configuracoes(id),

  -- Feedback
  tipo TEXT NOT NULL,                    -- 'util', 'irrelevante', 'incorreto', 'incompleto'
  contexto_pergunta TEXT,                -- O que o operador perguntou
  nota INTEGER CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,

  -- Quem deu feedback
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_skill ON ia_skill_feedback(skill_id);
```

---

## 3. Modelo de Embedding

### Escolha: `text-embedding-3-small` (OpenAI via OpenRouter)

| Critério | Decisão |
|----------|---------|
| **Modelo** | `openai/text-embedding-3-small` via OpenRouter |
| **Dimensão** | 1536 |
| **Custo** | ~$0.02 por 1M tokens (~R$ 0,10) |
| **Qualidade PT-BR** | Excelente (treinado em dados multilíngues) |
| **Alternativa** | `voyage-3-lite` ($0.02/1M) ou `gemini-embedding-001` (grátis até 1500 req/min) |

**Por que `text-embedding-3-small`?**
- Melhor custo-benefício para PT-BR
- 1536 dimensões é suficiente para nosso volume
- Via OpenRouter, usa a mesma API key que já temos
- Para 50 skills × ~10 chunks cada = ~500 chunks = ~250K tokens = **menos de R$ 0,05 por indexação completa**

**Alternativa gratuita (Gemini):**
- Google oferece `text-embedding-004` gratuito via API
- 768 dimensões, qualidade boa para PT-BR
- Podemos usar o provider Google AI que já está configurado
- Se quiser economia total, usamos este

### Implementação: Gerar Embeddings

```typescript
// src/lib/ai/embeddings.ts

interface EmbeddingResult {
  embedding: number[]
  modelo: string
  tokens_usados: number
}

/**
 * Gera embedding para um texto usando OpenRouter (text-embedding-3-small)
 */
export async function gerarEmbedding(
  texto: string,
  apiKey: string
): Promise<EmbeddingResult> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://diploma-digital.vercel.app',
      'X-Title': 'FIC ERP Educacional',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: texto,
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`)
  }

  const data = await response.json()

  return {
    embedding: data.data[0].embedding,
    modelo: 'text-embedding-3-small',
    tokens_usados: data.usage?.total_tokens || 0,
  }
}

/**
 * Gera embeddings em lote (até 100 textos por chamada)
 */
export async function gerarEmbeddingsBatch(
  textos: string[],
  apiKey: string
): Promise<EmbeddingResult[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://diploma-digital.vercel.app',
      'X-Title': 'FIC ERP Educacional',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: textos,
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding batch API error: ${response.status}`)
  }

  const data = await response.json()

  return data.data.map((item: any) => ({
    embedding: item.embedding,
    modelo: 'text-embedding-3-small',
    tokens_usados: Math.ceil((data.usage?.total_tokens || 0) / textos.length),
  }))
}
```

---

## 4. Estratégia de Chunking

### Regras

| Parâmetro | Valor | Motivo |
|-----------|-------|--------|
| **Tamanho alvo** | ~400-500 tokens (~300-400 palavras) | Granular o suficiente para retrieval preciso |
| **Tamanho máximo** | 800 tokens | Nunca ultrapassar |
| **Sobreposição** | 50 tokens (~2 frases) | Manter contexto nas bordas |
| **Separador primário** | `## ` (heading H2) | Skills em markdown têm seções claras |
| **Separador secundário** | `\n\n` (parágrafo) | Se seção for maior que 800 tokens |
| **Metadado** | Título da seção H2 + nome da skill | Enriquece o chunk para retrieval |

### Implementação: Chunking de Skills

```typescript
// src/lib/ai/chunking.ts

interface Chunk {
  conteudo: string
  posicao: number
  titulo_secao: string
  palavras_chave: string[]
}

/**
 * Divide uma skill markdown em chunks otimizados para RAG.
 * Respeita a estrutura de headings para manter contexto semântico.
 */
export function dividirSkillEmChunks(
  markdown: string,
  nomeSkill: string,
  maxTokens: number = 500,
  sobreposicao: number = 50
): Chunk[] {
  const chunks: Chunk[] = []
  let posicao = 1

  // 1. Dividir por seções H2
  const secoes = markdown.split(/^## /gm).filter(Boolean)

  for (const secao of secoes) {
    const linhas = secao.split('\n')
    const tituloSecao = linhas[0]?.trim() || nomeSkill
    const conteudoSecao = linhas.slice(1).join('\n').trim()

    // Se a seção cabe em um chunk, manter inteira
    const tokensEstimados = estimarTokens(conteudoSecao)

    if (tokensEstimados <= maxTokens) {
      if (conteudoSecao.length > 20) { // ignorar seções vazias
        chunks.push({
          conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${conteudoSecao}`,
          posicao: posicao++,
          titulo_secao: tituloSecao,
          palavras_chave: extrairPalavrasChave(conteudoSecao),
        })
      }
    } else {
      // Seção grande: dividir por parágrafos com sobreposição
      const paragrafos = conteudoSecao.split(/\n\n+/)
      let buffer = ''
      let bufferAnterior = ''

      for (const paragrafo of paragrafos) {
        const tokensCombinados = estimarTokens(buffer + '\n\n' + paragrafo)

        if (tokensCombinados > maxTokens && buffer.length > 0) {
          // Flush buffer como chunk
          chunks.push({
            conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${buffer}`,
            posicao: posicao++,
            titulo_secao: tituloSecao,
            palavras_chave: extrairPalavrasChave(buffer),
          })

          // Sobreposição: manter últimas frases do buffer anterior
          bufferAnterior = buffer.split(/[.!?]\s/).slice(-2).join('. ')
          buffer = bufferAnterior + '\n\n' + paragrafo
        } else {
          buffer += (buffer ? '\n\n' : '') + paragrafo
        }
      }

      // Último chunk da seção
      if (buffer.trim().length > 20) {
        chunks.push({
          conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${buffer}`,
          posicao: posicao++,
          titulo_secao: tituloSecao,
          palavras_chave: extrairPalavrasChave(buffer),
        })
      }
    }
  }

  return chunks
}

/**
 * Estima tokens de forma simples (1 token ≈ 4 caracteres em PT-BR)
 */
function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4)
}

/**
 * Extrai palavras-chave simples para hybrid search
 */
function extrairPalavrasChave(texto: string): string[] {
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
    'com', 'por', 'para', 'que', 'se', 'ou', 'um', 'uma', 'os', 'as',
    'ao', 'aos', 'às', 'pelo', 'pela', 'e', 'é', 'a', 'o', 'não',
    'ser', 'ter', 'como', 'mais', 'entre', 'sobre', 'sua', 'seu',
  ])

  const palavras = texto
    .toLowerCase()
    .replace(/[^\wáàãâéêíóôõúç\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 3 && !stopwords.has(p))

  // Contar frequência e retornar top 10
  const freq = new Map<string, number>()
  palavras.forEach(p => freq.set(p, (freq.get(p) || 0) + 1))

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([palavra]) => palavra)
}
```

---

## 5. Pipeline de Indexação

### Fluxo: Criar/Atualizar Skill → Chunking → Embedding → Salvar

```
Operador salva skill (UI)
        │
        ▼
  POST /api/ia/skills
        │
        ├─► INSERT ia_skills (conteúdo markdown)
        │
        ├─► chunking.dividirSkillEmChunks()
        │
        ├─► embeddings.gerarEmbeddingsBatch(chunks)
        │
        ├─► DELETE ia_skill_chunks WHERE skill_id = X  (limpa chunks antigos)
        │
        └─► INSERT ia_skill_chunks (chunks + embeddings)
```

### Quando Re-indexar?

| Evento | Ação |
|--------|------|
| Skill criada | Gerar chunks + embeddings |
| Skill editada | Deletar chunks antigos, gerar novos |
| Skill desativada | Manter chunks mas excluir do retrieval (WHERE ativo = true) |
| Skill deletada | CASCADE deleta chunks automaticamente |
| Modelo de embedding mudou | Batch re-index de todas as skills |

### API Route: Salvar Skill + Indexar

```typescript
// POST /api/ia/skills — Criar skill + indexar automaticamente
// PUT  /api/ia/skills/[id] — Atualizar skill + re-indexar
// GET  /api/ia/skills — Listar skills do tenant
// DELETE /api/ia/skills/[id] — Soft delete

// O indexação acontece SÍNCRONA no save (skills são pequenas, <5s total)
// Se no futuro skills ficarem grandes, mover para Edge Function assíncrona
```

---

## 6. Estratégia de Retrieval (Busca)

### Hybrid Search: Semântica + Keyword

```sql
-- Função de busca híbrida no PostgreSQL
CREATE OR REPLACE FUNCTION buscar_skills_rag(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_palavras_chave TEXT[] DEFAULT '{}',
  p_limite INTEGER DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  skill_id UUID,
  skill_nome TEXT,
  conteudo TEXT,
  titulo_secao TEXT,
  similaridade FLOAT,
  score_keyword FLOAT,
  score_final FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT
      c.id AS chunk_id,
      c.skill_id,
      s.nome AS skill_nome,
      c.conteudo,
      c.titulo_secao,
      1 - (c.embedding <=> p_query_embedding) AS similaridade,
      -- Keyword score: quantas palavras-chave batem
      CASE
        WHEN array_length(p_palavras_chave, 1) > 0 THEN
          (SELECT COUNT(*)::FLOAT / array_length(p_palavras_chave, 1)
           FROM unnest(p_palavras_chave) kw
           WHERE kw = ANY(c.palavras_chave))
        ELSE 0
      END AS score_keyword
    FROM ia_skill_chunks c
    JOIN ia_skills s ON s.id = c.skill_id
    WHERE c.tenant_id = p_tenant_id
      AND s.ativo = true
  )
  SELECT
    semantic.chunk_id,
    semantic.skill_id,
    semantic.skill_nome,
    semantic.conteudo,
    semantic.titulo_secao,
    semantic.similaridade,
    semantic.score_keyword,
    -- Score final: 70% semântico + 30% keyword
    (0.7 * semantic.similaridade + 0.3 * semantic.score_keyword) AS score_final
  FROM semantic
  WHERE semantic.similaridade >= p_threshold
  ORDER BY score_final DESC
  LIMIT p_limite;
END;
$$;
```

### Implementação TypeScript: Retrieval

```typescript
// src/lib/ai/rag.ts

interface ChunkResultado {
  chunk_id: string
  skill_id: string
  skill_nome: string
  conteudo: string
  titulo_secao: string
  similaridade: number
  score_final: number
}

/**
 * Busca chunks relevantes para uma pergunta do operador.
 * Combina busca semântica (embedding) + keyword matching.
 */
export async function buscarSkillsRAG(
  pergunta: string,
  tenantId: string,
  limite: number = 5,
  threshold: number = 0.3
): Promise<ChunkResultado[]> {
  const admin = getAdminClient()

  // 1. Gerar embedding da pergunta
  const config = await getIAConfig()
  const { embedding } = await gerarEmbedding(pergunta, config.apiKey)

  // 2. Extrair palavras-chave da pergunta
  const palavrasChave = extrairPalavrasChave(pergunta)

  // 3. Busca híbrida via função SQL
  const { data, error } = await admin.rpc('buscar_skills_rag', {
    p_tenant_id: tenantId,
    p_query_embedding: JSON.stringify(embedding),
    p_palavras_chave: palavrasChave,
    p_limite: limite,
    p_threshold: threshold,
  })

  if (error) {
    console.error('RAG search error:', error)
    return []
  }

  return data || []
}

/**
 * Formata chunks do RAG para injeção no system prompt.
 * Deduplica por skill e agrupa chunks da mesma skill.
 */
export function formatarChunksParaPrompt(chunks: ChunkResultado[]): string {
  if (chunks.length === 0) return ''

  // Agrupar por skill
  const porSkill = new Map<string, ChunkResultado[]>()
  for (const chunk of chunks) {
    const existing = porSkill.get(chunk.skill_nome) || []
    existing.push(chunk)
    porSkill.set(chunk.skill_nome, existing)
  }

  let resultado = '\n\n---\n## Base de Conhecimento (informações relevantes)\n\n'

  for (const [nomeSkill, skillChunks] of porSkill) {
    resultado += `### ${nomeSkill}\n\n`
    for (const chunk of skillChunks) {
      resultado += chunk.conteudo + '\n\n'
    }
  }

  resultado += '---\n\n'
  resultado += '*Use estas informações para fundamentar suas respostas. '
  resultado += 'Se a informação não cobrir a pergunta, diga que não tem certeza.*\n'

  return resultado
}
```

---

## 7. Montagem do Prompt Final (Orquestração)

### Fluxo Completo no Chat

```typescript
// Em /api/ia/chat/route.ts (modificado)

export const POST = protegerRota(async (req, { userId, tenantId }) => {
  const { messages, contexto } = await req.json()

  // 1. Identificar o agente correto pela categoria
  const funcionalidade = mapearCategoriaParaFuncionalidade(contexto.categorias)
  const config = await getIAConfig('pessoas', undefined, funcionalidade)

  // 2. Buscar skills FIXAS vinculadas ao agente
  const skillsFixas = await buscarSkillsFixas(config.agenteId)
  // → Retorna: ["Tom da FIC", "Validação de Documentos"]

  // 3. Buscar skills via RAG (baseado na última mensagem do operador)
  const ultimaMensagem = messages[messages.length - 1]?.content || ''
  const chunksRAG = await buscarSkillsRAG(ultimaMensagem, tenantId, 5)
  // → Retorna: chunks relevantes da base de conhecimento

  // 4. Montar prompt final
  const promptFinal = [
    config.persona,                          // Prompt base do agente
    '\n\n---\n',
    skillsFixas.map(s => s.conteudo).join('\n\n---\n\n'),  // Skills fixas
    formatarChunksParaPrompt(chunksRAG),     // Chunks RAG
    gerarContextoDinamico(contexto),         // Campos preenchidos, docs recebidos
  ].filter(Boolean).join('\n')

  // 5. Chamar LLM
  const result = streamText({
    model: openrouter(config.modelo),
    system: promptFinal,
    messages,
    tools: ferramentasIA,
    temperature: config.temperatura,
    maxTokens: 4096,
  })

  return result.toTextStreamResponse()
})
```

### Orçamento de Tokens do Prompt

| Componente | Tokens Estimados | Prioridade |
|------------|-----------------|------------|
| Persona do agente | ~1.500 | Obrigatório |
| Skills fixas (2-3) | ~2.000 | Obrigatório |
| Chunks RAG (3-5) | ~2.500 | Dinâmico |
| Contexto (campos, docs) | ~500 | Obrigatório |
| **Total system prompt** | **~6.500** | — |
| Histórico de conversa | ~3.000 | Variável |
| Resposta do modelo | ~1.000 | — |
| **Total por chamada** | **~10.500** | — |

Com Claude Sonnet 4.5 tendo 200K de contexto, estamos usando ~5% da janela. Muito espaço para crescer.

---

## 8. UI de Gerenciamento de Skills

### Tela: Configurações → IA → Aba "Skills"

```
┌─────────────────────────────────────────────────────┐
│  IA & Agentes    │  Providers    │  ★ Skills        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [+ Nova Skill]                    🔍 Buscar...     │
│                                                     │
│  ┌─ Conhecimento ──────────────────────────────┐    │
│  │ 📘 Regulamentação MEC        v2  ✅ Ativo   │    │
│  │    Vinculada a: Aluno, Professor             │    │
│  │    12 chunks · Última indexação: 05/04/2026  │    │
│  ├──────────────────────────────────────────────┤    │
│  │ 📘 Legislação Trabalhista     v1  ✅ Ativo   │    │
│  │    Vinculada a: Colaborador                  │    │
│  │    8 chunks · Última indexação: 05/04/2026   │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
│  ┌─ Tom & Identidade ─────────────────────────┐    │
│  │ 🎨 Tom de Comunicação FIC     v1  ✅ Ativo   │    │
│  │    Vinculada a: TODOS os agentes             │    │
│  │    3 chunks · Última indexação: 05/04/2026   │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
│  ┌─ Validação ────────────────────────────────┐    │
│  │ ✅ Validação de Documentos BR  v1  ✅ Ativo   │    │
│  │    Vinculada a: Aluno, Professor, Colaborador│    │
│  │    5 chunks · Última indexação: 05/04/2026   │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Modal: Editar Skill

```
┌─────────────────────────────────────────────────────┐
│  Editar Skill: Regulamentação MEC                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Nome: [Regulamentação MEC — Diploma Digital    ]   │
│  Tipo: [Conhecimento ▾]   Categoria: [legislacao]   │
│                                                     │
│  Conteúdo (Markdown):                               │
│  ┌─────────────────────────────────────────────┐    │
│  │ ## Portaria MEC 554/2019                    │    │
│  │                                              │    │
│  │ Dispõe sobre a emissão de diplomas em       │    │
│  │ formato digital nas IES pertencentes ao...  │    │
│  │                                              │    │
│  │ ## Requisitos Técnicos                       │    │
│  │                                              │    │
│  │ - XML assinado com ICP-Brasil (AD-RA)       │    │
│  │ - Certificado tipo A3 obrigatório...        │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Vincular a Agentes:                                │
│  [✅] Assistente Cadastro Alunos                     │
│  [✅] Assistente Cadastro Professores                │
│  [  ] Assistente Cadastro Colaboradores              │
│  Modo: (●) Fixa   (○) RAG-only                     │
│                                                     │
│        [Cancelar]  [Salvar e Indexar]                │
│                                                     │
│  📊 Stats: 12 chunks · ~4.800 tokens · v2          │
│  Última indexação: 05/04/2026 16:30                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 9. Skills Iniciais a Criar

| # | Nome | Tipo | Vinculada (Fixa) a | Disponível via RAG |
|---|------|------|-------|-----|
| 1 | Tom e Identidade FIC | tom | Aluno, Professor, Colaborador | Não |
| 2 | Validação de Documentos Brasileiros | validacao | Aluno, Professor, Colaborador | Não |
| 3 | Processo de Matrícula FIC | procedimento | Aluno | Sim |
| 4 | Processo de Contratação Docente | procedimento | Professor | Sim |
| 5 | Processo de Admissão CLT | procedimento | Colaborador | Sim |
| 6 | Regulamentação MEC — Diploma Digital | conhecimento | — | Sim |
| 7 | Legislação Trabalhista Básica (CLT) | conhecimento | — | Sim |
| 8 | Guia LGPD — Dados Pessoais | conhecimento | — | Sim |
| 9 | Cursos e Grades da FIC | contexto | Aluno | Sim |
| 10 | Organograma e Setores FIC | contexto | Colaborador | Sim |

---

## 10. Faseamento da Implementação

### Fase 1 — Agora (esta sessão)
> **Duração:** 1 sessão
> **Entrega:** 3 agentes funcionais

- [x] Criar prompts dos 3 agentes (já aprovados)
- [ ] INSERT 3 agentes na `ia_configuracoes`
- [ ] Alterar API `/api/ia/chat` para rotear por categoria
- [ ] Alterar componente `AssistenteChat.tsx` (mensagem dinâmica)
- [ ] Alterar `page.tsx` do novo para passar categorias ao chat
- [ ] Testar e deployar

### Fase 2 — Skills Fixas (próxima sessão)
> **Duração:** 1-2 sessões
> **Entrega:** Tabela de skills + UI + skills fixas injetadas

- [ ] Criar tabela `ia_skills` + `ia_agente_skills`
- [ ] Criar API CRUD `/api/ia/skills`
- [ ] Criar aba "Skills" na tela de configuração IA
- [ ] Criar as 3 skills fixas iniciais (Tom, Validação, Processo)
- [ ] Alterar API de chat para injetar skills fixas no prompt
- [ ] Testar e deployar

### Fase 3 — RAG + Embeddings (sessão seguinte)
> **Duração:** 2-3 sessões
> **Entrega:** Pipeline RAG completo funcionando

- [ ] Habilitar extensão pgvector no Supabase
- [ ] Criar tabela `ia_skill_chunks`
- [ ] Implementar `embeddings.ts` (geração via OpenRouter)
- [ ] Implementar `chunking.ts` (divisão inteligente)
- [ ] Implementar `rag.ts` (busca híbrida)
- [ ] Criar função SQL `buscar_skills_rag`
- [ ] Alterar API de skills para indexar automaticamente no save
- [ ] Alterar API de chat para incluir RAG no prompt
- [ ] Criar as skills de conhecimento (regulamentação, CLT, LGPD)
- [ ] Testar retrieval com perguntas reais
- [ ] Deployar

### Fase 4 — Feedback Loop (futuro)
> **Duração:** 1 sessão
> **Entrega:** Loop de aprimoramento contínuo

- [ ] Criar tabela `ia_skill_feedback`
- [ ] Adicionar botões 👍/👎 nas respostas do assistente
- [ ] Dashboard de eficácia das skills
- [ ] Sugestão automática de novas skills

---

## 11. Custos Estimados

| Componente | Volume Mensal | Custo |
|------------|---------------|-------|
| Embeddings (indexação) | ~500 chunks × re-index 2x/mês | ~R$ 0,10 |
| Embeddings (queries) | ~1.000 perguntas/mês | ~R$ 0,05 |
| LLM (chat com skills) | ~1.000 chamadas × 10K tokens | Já incluso no uso atual |
| **Total adicional** | | **~R$ 0,15/mês** |

O custo do RAG é desprezível. O investimento real é em tempo de desenvolvimento.

---

## 12. Decisões Técnicas Pendentes

| Decisão | Opções | Recomendação |
|---------|--------|--------------|
| Modelo de embedding | text-embedding-3-small (pago) vs Gemini embedding (grátis) | text-embedding-3-small (melhor qualidade PT-BR) |
| Dimensão do vetor | 1536 (small) vs 768 (Gemini) | 1536 (mais preciso) |
| Indexação | Síncrona no save vs Edge Function async | Síncrona (skills são pequenas) |
| Re-ranking | Sem re-ranker vs Cohere rerank | Sem (volume pequeno, hybrid search basta) |
| Cache de embeddings | Sem cache vs Redis | Sem (volume baixo, pgvector é rápido) |
