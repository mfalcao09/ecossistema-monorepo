# NEXVY — Plano de Implementação Revisado
## Estratégia: Módulo do ERP Educacional → SaaS Multi-Tenant

**Data:** 12 de Abril de 2026  
**Versão:** 2.0 (atualizado após decisão estratégica de Marcelo)  
**Agentes:** Buchecha · DeepSeek · Qwen · Kimi

---

## A MUDANÇA ESTRATÉGICA

**O plano anterior propunha:**
- Validar com Chatwoot Cloud (6 semanas)
- Construir NEXVY SaaS do zero com multi-tenancy

**O novo plano:**
- Construir o módulo de atendimento **dentro do ERP Educacional**
- Testar com a **FIC como único cliente** (single-tenant)
- Validar em produção real, com usuário real
- Quando funcionar: **extrair e adicionar multi-tenancy** → vira o NEXVY SaaS

**Por que isso é melhor:**

| Critério | Plano Anterior | Plano Novo |
|---------|---------------|------------|
| Validação | Com produto de terceiro (Chatwoot Cloud) | Com código **seu** em produção |
| Usuário de teste | Indefinido | **FIC** — cliente real, já existente |
| Complexidade inicial | Alta (multi-tenancy desde o início) | Baixa (single-tenant por enquanto) |
| Reuso de código | Zero | 100% — o módulo vira o NEXVY |
| Stack | Nova (separada) | **Mesma do ERP** (Next.js + Supabase) |
| Tempo até produção | 16 semanas | **6-8 semanas** |
| Risco | Médio | Baixíssimo |

---

## O QUE MUDA NA ARQUITETURA

### O Que NÃO existe mais na Fase 1

```
❌ Multi-tenancy (account_id isolation)     → só FIC por enquanto
❌ Billing / PIX / planos                  → sem necessidade
❌ White-label / domínio customizado       → sem necessidade
❌ Partner dashboard                       → sem necessidade
❌ Widget embed SDK                        → sem necessidade (por enquanto)
❌ Onboarding flow                         → sem necessidade
❌ LGPD compliance completa               → básico apenas
```

### O Que PERMANECE (e é validado antes do SaaS)

```
✅ Integração WhatsApp (Meta Cloud API)
✅ Dashboard de conversas (tela principal)
✅ Multi-canal: WhatsApp + Instagram + Messenger
✅ Contatos (CRM básico)
✅ Automação de roteamento
✅ Captain AI / Copilot (prova de conceito)
✅ Templates HSM
✅ Realtime (Supabase Realtime)
✅ Segurança (Vault, rate limiting, circuit breaker)
```

### Como o Módulo se Encaixa no ERP

```
ERP Educacional (Next.js + Supabase)
├── /diploma          → módulo de diploma digital (existente)
├── /academico        → módulo acadêmico (existente)
├── /atendimento      → ← NOVO MÓDULO (o que vamos construir)
│   ├── /conversas    → lista de conversas WhatsApp/Instagram
│   ├── /contatos     → CRM de contatos
│   ├── /canais       → configuração dos canais
│   ├── /automacoes   → regras de roteamento
│   └── /relatorios   → métricas de atendimento
└── /config           → configurações gerais (existente)
```

### Onde ficam os dados

Os dados do módulo de atendimento ficam no **mesmo Supabase** do ERP, em tabelas novas com prefixo `atendimento_` ou em schema separado `atendimento`. Sem novo projeto, sem nova infraestrutura.

```sql
-- Tabelas novas no Supabase existente do ERP
atendimento_inboxes          -- canais configurados (WhatsApp, Instagram)
atendimento_conversations    -- conversas
atendimento_messages         -- mensagens
atendimento_contacts         -- contatos (alunos, responsáveis, interessados)
atendimento_labels           -- etiquetas
atendimento_automation_rules -- regras IF/THEN
atendimento_agents           -- quem atende (funcionários da FIC)

-- SEM account_id por enquanto (single-tenant = FIC é implícito)
-- Quando virar SaaS: adicionar account_id + RLS em todas as tabelas
```

