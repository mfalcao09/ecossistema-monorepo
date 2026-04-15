# Plano — Portal Público de Consulta de Diplomas Digitais (FIC)

**Versão:** 1.0
**Data:** 21/03/2026
**Arquiteto:** Claude (Opus 4) + Squad (Buchecha/MiniMax M2.7)
**Status:** Aguardando aprovação do Marcelo

---

## 1. Visão Geral

Portal público onde qualquer pessoa pode verificar a autenticidade de um diploma digital emitido pela FIC. Conceito **IA Native** — com assistente inteligente, feedback em linguagem natural, e UX moderna.

**Referência analisada:** diploma.toledoprudente.edu.br (Toledo Prudente)
**Nosso diferencial:** Design moderno, assistente IA, QR Code, feedback rico, mobile-first.

---

## 2. Funcionalidades do Portal

### 2.1 — Validar Diploma por Código
- Usuário digita o código de validação (formato `XXXX.XXXX.XXXXXXXX`)
- Sistema busca no banco e retorna resultado com animação
- Feedback em linguagem natural: "Este diploma é válido e foi emitido em 15/03/2025"
- Badge visual: ✅ Válido | ❌ Inválido | ⚠️ Revogado
- **Já existe base:** `src/app/verificar/[codigo]/page.tsx` (funcional!)

### 2.2 — Consultar Meus Diplomas (por CPF)
- Diplomado digita CPF + Data de Nascimento
- Sistema retorna lista de todos os diplomas daquela pessoa
- Cada diploma pode ser expandido para ver detalhes
- Botão para baixar RVDD (PDF visual)
- **Novo — precisa criar**

### 2.3 — Validar Conformidade do XML
- Upload de arquivo XML (drag-and-drop)
- Sistema valida: estrutura XSD, assinatura digital, integridade
- Retorna relatório de conformidade com checklist visual
- **Novo — precisa criar**

### 2.4 — Assistente IA (Diferencial)
- Botão flutuante (FAB) no canto inferior direito
- Abre drawer/chat lateral
- Responde perguntas sobre:
  - O que é diploma digital
  - Como verificar autenticidade
  - O que significam os campos
  - Explicações contextuais (se o usuário está vendo um diploma)
- Sugestões rápidas pré-definidas
- Fallback para FAQ estático se IA indisponível

### 2.5 — QR Code de Verificação Rápida
- Cada diploma tem um QR Code que leva direto à página de verificação
- Leitura pelo celular = verificação instantânea
- URL format: `https://diploma.fic.edu.br/verificar/{codigo}`

---

## 3. Arquitetura Técnica

### 3.1 Stack
| Componente | Tecnologia |
|------------|-----------|
| Framework | Next.js 14 (App Router) — **já configurado no projeto** |
| UI | Tailwind CSS + shadcn/ui + Lucide Icons — **já em uso** |
| Banco | Supabase (PostgreSQL) — **já configurado** |
| Deploy | Vercel |
| IA Chat | API Claude ou OpenAI (via API route) |
| Validação XML | Biblioteca XML nativa + libxmljs2 (XSD) |
| QR Code | qrcode.react |
| Animações | framer-motion |
| Rate Limiting | @upstash/ratelimit |
| CAPTCHA | Cloudflare Turnstile (alternativa moderna ao reCAPTCHA) |

### 3.2 Estrutura de Rotas

```
src/app/
├── (portal)/                        # ← NOVO: grupo de rotas públicas
│   ├── layout.tsx                   # Layout do portal (header + footer + FAB IA)
│   ├── page.tsx                     # Landing page com as 3 seções
│   ├── validar/
│   │   └── page.tsx                 # Form de validação por código
│   ├── consultar/
│   │   └── page.tsx                 # Form de consulta por CPF
│   ├── validar-xml/
│   │   └── page.tsx                 # Upload e validação de XML
│   └── resultado/
│       └── [codigo]/page.tsx        # Resultado detalhado (evolução do verificar atual)
│
├── verificar/[codigo]/page.tsx      # ← JÁ EXISTE (rota de link direto/QR Code)
│
├── api/
│   ├── portal/
│   │   ├── validar-codigo/route.ts  # GET — busca diploma por código
│   │   ├── consultar-cpf/route.ts   # POST — busca diplomas por CPF + nascimento
│   │   ├── validar-xml/route.ts     # POST — valida XML uploaded
│   │   └── chat/route.ts            # POST — proxy para IA
│   └── documentos/verificar/[codigo]/route.ts  # ← JÁ EXISTE
```

### 3.3 Componentes

