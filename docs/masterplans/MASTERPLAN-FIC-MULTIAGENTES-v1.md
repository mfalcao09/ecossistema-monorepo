# MASTERPLAN — Sistema Multi-Agentes FIC
**Versão:** 1.0  
**Criado em:** 12/04/2026  
**Projeto:** Ecossistema de Inovação e IA — Faculdades Integradas de Cassilândia  
**Responsável:** Marcelo Silva  
**Status:** 🟡 Planejamento — Fase A pendente  

---

## 1. Visão

Construir um **sistema de agentes autônomos de IA para a gestão da FIC** — passando de uma operação reativa (humano faz tudo) para uma operação ativa (IA monitora, age no rotineiro, consulta Marcelo nos críticos).

**Nível de maturidade atual:** Nível 0-1 (Manual → Assistida)  
**Meta:** Nível 2 (Automatizada com supervisão)

> "IA age no rotineiro. Humano decide no estratégico."

---

## 2. Princípios do Sistema

1. **Confirmação somente após baixa real** — nenhuma ação crítica sem validação no sistema
2. **Human-in-the-loop** — Marcelo aprova ações de alto risco antes de executarem
3. **Memória persistente** — histórico de alunos preservado entre conversas
4. **Rastreabilidade total** — todo envio, confirmação e ação é logado
5. **Idempotência** — nenhuma notificação duplicada por falha de webhook
6. **Autonomia gradual** — começar simples, expandir com confiança

---

## 3. Arquitetura do Sistema

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
| Banco de dados | Supabase | Fonte única de verdade (ERP-Educacional) |
| Hosting API | Vercel Functions | Webhooks e endpoints dos agentes |
| Agendamento | Trigger.dev | Cron jobs e delayed jobs |
| Gateway de pagamento | Banco Inter (Bolepix) | Emissão de cobranças + webhooks |
| Canal WhatsApp | A definir (ver Plano de Cobranças v2) | Comunicação com alunos |
| LLM | Claude API | Raciocínio dos agentes |
| Monitoramento | Sentry | Erros e alertas |

---

## 4. Os 6 Agentes

### Matriz de Autonomia

| Situação | Agente age sozinho? | Motivo |
|---------|-------------------|--------|
| Envio de boleto mensal | ✅ Sim | Rotina de baixo risco |
| Confirmar pagamento recebido | ✅ Sim | Webhook garante veracidade |
| Aviso de falta < 80% | ✅ Sim | Informativo, sem consequência |
| Contato com aluno em risco alto | ⚠️ Pede autorização | Decisão humana |
| Prazo MEC em < 7 dias | ⚠️ Alerta Marcelo | Risco regulatório |
| Oferecer renegociação de dívida | ⚠️ Pede autorização | Decisão financeira |
| Comunicado institucional externo | ⚠️ Pede aprovação | Tom e reputação |
| Assinar/protocolar documento MEC | 🚫 Nunca | Responsabilidade legal |

---

### Agente 1 — Cobranças (Bolepix + WhatsApp)
**Status:** 🔴 P1 — Plano v2 criado, implementação pendente  
**Plano detalhado:** `planos/SISTEMA-COBRANCAS-v2.md`

| Campo | Valor |
|-------|-------|
| Gatilho | Cron: dia 20 de cada mês, 9h |
| Função | Emite bolepix pelo Inter, envia ao aluno, confirma pagamento via webhook |
| Ferramentas | Banco Inter API, Canal WhatsApp, Supabase |
| Autorização humana | Renegociação de dívida, cancelamento |
| Entregável | Sistema end-to-end: emissão → envio → confirmação → comprovante |

**Fluxos cobertos:**
- F1: Emissão e envio mensal automático
- F2: Confirmação automática via webhook Inter
- F3: Verificação de comprovante enviado pelo aluno via WhatsApp

---

### Agente 2 — Evasão
**Status:** 🔴 P1 — Prioridade máxima de impacto  
**Plano detalhado:** `planos/AGENTE-EVASAO-v1.md` *(a criar)*

| Campo | Valor |
|-------|-------|
| Gatilho | Cron: toda manhã às 7h + trigger de banco (evento de falta) |
| Função | Monitora frequência, inadimplência e desempenho. Classifica risco. Age preventivamente |
| Ferramentas | Supabase (frequência, financeiro), Canal WhatsApp, Trigger.dev |
| Autorização humana | Risco alto: contato com aluno, proposta de solução |
| Entregável | Dashboard de risco + fluxo de ação preventiva |

