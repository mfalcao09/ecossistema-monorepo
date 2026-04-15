# MASTERPLAN — Sistema Multi-Agentes FIC
**Versão:** 2.0  
**Criado em:** 12/04/2026  
**Atualizado em:** 12/04/2026 (Sessão 005)  
**Mudança principal:** Nova hierarquia corporativa — Marcelo como CEO, Claudinho como VP Executivo, C-Suite de IAs  
**Projeto:** Ecossistema de Inovação e IA — Faculdades Integradas de Cassilândia  
**Responsável:** Marcelo Silva  
**Status:** 🟡 Planejamento — Fase A (Financeiro) pendente

---

## ⚠️ DIRETRIZ DE IMPLEMENTAÇÃO — LEIA PRIMEIRO

> **Todo o código deste masterplan é implementado no repositório `ERP-Educacional/`.**
>
> O ERP-Educacional é a base de dados e o projeto-raiz de todos os agentes da FIC. As Vercel Functions, tabelas Supabase, jobs Trigger.dev e integrações com o Banco Inter vivem nesse repositório. Quando um segundo negócio precisar dos mesmos agentes, será avaliada a extração para microserviço — mas isso é futuro. **Por ora: tudo no ERP-Educacional.**

| O quê | Onde fica |
|-------|-----------|
| Código das Vercel Functions | `ERP-Educacional/api/` |
| Tabelas e migrations Supabase | `ERP-Educacional/supabase/migrations/` |
| Jobs Trigger.dev | `ERP-Educacional/trigger/` |
| Variáveis de ambiente | `.env` no ERP-Educacional + Vercel do projeto |
| Testes | `ERP-Educacional/tests/` |

---

## 1. Visão

Construir um **sistema de agentes autônomos de IA para a gestão da FIC** — passando de uma operação reativa (humano faz tudo) para uma operação ativa (IA monitora, age no rotineiro, consulta Marcelo nos críticos).

**Nível atual:** Nível 0-1 (Manual → Assistida)  
**Meta:** Nível 2 (Automatizada com supervisão)

> "IA age no rotineiro. Humano decide no estratégico."

---

## 2. Hierarquia Corporativa do Ecossistema

### Estrutura em 3 Níveis

```
╔══════════════════════════════════════════════════════════════╗
║                    👤 MARCELO SILVA                          ║
║                         CEO                                  ║
║  Decisão estratégica · Aprovações de alto risco · Propósito  ║
╚══════════════════════════════════════════════╤═══════════════╝
                                               │
╔══════════════════════════════════════════════▼═══════════════╗
║                 🤖 CLAUDINHO (Claude Opus 4)                  ║
║              Vice-Presidente Executivo (COO/VP)              ║
║  Orquestra todos os diretores · Roteia tarefas · Integra     ║
║  decisões entre departamentos · Reporta ao CEO               ║
╚══════╤══════════╤══════════╤══════════╤══════╤══════════════╝
       │          │          │          │      │
    CFO-IA     CAO-IA    CMO-IA    CSO-IA  CTO-IA  ...
  Financeiro  Acadêmico Marketing  Vendas  Tecnologia
```

### Princípio de Delegação

| Decisão | Quem age |
|---------|---------|
| Rotina operacional baixo risco | Agentes operacionais agem sozinhos |
| Coordenação entre departamentos | VP Executivo (Claudinho) |
| Risco médio / exceções | VP pede aprovação ao CEO |
| Estratégia, propósito, alto risco | CEO (Marcelo) decide |
| Responsabilidade legal / assinatura | CEO (Marcelo) — nunca a IA |

---

## 3. O C-Suite de IA — Diretores e Status

| Cargo | Nome | Departamento | Status | Prioridade |
|-------|------|-------------|--------|-----------|
| **CFO** | Diretor Financeiro IA | Financeiro | 🔴 Em implementação | P1 |
| **CAO** | Diretor Acadêmico IA | Educacional (FIC/Klésis) | 🟡 Planejado | P2 |
| **CMO** | Diretor de Marketing IA | Marketing e Marca | 🟡 Planejado | P2 |
| **CSO** | Diretor Comercial IA | Vendas e Captação | 🟡 Planejado | P3 |
| **CTO** | Diretor de Tecnologia IA | Dev, Infra, Segurança | 🟡 Planejado | P3 |
| **CLO** | Diretor Jurídico IA | Contratos e Compliance | 🔵 Futuro | P4 |
| **COO-Ops** | Diretor de Operações IA | Processos internos | 🔵 Futuro | P4 |

> **Modelo adotado:** Faseado — um diretor por vez, começando pelo CFO. A decisão de arquitetura transversal (serve todos os negócios) ou por unidade de negócio fica para quando o 2º negócio precisar do mesmo agente.

---

## 4. Princípios do Sistema