---

## ROADMAP REVISADO — 2 FASES

---

## FASE 1 — MÓDULO ERP (8 Sprints · 16 Semanas)
### *Construir e validar com a FIC*

---

### Sprint 1 — Banco de Dados + Estrutura (2 semanas)

**Objetivo:** Criar as tabelas do módulo no Supabase existente e estruturar o código

```
□ Migration: criar tabelas atendimento_* no Supabase
□ Prisma schema atualizado com as novas tabelas
□ Estrutura de rotas /atendimento no Next.js
□ Middleware de auth (reusar o do ERP — já existe)
□ Sidebar do ERP atualizada (novo item "Atendimento")
□ Seed de dados para desenvolvimento
```

**Tabelas criadas:**
```sql
atendimento_inboxes (id, name, channel_type, provider_config JSONB)
atendimento_contacts (id, name, phone, email, source)
atendimento_conversations (id, inbox_id, contact_id, status, assignee_id)
atendimento_messages (id, conversation_id, content, message_type, direction)
atendimento_labels (id, title, color)
```

---

### Sprint 2 — Integração WhatsApp (2 semanas)

**Objetivo:** Receber e enviar mensagens WhatsApp reais

```
□ Webhook /api/atendimento/whatsapp/webhook
□ Validação X-Hub-Signature (HMAC-SHA256)
□ Bull Queue no Railway (ou Supabase Edge Functions)
□ Worker: webhook → criar Contact → criar Conversation → criar Message
□ Envio de mensagem: Dashboard → Meta API → WhatsApp
□ Rate limiting por inbox
□ Circuit breaker (evitar ban da Meta)
□ Suporte a templates HSM
□ Credenciais no Supabase Vault
```

**Resultado:** Conseguir enviar e receber uma mensagem WhatsApp real com a FIC.

---

### Sprint 3 — Dashboard de Conversas (2 semanas)

**Objetivo:** A tela principal — lista de conversas + janela de chat

```
□ /atendimento/conversas — lista com filtros (aberta, resolvida, pendente)
□ Janela de chat (ChatWindow.tsx)
□ Realtime via Supabase Realtime (nova mensagem aparece sem refresh)
□ Indicadores de status (enviado, entregue, lido)
□ Upload de mídia (imagem, documento, áudio)
□ Atribuição de conversa para agente
□ Mudar status (aberta → resolvida → pendente)
□ Busca de conversas
```

---

### Sprint 4 — Multi-Canal: Instagram + Messenger (2 semanas)

**Objetivo:** Adicionar os outros canais além do WhatsApp

```
□ Instagram Direct Messages (webhook + envio)
□ Facebook Messenger (webhook + envio)
□ Telegram Bot (opcional — depende da demanda da FIC)
□ Seletor de canal na criação de conversa manual
□ Ícone do canal na lista de conversas
```

---

### Sprint 5 — CRM de Contatos (2 semanas)

**Objetivo:** Tela de contatos com histórico

```
□ /atendimento/contatos — lista com busca
□ Perfil do contato (nome, telefone, email, histórico)
□ Todas as conversas de um contato
□ Notas internas sobre o contato
□ Tags/etiquetas por contato
□ Criação manual de contato
□ Import CSV (lista de alunos/interessados)
```

**Para a FIC:** Os alunos e interessados do ERP podem ser sincronizados aqui automaticamente.

---

### Sprint 6 — Automação + Roteamento (2 semanas)

**Objetivo:** Regras automáticas para distribuir e responder conversas

```
□ /atendimento/automacoes — criador visual de regras
□ Triggers: mensagem recebida, conversa criada, status mudou
□ Ações: atribuir agente, adicionar etiqueta, responder automaticamente
□ Roteamento por equipe (secretaria, financeiro, acadêmico)
□ Horário de atendimento (mensagem automática fora do horário)
□ Respostas rápidas (templates salvos)
```

---

### Sprint 7 — IA Copilot (2 semanas)

**Objetivo:** Assistente IA para os atendentes da FIC

