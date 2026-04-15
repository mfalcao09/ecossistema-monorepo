# Plano Arquitetural — Sistema IA Native do ERP FIC

**Data:** 21/03/2026
**Arquiteto:** Claude (Opus 4) — Arquiteto-chefe
**Status:** Aprovação pendente do Marcelo

---

## 1. VISÃO DO PRODUTO

O usuário não preenche formulários. Ele **conversa com a IA e joga documentos**.

### Fluxo ideal (experiência do usuário):

```
1. Usuário abre /pessoas/novo
2. Vê uma tela dividida: FORMULÁRIO (esquerda) + CHAT IA (direita)
3. Arrasta uma pasta com documentos do aluno (RG, CPF, comprovante, histórico)
4. A IA começa a processar — campo por campo vai sendo preenchido em tempo real
5. IA diz no chat: "Encontrei o nome João da Silva no RG. CPF: 123.456.789-00"
6. IA detecta documento faltante: "Não encontrei certidão de nascimento. Pode enviar?"
7. IA pergunta: "Em qual curso deseja matriculá-lo?"
8. Usuário responde: "Direito noturno"
9. IA preenche vínculo automaticamente e pergunta: "Forma de pagamento?"
10. Usuário confirma, clica "Salvar" — pessoa cadastrada com todos os docs
```

---

## 2. ARQUITETURA TÉCNICA

### 2.1 Stack de IA

| Componente | Tecnologia | Motivo |
|-----------|-----------|--------|
| **LLM Principal** | Anthropic Claude API (claude-sonnet-4-20250514) | Melhor custo-benefício para extração + chat |
| **SDK** | Vercel AI SDK (`ai` package) | Streaming nativo, suporte a tools, integra com Next.js |
| **OCR de documentos** | Visão do Claude (multimodal) | Claude lê imagens diretamente — não precisa de OCR separado |
| **Fallback OCR** | Tesseract.js (client-side) | Para pré-processamento de PDFs com baixa qualidade |
| **Extração de PDF** | pdf.js (client-side) | Extrai texto de PDFs antes de enviar ao Claude |

### Por que NÃO usar Google Vision / AWS Textract?
- Claude já é multimodal — lê imagens diretamente
- Menos uma dependência externa = menos custo, menos complexidade
- Claude entende CONTEXTO (sabe que "Nome" no RG é o nome da pessoa)
- Google/AWS extraem texto cru; Claude extrai SIGNIFICADO

### 2.2 Streaming de Preenchimento

```
Browser ←── Server-Sent Events (SSE) ←── API Route ←── Claude API (streaming)
```

**Vercel AI SDK** já faz isso nativamente:
- `useChat()` hook no frontend → streaming de mensagens
- `streamText()` no backend → streaming da resposta do Claude
- **Tool calling** do Claude → preenche campos em tempo real

O Claude vai usar **tools** (function calling) para preencher o formulário:

```typescript
tools: {
  preencherCampo: {
    description: "Preenche um campo do formulário com dado extraído",
    parameters: {
      campo: "nome | cpf | data_nascimento | sexo | ...",
      valor: "valor extraído",
      confianca: "alta | media | baixa",
      fonte: "qual documento originou o dado"
    }
  },
  solicitarDocumento: {
    description: "Pede ao usuário um documento que está faltando",
    parameters: {
      tipo: "rg | cpf | certidao | comprovante | historico",
      motivo: "explicação do porquê é necessário"
    }
  },
  perguntarUsuario: {
    description: "Faz uma pergunta contextual ao usuário",
    parameters: {
      pergunta: "texto da pergunta",
      opcoes: ["opção 1", "opção 2"],  // opcional
      campo_relacionado: "qual campo será preenchido com a resposta"
    }
  },
  adicionarDocumento: {
    description: "Registra um documento processado na lista de documentos da pessoa",
    parameters: {
      tipo: "rg | cpf | cnh | ...",
      numero: "número do documento",
      orgao_expedidor: "SSP/SP, etc",
      data_expedicao: "data"
    }
  },
  adicionarEndereco: {
    description: "Preenche endereço a partir de comprovante de residência",
    parameters: {
      cep: "...", logradouro: "...", numero: "...",
      bairro: "...", cidade: "...", uf: "..."
    }
  },
  adicionarContato: {
    description: "Adiciona contato encontrado nos documentos",
    parameters: {
      tipo: "email | celular | telefone_fixo",
      valor: "..."
    }
  }
}
```

