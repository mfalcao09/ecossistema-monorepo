# Biblioteca de Conhecimento Jurídico — Skill Aprimorada (RAG)

**Data:** 2026-04-08
**Origem:** Ideia de Marcelo na sessão 122 durante planejamento da Fase 5
**Status:** 💡 Ideia aprovada por Claudinho — aguardando detalhamento técnico

---

## Visão

Marcelo propõe criar uma **biblioteca de conhecimento jurídica** que receba upload de:
- Regras jurídicas (leis, normas técnicas, resoluções CONAMA, etc.)
- Livros de orientação jurídica (doutrina)
- Manuais de execução prática (know-how de advogados/engenheiros)

Essa biblioteca vira uma "skill aprimorada" que o Intentus usa para:
1. **Validar projetos de parcelamento** contra legislação vigente
2. **Responder perguntas** sobre conformidade legal em tempo real
3. **Gerar pareceres** com base em doutrina real, não apenas em pesos do modelo
4. **Escalar por região** (cada estado/município tem particularidades)

---

## Arquitetura Proposta (RAG — Retrieval-Augmented Generation)

### 1. Ingestão
```
PDF/DOC upload → Storage (bucket 'legal-knowledge-base')
              ↓
        EF knowledge-base-ingest
              ↓
  Chunking (500-1000 tokens, overlap 100)
              ↓
  Embedding (Gemini text-embedding-004, 768 dims)
              ↓
  Insert em parcelamento_knowledge_chunks (pgvector)
```

### 2. Retrieval
```
Pergunta do usuário
      ↓
Embedding da pergunta
      ↓
Similarity search (cosine) top-K chunks
      ↓
Re-ranking (opcional, LLM-based)
      ↓
Context injection
      ↓
Gemini 3.1 Pro gera resposta com citações
```

### 3. Schema (Draft)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE parcelamento_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('lei', 'doutrina', 'manual', 'resolucao', 'norma_tecnica')),
  jurisdiction TEXT, -- 'federal', 'estadual:SP', 'municipal:Piracicaba'
  authority TEXT, -- Nome do autor/órgão emissor
  publication_date DATE,
  file_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parcelamento_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES parcelamento_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON parcelamento_knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
```

---

## Fontes iniciais sugeridas

### Federais (obrigatórias)
- Lei 6.766/79 (parcelamento de solo urbano)
- Lei 4.591/64 (incorporações e condomínios)
- Lei 12.651/12 (Código Florestal — APP, Reserva Legal)
- Lei 6.015/73 (Registros Públicos)
- NBR 12.721 (cálculo de áreas em edificações)
- Lei 10.257/01 (Estatuto da Cidade)
- Resoluções CONAMA pertinentes (303/02, 369/06)

### Doutrina jurídica (upload manual por Marcelo)
- Livros de direito imobiliário
- Livros de direito ambiental
- Manuais de incorporação

### Municipais (scalar por demanda)
- Plano Diretor de Piracicaba (primeiro alvo)
- Planos Diretores de cidades onde Marcelo tem projetos

---

## Benefícios competitivos

1. **Diferencial real contra Lotelytics**: eles não têm conhecimento jurídico brasileiro embarcado
2. **Escalável por tenant**: cada cliente pode enriquecer com seus próprios documentos
3. **Auditável**: toda resposta IA cita a fonte exata (chunk + documento)
4. **Reduz alucinação**: Gemini fica "ancorado" no documento real
5. **Upsell natural**: clientes premium pagam por biblioteca enriquecida (upsell de assinatura)

---

## Riscos e atenções

- **Tamanho do banco**: embeddings ocupam espaço (1 PDF de 200 páginas ≈ 2MB de vetores)
- **Custo de embedding**: Gemini text-embedding-004 é gratuito até 1500 req/min, mas scale-up custa
- **Qualidade do chunking**: chunks muito pequenos perdem contexto, muito grandes diluem
- **Citação precisa**: precisa garantir que a resposta IA cite o chunk exato (não invente referências)
- **Atualização de leis**: precisa processo para reingerir quando lei é alterada

---

## Próximos passos (pós Bloco A)

1. Marcelo sobe os primeiros PDFs (Lei 6.766/79, Lei 4.591/64, Plano Diretor de Piracicaba)
2. Habilitar extensão pgvector no Supabase (já disponível, só precisa enable)
3. Criar schema acima via migration
4. Implementar EF `knowledge-base-ingest` + `knowledge-base-retrieve`
5. Integrar retrieval com a EF de compliance (Bloco B)