**Lógica de score de risco:**

| Indicador | Peso |
|-----------|------|
| Frequência < 75% | 🔴 Alto |
| Inadimplência ativa | 🔴 Alto |
| Reprovação no semestre | 🟡 Médio |
| Frequência 75–80% | 🟡 Médio |
| Sem registro há 30 dias | 🟡 Médio |

---

### Agente 3 — Regulatório (MEC / e-MEC)
**Status:** 🟡 P2 — Plano a criar  
**Plano detalhado:** `planos/AGENTE-REGULATORIO-v1.md` *(a criar)*

| Campo | Valor |
|-------|-------|
| Gatilho | Cron: toda manhã às 8h |
| Função | Monitora prazos regulatórios, organiza checklist de documentos, alerta Marcelo |
| Ferramentas | Supabase (calendário regulatório), Email, WhatsApp |
| Autorização humana | Qualquer ação de protocolação ou envio de documentos |
| Entregável | Calendário regulatório automatizado + alertas proativos |

**Prazos monitorados:**
- Reconhecimento e renovação de cursos
- Recredenciamento institucional
- Indicadores ENADE / CPC / IGC
- NDEs e reuniões de CPA
- Relatórios anuais e-MEC

---

### Agente 4 — Atendimento ao Aluno
**Status:** 🟡 P2 — Plano a criar  
**Plano detalhado:** `planos/AGENTE-ATENDIMENTO-v1.md` *(a criar)*

| Campo | Valor |
|-------|-------|
| Gatilho | Mensagem do aluno (WhatsApp ou chat) |
| Função | Responde dúvidas do dia a dia: horários, calendário, requerimentos, segunda via |
| Ferramentas | Canal WhatsApp, Supabase, Claude API |
| Autorização humana | Casos que requerem decisão da coordenação |
| Entregável | Bot de atendimento 24/7 para questões rotineiras |

**Tópicos cobertos pelo agente (sem humano):**
- Calendário acadêmico e datas
- Grade horária do curso
- Segunda via de boleto
- Status de requerimentos protocolados
- FAQ geral da instituição

---

### Agente 5 — Captação e Vestibular
**Status:** 🟢 P3 — Plano a criar  
**Plano detalhado:** `planos/AGENTE-CAPTACAO-v1.md` *(a criar)*

| Campo | Valor |
|-------|-------|
| Gatilho | Mensagem de candidato (WhatsApp / formulário) |
| Função | Qualifica candidatos, informa sobre cursos, encaminha para inscrição |
| Ferramentas | Canal WhatsApp, Apollo (enrich), Supabase, Email |
| Autorização humana | Proposta de bolsa ou condição especial |
| Entregável | Funil de captação automatizado |

---

### Agente 6 — Comunicação Institucional
**Status:** 🟢 P4 — Plano a criar  
**Plano detalhado:** `planos/AGENTE-COMUNICACAO-v1.md` *(a criar)*

| Campo | Valor |
|-------|-------|
| Gatilho | Agenda editorial (cron) ou evento institucional |
| Função | Gera e agenda conteúdo nas redes sociais e e-mail, com tom FIC |
| Ferramentas | Brand Comms skill, redes sociais, Resend (email) |
| Autorização humana | Todo conteúdo externo antes de publicar |
| Entregável | Calendário editorial automatizado |

---

## 5. Modelo de Dados Central (Supabase FIC)

### Tabelas dos Agentes

| Tabela | Usado por | Descrição |
|--------|----------|-----------|
| `cobrancas` | Agente 1 | Boletos emitidos, status, pagamentos |
| `comunicacoes` | Agentes 1, 4, 5, 6 | Log de todas as mensagens enviadas |
| `comprovantes_recebidos` | Agente 1 | Comprovantes enviados por alunos |
| `alertas_evasao` | Agente 2 | Score de risco e histórico de ações |
| `calendario_regulatorio` | Agente 3 | Prazos MEC e status |
| `leads_captacao` | Agente 5 | Candidatos em qualificação |

*(Tabelas base — alunos, cursos, financeiro — já existem no ERP-Educacional)*

---

## 6. Roadmap de Implementação

### Fase A — Fundação (Semanas 1–2)
**Meta:** Primeira cobrança emitida e enviada automaticamente