```
src/components/portal/
├── PortalHeader.tsx          # Header institucional da FIC
├── PortalFooter.tsx          # Footer com links e redes sociais
├── PortalHero.tsx            # Banner hero da landing
│
├── SecaoValidarCodigo.tsx    # Seção: input código + CAPTCHA + botão
├── SecaoConsultarCPF.tsx     # Seção: CPF + data nascimento + botão
├── SecaoValidarXML.tsx       # Seção: drag-and-drop XML + CAPTCHA
│
├── DiplomaCard.tsx           # Card de resultado do diploma
├── DiplomaDetalhes.tsx       # Detalhes expandidos
├── BadgeStatus.tsx           # Badge: válido/inválido/revogado
├── QRCodeDiploma.tsx         # QR Code do diploma
├── RelatorioXML.tsx          # Checklist de conformidade XML
│
├── ia/
│   ├── AssistenteIA.tsx      # FAB + drawer container
│   ├── ChatDrawer.tsx        # Sidebar do chat
│   ├── ChatMessage.tsx       # Balão de mensagem
│   ├── ChatInput.tsx         # Input com send
│   └── SugestoesRapidas.tsx  # Chips de sugestões
│
└── ui/                       # ← Já existe (shadcn/ui)
```

---

## 4. Banco de Dados (Supabase)

### Tabelas que já existem e serão usadas:
- `documentos_digitais` — onde os diplomas ficam registrados
- `ies` — dados da instituição
- `cursos` — dados dos cursos

### Tabela nova necessária:

```sql
-- Logs de consulta pública (auditoria)
CREATE TABLE portal_logs_consulta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_consulta TEXT NOT NULL CHECK (tipo_consulta IN ('codigo', 'cpf', 'xml')),
  codigo_consultado TEXT,
  resultado TEXT NOT NULL CHECK (resultado IN ('encontrado', 'nao_encontrado', 'erro')),
  ip_hash TEXT NOT NULL,         -- Hash do IP (não armazena IP real)
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para análise
CREATE INDEX idx_portal_logs_tipo ON portal_logs_consulta(tipo_consulta, created_at);
```

---

## 5. Segurança

### 5.1 Proteção de CPFs
```typescript
// CPFs no banco: armazenados com hash HMAC-SHA256
const hashCPF = (cpf: string): string => {
  return crypto.createHmac('sha256', process.env.CPF_HMAC_SECRET!)
    .update(cpf.replace(/\D/g, ''))
    .digest('hex');
};
// Na consulta: hashear o CPF digitado e comparar com hash no banco
// Na exibição: sempre mascarado (***.***.***-XX)
```

### 5.2 Rate Limiting
| Endpoint | Limite | Janela |
|----------|--------|--------|
| Validar por código | 20 req/IP | 1 minuto |
| Consultar por CPF | 5 req/IP | 1 minuto |
| Validar XML | 3 req/IP | 1 minuto |
| Chat IA | 10 req/IP | 1 minuto |

### 5.3 CAPTCHA
- **Cloudflare Turnstile** (gratuito, sem fricção para o usuário)
- Aplicado em: consulta por CPF e validação de XML
- Validação por código: apenas rate limiting (mais rápido)

### 5.4 Proteção contra XML Injection (XXE)
```typescript
// Desabilitar entidades externas ao fazer parse de XML
const parser = new DOMParser();
// Usar libxmljs2 com opções seguras:
const xmlDoc = libxmljs.parseXml(xmlString, {
  noent: false,    // NÃO expandir entidades
  nonet: true,     // NÃO acessar rede
  dtdload: false,  // NÃO carregar DTD externo
});
```

### 5.5 Validação XSD
- Validar estrutura do XML contra XSD v1.06 oficial do MEC
- Verificar assinatura digital XAdES (certificado ICP-Brasil)
- Para assinatura: usar API de terceiro (BRy, Certisign) ou biblioteca como `xml-crypto`

---

## 6. Integração IA — Assistente do Portal

### 6.1 Arquitetura do Chat
```
Usuário → ChatInput → POST /api/portal/chat
                          ↓
                    System Prompt (RAG)
                    + Contexto do diploma (se houver)
                    + Histórico da conversa
                          ↓
                    API Claude Sonnet 4
                          ↓
                    Streaming response → ChatMessage
```

### 6.2 System Prompt do Assistente
```
Você é o assistente virtual da FIC (Faculdades Integradas de Cassilândia).
Sua função é ajudar visitantes do portal de diplomas digitais.
Responda em português, de forma clara e acessível.
Você pode explicar:
- O que é um diploma digital
- Como verificar autenticidade
- O que são assinaturas ICP-Brasil
- O que significa cada campo do diploma
- Como funciona o processo de emissão
Se o usuário tiver um diploma carregado, use os dados para dar respostas contextuais.
Nunca invente informações sobre diplomas específicos.
```

### 6.3 Sugestões Rápidas (Chips)
- "O que é diploma digital?"
- "Como verificar autenticidade?"
- "O que é ICP-Brasil?"
- "Este diploma é válido?"
- "Como baixar meu diploma?"

---

## 7. UX e Design

### 7.1 Identidade Visual
- Cores: azul institucional da FIC + tons de slate/gray
- Tipografia: Inter (já em uso no projeto)
- Ícones: Lucide (já em uso)
- Design system: shadcn/ui (já em uso)