1. **Confirmação somente após baixa real** — nenhuma ação crítica sem validação no sistema
2. **Human-in-the-loop** — Marcelo aprova ações de alto risco antes de executarem
3. **Memória persistente** — histórico preservado entre conversas
4. **Rastreabilidade total** — todo envio, confirmação e ação é logado
5. **Idempotência** — nenhuma notificação duplicada por falha de webhook
6. **Autonomia gradual** — começar simples, expandir com confiança
7. **Hierarquia respeitada** — agente operacional não escala direto ao CEO; passa pelo VP

---

## 5. Arquitetura Técnica

```
                    GATILHO
         (cron / banco / webhook / mensagem)
                        ↓
           ┌────────────────────────┐
           │      TRIGGER.DEV       │
           │  (Agenda e dispara)    │
           └───────────┬────────────┘
                       ↓
           ┌────────────────────────┐
           │   VERCEL FUNCTIONS     │
           │  (Código dos agentes)  │
           │  + Claude API          │
           └──────────┬─────────────┘
                      │
          ┌───────────┼────────────┐
          ↓                        ↓
  ┌──────────────┐      ┌──────────────────────┐
  │   SUPABASE   │      │   HUMAN-IN-THE-LOOP   │
  │  (ERP / FIC) │      │   WhatsApp / Email    │
  │  Fonte única │      │   Marcelo autoriza    │
  │  de verdade  │      └──────────────────────┘
  └──────────────┘
```

### Stack Tecnológico

| Componente | Tecnologia | Papel |
|-----------|-----------|-------|
| Banco de dados | Supabase (ERP-Educacional) | Fonte única de verdade — tabelas novas criadas no mesmo projeto |
| Hosting API | Vercel Functions (ERP-Educacional) | Código em `ERP-Educacional/api/` |
| Agendamento | Trigger.dev | Cron jobs e delayed jobs |
| Gateway de pagamento | Banco Inter (Bolepix) | Emissão de cobranças + webhooks |
| Canal WhatsApp | A definir (ver CFO plano) | Comunicação com alunos |
| LLM | Claude API | Raciocínio dos agentes |
| Monitoramento | Sentry | Erros e alertas |

---

## 6. Matriz de Autonomia Geral

| Situação | Agente age sozinho? | Motivo |
|---------|-------------------|--------|
| Envio de boleto mensal | ✅ Sim | Rotina de baixo risco |
| Confirmar pagamento recebido | ✅ Sim | Webhook garante veracidade |
| Aviso de falta < 80% | ✅ Sim | Informativo, sem consequência |
| Lançamento de despesa recorrente | ✅ Sim | Valor e fornecedor já cadastrados |
| Contato com aluno em risco alto | ⚠️ Pede autorização | Decisão humana |
| Prazo MEC em < 7 dias | ⚠️ Alerta Marcelo | Risco regulatório |
| Oferecer renegociação de dívida | ⚠️ Pede autorização | Decisão financeira |
| Comunicado institucional externo | ⚠️ Pede aprovação | Tom e reputação |
| Assinar/protocolar documento MEC | 🚫 Nunca | Responsabilidade legal |
| Transferência bancária | 🚫 Nunca | Decisão financeira crítica |

---

## 7. Departamentos — Visão Macro

### 7.1 CFO — Diretor Financeiro IA 💰
**Plano detalhado:** `planos/DEPARTAMENTO-FINANCEIRO-v1.md`  
**Status:** 🔴 P1 — EM IMPLEMENTAÇÃO

| Agente | Função | Status |
|--------|--------|--------|
| Agente de Emissão de Cobranças | Bolepix mensal automático | 🔴 Fase A em andamento |
| Agente de Cobrança e Renegociação | Inadimplência, acordos | 🟡 Planejado |
| Agente de Lançamento de Despesas | Contas a pagar | 🟡 Planejado |
| Agente de Conciliação Bancária | Extrato vs. sistema | 🟡 Planejado |
| Agente de Fluxo de Caixa | Projeções e alertas | 🟡 Planejado |
| Agente de Relatórios Financeiros | DRE e dashboard CEO | 🔵 Futuro |

---

### 7.2 CAO — Diretor Acadêmico IA 🎓
**Plano detalhado:** `planos/DEPARTAMENTO-ACADEMICO-v1.md` *(a criar)*  
**Status:** 🟡 P2

| Agente | Função | Status |
|--------|--------|--------|
| Agente de Evasão | Score de risco, ação preventiva | 🟡 Planejado |
| Agente Regulatório MEC | Prazos e-MEC, alertas | 🟡 Planejado |
| Agente de Atendimento ao Aluno | Bot 24/7 para dúvidas rotineiras | 🟡 Planejado |
| Agente de Frequência e Notas | Alertas para coordenadores | 🔵 Futuro |