- [ ] Criar conta e integração no Banco Inter (certificado + escopos)
- [ ] Configurar ambiente sandbox Inter para testes
- [ ] Criar tabelas `cobrancas` e `comunicacoes` no Supabase
- [ ] Implementar Vercel Function `/api/emit-boletos`
- [ ] Configurar Trigger.dev: job dia 20, 9h
- [ ] Definir e configurar canal WhatsApp (decisão pendente)
- [ ] Testar emissão com 1 aluno em sandbox
- [ ] **Entregável:** Bolepix gerado + enviado por e-mail (sem WhatsApp ainda)

### Fase B — WhatsApp (Semana 3)
**Meta:** Aluno recebe bolepix via WhatsApp

- [ ] Configurar canal WhatsApp escolhido
- [ ] Adaptar `/api/emit-boletos` para enviar WhatsApp após e-mail
- [ ] Templates de mensagem aprovados por Marcelo
- [ ] Testar com número real em sandbox
- [ ] **Entregável:** Bolepix entregue por WhatsApp + e-mail

### Fase C — Confirmação Automática (Semana 4)
**Meta:** Aluno recebe confirmação em segundos após pagar

- [ ] Implementar Vercel Function `/api/payment-webhook`
- [ ] Configurar webhook no Inter (`include_webhook`)
- [ ] Lógica de idempotência (não duplicar confirmações)
- [ ] Testar pagamento simulado no sandbox Inter
- [ ] **Entregável:** Webhook → atualiza Supabase → WhatsApp de confirmação

### Fase D — Comprovante (Semanas 5–6)
**Meta:** Fluxo completo de comprovante funcionando

- [ ] Implementar Vercel Function `/api/whatsapp-webhook`
- [ ] Identificação do aluno por número de telefone
- [ ] Leitura de comprovante (texto e imagem via Claude Vision)
- [ ] Consulta ao Inter para verificar baixa
- [ ] Fluxo de re-verificação (Trigger.dev delayed job, 2h)
- [ ] **Entregável:** Fluxo 3 completo — comprovante → verificação → confirmação

### Fase E — Agente de Evasão (Semanas 7–9)
**Meta:** Alunos em risco identificados e abordados preventivamente

- [ ] Criar tabela `alertas_evasao`
- [ ] Implementar lógica de score de risco
- [ ] Trigger.dev: job diário às 7h
- [ ] Fluxo de autorização Marcelo via WhatsApp
- [ ] **Entregável:** Agente 2 operacional

### Fase F — Regulatório + Atendimento (Semanas 10–14)
**Meta:** Agentes 3 e 4 operacionais

- [ ] Criar `calendario_regulatorio` com prazos MEC
- [ ] Agente Regulatório: alertas automáticos
- [ ] Agente Atendimento: bot de dúvidas rotineiras
- [ ] **Entregável:** Agentes 3 e 4 operacionais

---

## 7. KPIs do Sistema

| Métrica | Meta |
|---------|------|
| % ações sem intervenção humana | ≥ 80% |
| Tempo médio para confirmação de pagamento | < 30 segundos |
| Taxa de evasão mensal | Reduzir 20% em 6 meses |
| Boletos sem resposta em D+5 | Acionar lembrete automático |
| Prazos MEC perdidos | Zero |
| Uptime dos agentes | ≥ 99% |

---

## 8. Entregáveis e Status

| # | Entregável | Fase | Status |
|---|-----------|------|--------|
| E1 | Sistema de Cobranças v2 (Bolepix + WhatsApp) | A–D | 📋 Plano criado |
| E2 | Agente de Evasão | E | 📋 A planejar |
| E3 | Agente Regulatório (MEC) | F | 📋 A planejar |
| E4 | Agente de Atendimento ao Aluno | F | 📋 A planejar |
| E5 | Agente de Captação / Vestibular | — | 📋 A planejar |
| E6 | Agente de Comunicação Institucional | — | 📋 A planejar |

---

## 9. Decisões em Aberto

| Decisão | Opções | Prazo |
|---------|--------|-------|
| Canal WhatsApp | **Meta Business API** ⭐ (Marcelo já tem acesso), Z-API, Evolution API, Twilio, Nexvy, 360Dialog | Antes da Fase B |
| Hospedagem dos PDFs bolepix | Supabase Storage, R2 (Cloudflare), link direto Inter | Fase A |
| Idioma das Vercel Functions | Python (SDK Inter disponível) ou TypeScript + fetch | Fase A |
| ERP-Educacional como base | Usar tabelas existentes ou criar schema separado | Fase A |
| Arquitetura multi-projeto | Implementar no ERP-Educacional primeiro → extrair para microserviço quando 2º negócio precisar | Fase A |