```
□ Sugestão de resposta em tempo real (pgvector + Gemini)
□ Base de conhecimento da FIC (FAQs, regulamentos, prazos)
□ "Resumir conversa" para contexto rápido
□ Classificação automática de conversa (matrícula, financeiro, acadêmico)
□ Resposta automática para perguntas frequentes (com aprovação humana)
```

---

### Sprint 8 — Relatórios + Refinamento (2 semanas)

**Objetivo:** Métricas e polimento antes de considerar o módulo completo

```
□ /atendimento/relatorios — dashboard de métricas
□ Tempo médio de resposta por agente
□ Volume de conversas por canal
□ CSAT (satisfação) simples
□ Relatório semanal automático para gestão da FIC
□ Correção de bugs reportados durante uso real
□ Otimizações de performance
□ Documentação interna do módulo
```

**Ao final desta fase:** O módulo está em produção, sendo usado pela FIC no dia a dia.

---

## FASE 2 — EXTRAÇÃO PARA SAAS (8 Sprints · 16 Semanas)
### *Transformar o módulo validado no NEXVY*

**Premissa:** O código da Fase 1 está funcionando em produção. A FIC está usando. Os bugs foram resolvidos. O produto foi validado. Agora é só escalar.

---

### O que muda da Fase 1 para a Fase 2

```
Fase 1 (ERP)                    Fase 2 (SaaS NEXVY)
─────────────────────────────────────────────────────
Single-tenant (FIC)          →  Multi-tenant (N clientes)
Sem account_id               →  account_id em todas as tabelas + RLS
Auth do ERP (hardcoded)      →  Supabase Auth isolado por tenant
Sem billing                  →  Stripe BR + PIX + planos
Sem white-label              →  Domínio customizado, logo, cores por tenant
Sem onboarding               →  Wizard de setup em 5 passos
Tabelas atendimento_*        →  Schema próprio no Supabase
Deploy junto com ERP         →  Deploy separado (app.nexvy.com.br)
```

---

### Sprint 9 — Multi-Tenancy (2 semanas)

```
□ Adicionar account_id em todas as tabelas atendimento_*
□ RLS: política tenant_isolation em 100% das tabelas
□ Migration para dados da FIC (FIC vira account_id=1)
□ Novo projeto Next.js separado (ou monorepo com workspace)
□ Supabase Auth isolado (sem depender do ERP)
□ Middleware de tenant detection (subdomínio ou path)
```

```sql
-- Migration: adicionar multi-tenancy nas tabelas existentes
ALTER TABLE atendimento_conversations ADD COLUMN account_id UUID REFERENCES accounts(id);
ALTER TABLE atendimento_messages ADD COLUMN account_id UUID;
-- ... para todas as tabelas

-- RLS em todas
ALTER TABLE atendimento_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON atendimento_conversations
  USING (account_id IN (
    SELECT account_id FROM account_users WHERE user_id = auth.uid()
  ));
```

---

### Sprint 10 — Onboarding + Setup (2 semanas)

```
□ Wizard de onboarding (5 passos: empresa, canal, equipe, automação, teste)
□ Setup de WhatsApp guiado (OAuth Meta integrado)
□ Configuração de horário de atendimento
□ Convite de agentes por email
□ Primeiro canal em menos de 10 minutos
```

---

### Sprint 11 — White-Label (2 semanas)

```
□ Logo customizado por tenant
□ Cores primárias por tenant (design tokens dinâmicos)
□ Domínio customizado (atendimento.fic.edu.br)
□ Nome do produto customizável
□ Email transacional com marca do cliente
```

---

### Sprint 12 — Billing BR (2 semanas)

```
□ Stripe com PIX integrado
□ Planos: Starter (3 agentes), Growth (10), Business (25), Enterprise (ilimitado)
□ Trial 14 dias (sem cartão)
□ Upgrade/downgrade automático
□ Alertas de limite de agentes
□ Dashboard financeiro para admin NEXVY
```

---

### Sprints 13-14 — Integrações BR (4 semanas)