### 2.3 Fluxo de Processamento de Documentos

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                      │
│                                                          │
│  1. Usuário faz upload (drag & drop / seleção)          │
│  2. Para cada arquivo:                                   │
│     - Imagem (JPG/PNG) → converte para base64           │
│     - PDF → pdf.js extrai texto + renderiza páginas     │
│     - Se PDF for imagem → captura como canvas → base64  │
│  3. Envia para API via streaming                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              API ROUTE (Server)                           │
│                                                          │
│  4. Recebe arquivos + contexto atual do formulário      │
│  5. Monta prompt com:                                    │
│     - System prompt (regras de extração)                │
│     - Imagens/textos dos documentos                     │
│     - Estado atual dos campos (o que já tem)            │
│     - Checklist de documentos obrigatórios              │
│  6. Chama Claude com streaming + tools                  │
│  7. Cada tool call → SSE event para o browser           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              BROWSER (React - recebe SSE)                │
│                                                          │
│  8. Recebe tool calls em tempo real:                    │
│     - preencherCampo → atualiza estado do form          │
│     - campo ganha animação de "preenchido pela IA"      │
│     - solicitarDocumento → mostra alerta no chat        │
│     - perguntarUsuario → mostra pergunta com botões     │
│  9. Usuário vê campos sendo preenchidos ao vivo         │
│ 10. Pode corrigir qualquer campo manualmente            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. CHECKLIST INTELIGENTE DE DOCUMENTOS

### 3.1 Modelo de dados (nova tabela)

```sql
CREATE TABLE checklist_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES instituicoes(id),
  tipo_vinculo tipo_vinculo NOT NULL,        -- aluno, professor, colaborador...
  tipo_documento VARCHAR(50) NOT NULL,        -- rg, cpf, certidao_nascimento...
  obrigatorio BOOLEAN DEFAULT true,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, tipo_vinculo, tipo_documento)
);
```

### 3.2 Seed padrão

| Tipo Vínculo | Documentos Obrigatórios |
|-------------|------------------------|
| **aluno** | RG, CPF, Certidão Nascimento/Casamento, Comprovante Residência, Histórico Escolar, Foto 3x4 |
| **professor** | RG, CPF, Comprovante Residência, Diploma Graduação, Diploma Pós (se houver), Currículo Lattes |
| **colaborador** | RG, CPF, CTPS, Comprovante Residência, Certidão Nascimento/Casamento |

### 3.3 Como a IA usa o checklist

O system prompt inclui:
```
"Documentos obrigatórios para ALUNO: RG, CPF, Certidão, Comprovante, Histórico, Foto.
 Documentos já recebidos: RG (processado), CPF (processado).
 Documentos faltantes: Certidão, Comprovante, Histórico, Foto.
 Ao terminar de processar, use a tool solicitarDocumento para pedir os faltantes."
```

---

## 4. INTERFACE DO CHAT

### 4.1 Layout: Split Panel (recomendado)