---

## 10. Distribuição das Sessões de Implementação — E1 (Sistema de Cobranças)

> Esta seção mapeia **o que será feito em cada sessão** para implementar o Agente 1 (E1) do zero até produção. Referência para o projeto ERP-Educacional.

| Sessão | Fase | Foco | Entregável concreto |
|--------|------|------|---------------------|
| **003** | A/1 | Credenciais Inter + Tabelas Supabase | Inter OAuth configurado + 3 tabelas criadas e validadas |
| **004** | A/2 | Primeiro bolepix emitido | PDF gerado via SDK Inter + salvo no Supabase + enviado por e-mail |
| **005** | B | WhatsApp | Bolepix entregue ao aluno via WhatsApp (requer decisão do canal antes) |
| **006** | C | Webhook de pagamento | Confirmação automática em < 30s após pagamento via Inter webhook |
| **007** | D | Verificação de comprovante | Fluxo F3 completo: aluno envia imagem → Claude Vision → Inter → confirmação |
| **008** | — | Homologação + Go-Live | Testes com dados reais + Sentry ativo + sistema em produção |

### Detalhamento por Sessão

**Sessão 003 — Ambiente e Banco de Dados**
- Criar integração no painel Inter Empresas (escopos: cobranças.read/write, webhook.read/write)
- Baixar certificado `.crt` e chave `.key`
- Configurar variáveis de ambiente no Vercel
- Criar 3 tabelas no Supabase: `cobrancas`, `comunicacoes`, `comprovantes_recebidos`
- Testar autenticação OAuth (token apenas, sem emitir boleto)

**Sessão 004 — Primeiro Bolepix**
- Implementar `/api/emit-boletos` com SDK Python Inter
- Configurar Trigger.dev: cron dia 20, 9h
- Emitir 1 bolepix de teste em sandbox
- Salvar na tabela `cobrancas` com status `EMITIDO`
- Enviar PDF por e-mail (sem WhatsApp ainda)

**Sessão 005 — Canal WhatsApp** *(pré-requisito: decisão do canal fechada)*
- Configurar canal escolhido (candidata principal: Meta Business API)
- Criar e submeter templates de mensagem para aprovação Meta
- Adaptar `/api/emit-boletos` para enviar WhatsApp + e-mail
- Testar envio de PDF via WhatsApp em sandbox

**Sessão 006 — Webhook de Pagamento**
- Implementar `/api/payment-webhook` (recebe evento Inter)
- Atualiza `cobrancas` no Supabase → envia WhatsApp de confirmação
- Implementar idempotência (verificar status antes de confirmar)
- Testar pagamento simulado no sandbox Inter

**Sessão 007 — Comprovante via WhatsApp**
- Implementar `/api/whatsapp-webhook`
- Identificar aluno por número de telefone
- Leitura de comprovante: texto (PIX) via parsing + imagem via Claude Vision
- Consulta Inter para verificar baixa real
- Delayed job no Trigger.dev (re-verificação em 2h se status `A_RECEBER`)

**Sessão 008 — Go-Live**
- Testes com 5–10 alunos reais em homologação
- Sentry configurado e testado (envio de erro de teste)
- Runbook criado: o que fazer se webhook falhar ou Trigger.dev não disparar
- Aprovação de Marcelo → sistema em produção
- Primeiro cron real agendado para dia 20

---

## 11. Referências

| Documento | Localização | Usado em |
|----------|------------|---------|
| Plano de Cobranças v2 | `Ecossistema/planos/SISTEMA-COBRANCAS-v2.md` | Sessões 003–008 |
| Sessões de implementação | Seção 10 deste documento | Orientação por sessão |
| Memória central (cross-project) | `GitHub/CENTRAL-MEMORY.md` | Sempre — ponto de entrada |
| Ecossistema doc-mãe | `Ecossistema/ECOSSISTEMA-INOVACAO-IA.md` | Contexto geral |
| Memória do Ecossistema | `Ecossistema/memory/MEMORY.md` | Histórico de sessões |
| ERP-Educacional | `ERP-Educacional/` | Banco de dados, código |
| TRACKER ERP | `ERP-Educacional/memory/TRACKER.md` | Sessões do ERP |
| SDK Inter Python | `github.com/inter-co/pj-sdk-python` | Sessão 003–004 |

---

*Masterplan gerado em sessão de 12/04/2026 — Ecossistema de Inovação e IA.*