---

### 7.3 CMO — Diretor de Marketing IA 📣
**Status:** 🟡 P2 — Plano a criar

| Agente | Função |
|--------|--------|
| Agente de Conteúdo | Posts, e-mails, stories (Brand Comms skill) |
| Agente de Captação | Leads vestibular FIC / compradores Splendori |
| Agente de Tráfego | Relatórios de performance de campanhas |

---

### 7.4 CSO — Diretor Comercial IA 💼
**Status:** 🟡 P3 — Plano a criar

| Agente | Função |
|--------|--------|
| Agente de Prospecção | Apollo + Common Room |
| Agente de Follow-up | Negociações em aberto |
| Agente de Proposta | Propostas personalizadas automáticas |

---

### 7.5 CTO — Diretor de Tecnologia IA ⚙️
**Status:** 🟡 P3 — Plano a criar

| Agente | Função |
|--------|--------|
| Squad de Dev (Buchecha/MiniMax líder) | Código, revisão, testes |
| Agente de Deploy | Vercel + Supabase |
| Agente de Monitoramento | Sentry, uptime, logs |

---

## 8. Roadmap Global

| Fase | Departamento | Entregável | Status |
|------|-------------|-----------|--------|
| **1A** | Financeiro | Agente de Cobranças — Emissão e envio por e-mail | 🔴 Próxima sessão |
| **1B** | Financeiro | Agente de Cobranças — Canal WhatsApp integrado | 🟡 Aguarda decisão WA |
| **1C** | Financeiro | Agente de Cobranças — Confirmação via webhook | 🟡 Planejado |
| **1D** | Financeiro | Agente de Cobranças — Verificação de comprovante | 🟡 Planejado |
| **1E** | Financeiro | Agente de Cobrança e Renegociação | 🟡 Planejado |
| **1F** | Financeiro | Agente de Lançamento de Despesas | 🟡 Planejado |
| **1G** | Financeiro | Agente de Conciliação Bancária | 🟡 Planejado |
| **1H** | Financeiro | Relatório CEO semanal (DRE simplificado) | 🟡 Planejado |
| **2A** | Acadêmico | Agente de Evasão | 🔵 Futuro |
| **2B** | Acadêmico | Agente Regulatório MEC | 🔵 Futuro |
| **2C** | Acadêmico | Agente de Atendimento ao Aluno | 🔵 Futuro |
| **3A** | Marketing | Agente de Conteúdo | 🔵 Futuro |
| **3B** | Marketing | Agente de Captação | 🔵 Futuro |

---

## 9. Decisões em Aberto (Global)

| Decisão | Opções | Prazo |
|---------|--------|-------|
| Canal WhatsApp | **Meta Business API** ⭐, Z-API, Evolution, Twilio, Nexvy | Antes da Fase 1B |
| Arquitetura multi-negócio | Transversal (um agente serve todos) vs. por unidade | Quando 2º negócio precisar |
| Idioma Vercel Functions | Python (SDK Inter nativo) vs. TypeScript | Fase 1A |

> **✅ DECIDIDO:** Repositório de implementação = `ERP-Educacional/`. Não há mais opção de schema separado — os agentes vivem no ERP como extensão natural do sistema existente.

---

## 10. KPIs do Sistema

| Métrica | Meta |
|---------|------|
| % ações sem intervenção humana | ≥ 80% |
| Tempo de confirmação de pagamento | < 30 segundos |
| Taxa de evasão mensal | Reduzir 20% em 6 meses |
| Boletos sem resposta em D+5 | Acionar lembrete automático |
| Prazos MEC perdidos | Zero |
| Uptime dos agentes | ≥ 99% |
| Inadimplência ativa | Reduzir 30% em 6 meses |

---

## 11. Referências

| Documento | Localização |
|----------|------------|
| Departamento Financeiro (CFO) | `planos/DEPARTAMENTO-FINANCEIRO-v1.md` |
| Sistema de Cobranças v2 (detalhe técnico) | `planos/SISTEMA-COBRANCAS-v2.md` |
| Memória central (cross-project) | `GitHub/CENTRAL-MEMORY.md` |
| Ecossistema doc-mãe | `ECOSSISTEMA-INOVACAO-IA.md` |
| ERP-Educacional | `ERP-Educacional/` |
| Histórico de versões | v1.0 → `masterplans/MASTERPLAN-FIC-MULTIAGENTES-v1.md` |

---

## Histórico de Versões

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0 | 12/04/2026 | Criação — 6 agentes, arquitetura base |
| 2.0 | 12/04/2026 | Nova hierarquia corporativa (CEO → VP → C-Suite), CFO como primeiro diretor, roadmap expandido |

---

*Masterplan v2.0 — Sessão 005 — Ecossistema de Inovação e IA.*