```
┌────────────────────────────────────────────────────────────┐
│  ← Voltar    Nova Pessoa                        [Salvar]   │
├──────────────────────────────┬─────────────────────────────┤
│                              │                             │
│   FORMULÁRIO                 │   ASSISTENTE IA             │
│   (campos preenchíveis)      │                             │
│                              │   🤖 "Olá! Arraste os      │
│   Nome: [João da Silva  ✨]  │   documentos do aluno ou    │
│   CPF:  [123.456.789-00 ✨]  │   me diga o que precisa."   │
│   DN:   [15/03/2000     ✨]  │                             │
│   Sexo: [Masculino      ✨]  │   📎 Upload de documentos   │
│   ...                        │   [Arraste arquivos aqui]   │
│                              │                             │
│   ── Documentos ──           │   ✅ RG processado          │
│   ✅ RG - SSP/SP             │   ✅ CPF verificado          │
│   ✅ CPF                     │   ⚠️ Falta: Comprovante     │
│   ⬜ Comprovante             │   ⚠️ Falta: Histórico       │
│   ⬜ Histórico               │                             │
│                              │   🤖 "Em qual curso deseja  │
│   ── Endereço ──             │   matriculá-lo?"            │
│   CEP: [01234-567      ✨]   │   [Direito] [Pedagogia]     │
│   Rua: [Av. Paulista   ✨]   │   [Administração] [Outro]   │
│   ...                        │                             │
│                              │   👤 "Direito noturno"      │
│                              │                             │
│                              │   🤖 "Perfeito! Vínculo     │
│                              │   de aluno criado para      │
│                              │   Direito - Noturno."       │
│                              │                             │
│                              │   [Digite sua mensagem...]  │
├──────────────────────────────┴─────────────────────────────┤
│  Progresso: ████████████░░░░ 75% completo                  │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Indicadores visuais

- **✨ Sparkle** nos campos preenchidos pela IA (animação sutil)
- **Confiança**: borda verde (alta), amarela (média), vermelha (baixa)
- **Progresso**: barra mostrando % de campos preenchidos + documentos recebidos
- **Checklist visual**: documentos com ✅ (ok), ⬜ (faltando), 🔄 (processando)

---

## 5. GESTÃO DE CUSTOS

### 5.1 Estimativa por cadastro

| Operação | Tokens estimados | Custo (Sonnet) |
|---------|-----------------|----------------|
| System prompt | ~2.000 input | $0.006 |
| 1 imagem de documento | ~1.600 input | $0.005 |
| 5 documentos (média) | ~8.000 input | $0.024 |
| Respostas + tool calls | ~2.000 output | $0.020 |
| Chat (3-5 mensagens) | ~1.500 total | $0.010 |
| **Total por cadastro** | **~15.000** | **~$0.065 (~R$ 0,35)** |

### 5.2 Para IES com 2.000 alunos/ano

- Cadastros novos: ~500/ano (vestibular) + ~200 rematrículas com documentos novos
- **Custo anual estimado: ~R$ 245** (700 cadastros × R$ 0,35)
- Isso é MUITO barato — o plano mais barato do ERP será R$ 2.500/mês

### 5.3 Otimizações de custo

1. **Cache de extração**: Se o mesmo documento (hash) já foi processado, usar resultado cached
2. **Sonnet para extração, Haiku para chat simples**: perguntas básicas usam modelo mais barato
3. **Extração de texto de PDF no client**: Manda texto, não imagem, quando possível (muito mais barato)
4. **Batch processing**: Processa todos os documentos em UMA chamada ao Claude (não uma por documento)
5. **Limite por tenant**: Controlar uso via parametros_sistema (ex: max_ia_calls_per_month)

---

## 6. ESTRUTURA DE ARQUIVOS

```
src/
├── lib/
│   ├── ai/
│   │   ├── config.ts              # Configuração Anthropic/Vercel AI SDK
│   │   ├── prompts/
│   │   │   ├── system-pessoa.ts   # System prompt para cadastro de pessoas
│   │   │   ├── system-extrator.ts # System prompt para extração de documentos
│   │   │   └── checklist.ts       # Gera checklist dinâmico por tipo_vinculo
│   │   ├── tools/
│   │   │   ├── preencher-campo.ts
│   │   │   ├── solicitar-documento.ts
│   │   │   ├── perguntar-usuario.ts
│   │   │   ├── adicionar-documento.ts
│   │   │   ├── adicionar-endereco.ts
│   │   │   └── adicionar-contato.ts
│   │   └── document-processor.ts  # Lógica de processamento de documentos
│   └── supabase/
│       └── checklist-documentos.ts # CRUD do checklist
│
├── components/
│   ├── ia/
│   │   ├── AssistenteChat.tsx     # Componente de chat principal
│   │   ├── ChatMessage.tsx        # Mensagem individual (user/assistant)
│   │   ├── DocumentUploader.tsx   # Drag & drop de arquivos/pastas
│   │   ├── DocumentChecklist.tsx  # Checklist visual de documentos
│   │   ├── CampoIA.tsx           # Wrapper de input com indicador IA
│   │   ├── ProgressBar.tsx        # Barra de progresso do cadastro
│   │   └── PerguntaOpcoes.tsx    # Componente de pergunta com botões
│   └── pessoas/
│       └── FormularioPessoa.tsx   # Formulário refatorado para IA
│
├── app/
│   ├── api/
│   │   ├── ia/
│   │   │   ├── chat/route.ts          # Chat streaming com Claude
│   │   │   └── processar-docs/route.ts # Processar documentos uploadados
│   │   └── checklist-documentos/
│   │       └── route.ts               # CRUD checklist
│   └── (erp)/
│       └── pessoas/
│           └── novo/
│               └── page.tsx           # Página refatorada com split panel
│
├── hooks/
│   ├── useAssistenteIA.ts        # Hook principal do assistente
│   ├── useDocumentUpload.ts      # Hook de upload com preview
│   └── useFormIA.ts              # Hook que conecta chat → formulário
│
└── types/
    └── ia.ts                     # Types do sistema IA