```
□ Typebot (chatbot BR)
□ n8n (automações)
□ Hotmart (compra → contato)
□ RD Station CRM
□ Zapier
□ API pública documentada
```

---

### Sprint 15 — Mobile + Widget (2 semanas)

```
□ PWA para agentes (notificações push)
□ Widget embed para site do cliente
□ SDK JavaScript público
□ App mobile (React Native — opcional, demanda validar)
```

---

### Sprint 16 — Lançamento NEXVY (2 semanas)

```
□ Load testing (1.000 msg/minuto)
□ Stress test multi-tenancy (100 contas simultâneas)
□ Documentação completa
□ Marketing site (nexvy.com.br)
□ Migração da FIC do ERP para o NEXVY (dados já existem)
□ 🚀 Beta público com primeiros clientes pagantes
```

---

## A VANTAGEM PRINCIPAL DESTA ESTRATÉGIA

Ao final da Fase 1, você terá:

1. **Código testado em produção real** — não em ambiente de teste
2. **Bugs reais resolvidos** — a FIC vai encontrar problemas que você nunca imaginaria
3. **Fluxo de uso validado** — as secretárias da FIC vão mostrar o que faz sentido ou não na UX
4. **Zero risco financeiro** — se o produto não funcionar como esperado, o custo foi apenas desenvolvimento
5. **Base de código para o SaaS** — a Fase 2 é uma extração, não uma reescrita

**Quando a Fase 2 começar, a pergunta não é "isso vai funcionar?" — é "quantos clientes vamos aceitar primeiro?"**

---

## INFRAESTRUTURA

### Fase 1 (Módulo ERP)

Usa a infraestrutura **já existente** do ERP:
```
Vercel (ERP já está aqui)          → sem custo adicional
Supabase (ERP já usa)              → sem custo adicional até atingir limite
Railway (workers Bull)             → +$20-30/mês para os workers WhatsApp
─────────────────────────────────────────────────────────────
Custo adicional da Fase 1:         ~$20-30/mês
```

### Fase 2 (SaaS NEXVY)

Infraestrutura separada:
```
Vercel Pro (nexvy.com.br)          → $20/mês
Supabase Pro (banco separado)      → $25/mês
Railway (workers escalados)        → $50-100/mês
Cloudflare (CDN + R2)              → $20/mês
─────────────────────────────────────────────────────────────
Total MVP SaaS:                    ~$115-165/mês
```

---

## O QUE HERDAMOS DO CHATWOOT (CONTINUA IGUAL)

Mesmo com a mudança de estratégia, o blueprint do Chatwoot continua sendo a referência:

| O que herdar | Como usar |
|-------------|-----------|
| Esquema de banco (78 tabelas) | Base para as tabelas `atendimento_*` |
| Lógica WhatsApp (1.833 linhas Ruby) | Reescrever em TypeScript no Sprint 2 |
| Automação IF/THEN | Base para o Sprint 6 |
| Captain AI + pgvector | Base para o Sprint 7 |
| Multi-tenancy pattern (Account model) | Aplicar na Fase 2 (Sprint 9) |

---

## RESUMO EXECUTIVO

```
FASE 1 — MÓDULO ERP (16 semanas)
  • Constrói como módulo do ERP Educacional
  • Single-tenant: FIC usa e valida
  • Custo adicional: ~$25/mês
  • Resultado: produto validado em produção real

FASE 2 — NEXVY SAAS (16 semanas)
  • Extrai o módulo validado
  • Adiciona multi-tenancy, billing, white-label
  • Lança como SaaS independente
  • Resultado: NEXVY no ar, com a FIC como primeiro cliente

Total: 32 semanas · 8 meses
Custo de desenvolvimento: stack + squad de IAs
Custo de infra Fase 1: +$25/mês sobre o ERP
Custo de infra Fase 2: ~$115-165/mês (novo produto)
```

---

*Relatório v2.0 — Squad: Buchecha · DeepSeek · Qwen · Kimi · Orquestração: Claude Sonnet 4.6 · 12/04/2026*