### 7.2 Layout da Landing Page
```
┌─────────────────────────────────────────────────┐
│  HEADER: Logo FIC + "Portal de Diplomas"         │
├─────────────────────────────────────────────────┤
│                                                   │
│  HERO: "Verifique a autenticidade do seu         │
│         diploma digital"                          │
│         [Breve explicação + CTA]                  │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Validar  │  │Consultar │  │ Validar  │       │
│  │ Código   │  │  CPF     │  │   XML    │       │
│  │          │  │          │  │          │       │
│  │ [input]  │  │ [input]  │  │ [upload] │       │
│  │ [botão]  │  │ [input]  │  │ [botão]  │       │
│  │          │  │ [botão]  │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                   │
├─────────────────────────────────────────────────┤
│  SEÇÃO: "O que é diploma digital?" (educativa)   │
├─────────────────────────────────────────────────┤
│  FOOTER: © FIC + Redes Sociais + Links           │
├─────────────────────────────────────────────────┤
│                                    [💬 IA FAB]    │
└─────────────────────────────────────────────────┘
```

### 7.3 Responsividade (Mobile-First)
- Mobile: seções empilhadas, cards em coluna única
- Tablet: 2 colunas para seções de consulta
- Desktop: 3 colunas para seções de consulta
- Chat IA: fullscreen no mobile, drawer lateral no desktop

### 7.4 Micro-interações
- Animação de loading durante consulta (skeleton + spinner)
- Badge de status com animação de entrada (framer-motion)
- Toast notifications para erros
- Transição suave ao abrir/fechar chat IA

---

## 8. Sprints de Desenvolvimento

### Sprint 1 — MVP Funcional (3-4 dias)
| Tarefa | Responsável | Complexidade |
|--------|------------|-------------|
| Landing page do portal (layout + hero) | Qwen (frontend) | 🟢 Baixa |
| Seção "Validar por Código" | Qwen | 🟢 Baixa |
| API endpoint validar-codigo | Buchecha | 🟢 Baixa |
| Seção "Consultar por CPF" | Qwen | 🟡 Média |
| API endpoint consultar-cpf (com hash) | DeepSeek | 🟡 Média |
| Portal header + footer | Qwen | 🟢 Baixa |
| Deploy na Vercel | Claude | 🟢 Baixa |

### Sprint 2 — XML + Segurança (4-5 dias)
| Tarefa | Responsável | Complexidade |
|--------|------------|-------------|
| Seção "Validar XML" (upload) | Qwen | 🟡 Média |
| API endpoint validar-xml (parse + XSD) | DeepSeek | 🔴 Alta |
| Validação de assinatura digital | DeepSeek | 🔴 Alta |
| Rate limiting (Upstash) | Buchecha | 🟡 Média |
| Cloudflare Turnstile (CAPTCHA) | Buchecha | 🟢 Baixa |
| Tabela portal_logs_consulta | Claude | 🟢 Baixa |

### Sprint 3 — IA + Polish (3-4 dias)
| Tarefa | Responsável | Complexidade |
|--------|------------|-------------|
| Assistente IA (FAB + chat) | Qwen + Claude | 🟡 Média |
| API /api/portal/chat (streaming) | Buchecha | 🟡 Média |
| QR Code nos diplomas | Kimi | 🟢 Baixa |
| Animações e micro-interações | Qwen | 🟡 Média |
| Seção educativa "O que é diploma digital" | Claude | 🟢 Baixa |
| Testes e polimento final | Kimi | 🟡 Média |

### Total estimado: 10-13 dias úteis

---

## 9. O que já existe vs. O que criar

### ✅ Já existe no projeto:
- Página `/verificar/[codigo]` com UI completa (badge, detalhes, signatários)
- API `/api/documentos/verificar/[codigo]`
- Types: `VerificacaoPublica`, `TIPO_DOC_LABELS`
- Stack completa: Next.js + Tailwind + shadcn/ui + Supabase
- Tabelas: `documentos_digitais`, `ies`, `cursos`

### 🆕 Precisa criar:
- Landing page do portal (3 seções)
- Route group `(portal)` com layout próprio
- Consulta por CPF (endpoint + UI)
- Validação de XML (upload + parse + endpoint)
- Assistente IA (chat + API)
- QR Code
- Rate limiting e CAPTCHA
- Tabela de logs de consulta

---

## 10. Decisões Aprovadas (21/03/2026)

| # | Decisão | Resposta do Marcelo |
|---|---------|-------------------|
| 1 | **Domínio** | `diploma.ficcassilandia.com.br` |
| 2 | **CAPTCHA** | Cloudflare Turnstile |
| 3 | **IA do chat** | Claude Sonnet via OpenRouter (controlável em Configurações > Agentes) |
| 4 | **Visual** | Sóbrio e institucional (sem confetti) |
| 5 | **Seção educativa** | Apenas texto |

### DNS — Configuração necessária
Quando o deploy na Vercel estiver pronto, Marcelo deverá apontar:
```
Tipo: CNAME
Nome: diploma
Valor: cname.vercel-dns.com
```
Ou, se preferir A record:
```
Tipo: A
Nome: diploma
Valor: 76.76.21.21
```

---

*Plano elaborado por Claude (Opus 4) como Arquiteto-chefe, com contribuições de Buchecha (MiniMax M2.7) para arquitetura geral.*
*Decisões aprovadas por Marcelo em 21/03/2026.*