```

---

## 7. FASES DE IMPLEMENTAÇÃO

### Fase A — Infraestrutura IA (esta sessão)
1. Instalar dependências (ai, @ai-sdk/anthropic)
2. Criar types/ia.ts
3. Criar lib/ai/config.ts
4. Criar lib/ai/prompts/ (system prompts)
5. Criar lib/ai/tools/ (tool definitions)
6. Criar API route /api/ia/chat com streaming
7. Criar migration checklist_documentos + seed

### Fase B — Componentes UI
1. Criar DocumentUploader (drag & drop, pasta, preview)
2. Criar AssistenteChat (chat com streaming)
3. Criar CampoIA (input com sparkle animation)
4. Criar DocumentChecklist (visual)
5. Criar ProgressBar

### Fase C — Integração
1. Refatorar /pessoas/novo para split panel
2. Conectar chat → formulário via tools
3. Implementar upload → processamento → preenchimento
4. Implementar checklist dinâmico
5. Implementar perguntas contextuais

### Fase D — Otimização
1. Cache de documentos processados
2. Fallback para Haiku em perguntas simples
3. Extração de texto de PDF no client (pdf.js)
4. Limites por tenant
5. Testes E2E do fluxo completo

---

## 8. DEPENDÊNCIAS A INSTALAR

```bash
npm install ai @ai-sdk/anthropic
```

**Variável de ambiente necessária:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 9. DECISÕES ARQUITETURAIS

| Decisão | Escolha | Alternativa rejeitada | Motivo |
|---------|---------|----------------------|--------|
| LLM | Claude Sonnet | GPT-4o, Gemini | Já usamos Claude, melhor em português, vision nativo |
| SDK | Vercel AI SDK | LangChain, SDK direto | Streaming nativo, hooks React, tool calling clean |
| OCR | Claude Vision | Google Vision, Textract | Menos dependência, Claude entende contexto |
| Streaming | SSE (Vercel AI) | WebSocket, Polling | Nativo do SDK, unidirecional é suficiente |
| Chat layout | Split panel | Floating, Modal | Usuário vê form + chat juntos, melhor UX |
| Custo model | Sonnet (extração) + Haiku (chat) | Opus para tudo | 10x mais barato, qualidade suficiente |

---

## 10. IMPACTO NO PRODUTO

Este sistema IA Native é o que faz o ERP da FIC ser **fundamentalmente diferente** de TOTVS, Gennera, Lyceum, etc. Nenhum concorrente tem isso. É o diferencial #1 do produto SaaS.

**Antes (formulário tradicional):** 15-20 minutos por cadastro
**Depois (IA Native):** 2-3 minutos por cadastro (upload + confirmar)

Redução de **85% no tempo de cadastro** = argumento de venda matador.
