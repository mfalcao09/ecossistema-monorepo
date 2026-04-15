# DEPARTAMENTO FINANCEIRO — Plano de Implementação
**Versão:** 1.0  
**Criado em:** 12/04/2026  
**Projeto:** MASTERPLAN-FIC-MULTIAGENTES-v2  
**Responsável IA:** CFO — Diretor Financeiro IA  
**Responsável Humano:** Marcelo Silva (CEO)  
**Status:** 🔴 Em implementação — Fase 1A próxima sessão

---

## ⚠️ DIRETRIZ DE IMPLEMENTAÇÃO — LEIA PRIMEIRO

> **Todo o código deste departamento é implementado no repositório `ERP-Educacional/`.**
>
> Os agentes financeiros são extensões naturais do ERP já existente. Não há repositório separado, não há microserviço apartado — pelo menos enquanto a FIC for o único negócio usando esses agentes. Quando um segundo negócio precisar, será avaliada a extração.

| O quê | Caminho no ERP-Educacional |
|-------|---------------------------|
| Vercel Functions dos agentes | `ERP-Educacional/api/financeiro/` |
| Migrations de novas tabelas | `ERP-Educacional/supabase/migrations/` |
| Jobs Trigger.dev | `ERP-Educacional/trigger/financeiro/` |
| Variáveis de ambiente | `.env` ERP-Educacional + painel Vercel do projeto |
| Testes dos agentes | `ERP-Educacional/tests/financeiro/` |
| SDK Inter Python | Dependência do `requirements.txt` do ERP-Educacional |

---

## 1. Visão do Departamento

O **Departamento Financeiro IA** é o primeiro departamento do C-Suite do Ecossistema FIC. Sua missão é automatizar o ciclo financeiro completo da instituição — da emissão de cobranças ao relatório executivo para o CEO — operando com autonomia total no rotineiro e escalando ao CEO apenas nas decisões estratégicas.

**Diretor:** CFO — Diretor Financeiro IA (orquestrado pelo VP Claudinho)  
**Reporta a:** VP Executivo (Claudinho) → CEO (Marcelo)

---

## 2. Os 6 Agentes do Departamento

```
                ┌──────────────────────────────┐
                │  CFO — Diretor Financeiro IA  │
                │   (Coordena todos abaixo)     │
                └───────────────┬──────────────┘
         ┌─────────┬────────────┼────────────┬─────────┐
         ▼         ▼            ▼            ▼         ▼
    Agente 1   Agente 2     Agente 3    Agente 4  Agente 5
    Emissão   Cobrança e   Lançamento  Concilia-   Fluxo
      de      Renegoci-    Despesas    ção Banc.  de Caixa
  Cobranças    ação        (C.Pagar)              +Agente 6
                                                  Relatório
                                                    CEO
```

---

### Agente 1 — Emissão de Cobranças (Contas a Receber)
**Referência técnica:** `planos/SISTEMA-COBRANCAS-v2.md`  
**Status:** 🔴 P1 — Implementação em andamento (Sessões 1–8)

| Campo | Valor |
|-------|-------|
| **Função principal** | Emitir Bolepix mensalmente para todos os alunos ativos |
| **Gatilho** | Cron automático — dia 20 de cada mês às 9h |
| **Ferramentas** | Banco Inter SDK · Supabase · Vercel Functions · Trigger.dev |
| **Canal** | WhatsApp (Meta Business API) + E-mail (backup) |
| **Autonomia** | ✅ Total para emissão e envio rotineiro |
| **Escala ao CEO** | Valores acima de R$ 5.000 · Cancelamentos · Alterações de plano |

**Fluxos cobertos:**
- **F1** — Emissão e envio mensal automático (dia 20)
- **F2** — Confirmação automática via webhook Inter (< 30s)
- **F3** — Verificação de comprovante enviado pelo aluno
- **F4** — Lembrete automático D-3 e D-1 do vencimento *(Fase futura)*

**Indicadores:**
- Taxa de boletos emitidos sem erro
- Taxa de entrega WhatsApp
- Tempo médio de confirmação de pagamento

---

### Agente 2 — Cobrança e Renegociação (Gestão de Inadimplência)
**Plano detalhado:** Seção 4 deste documento  
**Status:** 🟡 Planejado — inicia após Agente 1 estabilizado

| Campo | Valor |
|-------|-------|
| **Função principal** | Monitorar inadimplência, acionar régua de cobrança, propor renegociação |
| **Gatilho** | Cron diário 8h + evento D+1, D+5, D+15 após vencimento |
| **Ferramentas** | Supabase · WhatsApp · Claude API · Trigger.dev |
| **Autonomia** | ✅ Lembretes automáticos · ⚠️ Proposta de renegociação exige CEO |
| **Escala ao CEO** | Toda proposta de desconto ou parcelamento de dívida |

**Régua de cobrança (régua automática):**
| Dia após vencimento | Ação automática |
|--------------------|----------------|
| D+1 | WhatsApp educado: "Identificamos vencimento ontem..." |
| D+5 | WhatsApp firme + e-mail: "Regularize para evitar restrições" |
| D+15 | Alerta ao VP + relatório para CEO com proposta de ação |
| D+30 | CEO decide: renegociação, protesto, ou encaminhamento jurídico |

---

### Agente 3 — Lançamento de Despesas (Contas a Pagar)
**Status:** 🟡 Planejado — Sessões 9–11

| Campo | Valor |
|-------|-------|
| **Função principal** | Registrar, categorizar e alertar sobre despesas e contas a pagar |
| **Gatilho** | Manual (via WhatsApp/e-mail para o agente) + importação de extrato |
| **Ferramentas** | Supabase · Gmail · WhatsApp · Claude API |
| **Autonomia** | ✅ Registro e categorização · ⚠️ Aprovação de novas despesas não recorrentes |
| **Escala ao CEO** | Despesas não recorrentes acima de R$ 500 · Fornecedores novos |

**Capacidades:**
- Recebe nota fiscal por e-mail → extrai dados automaticamente (Claude Vision)
- Categoriza por centro de custo (pessoal, manutenção, material, serviços)
- Alerta CEO quando despesa chega próxima ao limite mensal do orçamento
- Registra fornecedor, valor, vencimento e status no Supabase
- Gera lista "a pagar esta semana" toda segunda-feira às 8h

**Categorias de despesa:**
| Categoria | Exemplos |
|-----------|---------|
| Pessoal | Folha, encargos, pró-labore |
| Infraestrutura | Aluguel, água, luz, internet |
| Material | Papelaria, limpeza, informática |
| Serviços | Contador, advogado, TI, segurança |
| Acadêmico | Material didático, licenças, plataformas |
| Marketing | Publicidade, eventos, redes sociais |

---

### Agente 4 — Conciliação Bancária
**Status:** 🟡 Planejado — Sessões 12–13

| Campo | Valor |
|-------|-------|
| **Função principal** | Comparar extrato bancário Inter com lançamentos no Supabase |
| **Gatilho** | Cron semanal (sexta-feira 18h) + manual |
| **Ferramentas** | Banco Inter API · Supabase · Claude API |
| **Autonomia** | ✅ Conciliação automática de itens identificados · ⚠️ Divergências escaladas ao CEO |
| **Escala ao CEO** | Qualquer divergência não resolvida automaticamente |

**Fluxo de conciliação:**
```
Inter API: busca lançamentos da semana
    ↓
Para cada lançamento no extrato:
  → Busca correspondente no Supabase (por valor + data ± 2 dias)
  ├── Encontrado → marca como conciliado ✅
  └── Não encontrado → gera alerta ⚠️
    ↓
Relatório de conciliação → WhatsApp do CEO
(itens conciliados + itens pendentes + divergências)
```

---

### Agente 5 — Fluxo de Caixa e Projeções
**Status:** 🟡 Planejado — Sessões 14–15

| Campo | Valor |
|-------|-------|
| **Função principal** | Projetar entradas e saídas futuras, alertar sobre caixa mínimo |
| **Gatilho** | Cron semanal (segunda-feira 7h) + evento de alerta |
| **Ferramentas** | Supabase · Claude API · Trigger.dev |
| **Autonomia** | ✅ Cálculo e projeção automáticos · ⚠️ Decisões de gestão de caixa com CEO |
| **Escala ao CEO** | Projeção de caixa negativo em < 30 dias |

**Capacidades:**
- Lê cobranças emitidas (previstas para receber) e despesas cadastradas (previstas para pagar)
- Calcula saldo projetado por semana nos próximos 60 dias
- Alerta: "Em 18 dias o caixa ficará abaixo de R$ X se as cobranças em aberto não forem pagas"
- Identifica meses sazonais de alta inadimplência (histórico)
- Gera relatório de projeção mensal para o CEO

---

### Agente 6 — Relatórios Financeiros (Dashboard CEO)
**Status:** 🔵 Futuro — após os 5 anteriores estabilizados

| Campo | Valor |
|-------|-------|
| **Função principal** | Consolidar dados e gerar relatório executivo semanal/mensal para o CEO |
| **Gatilho** | Cron semanal (domingo 20h para enviar na segunda) + mensal (dia 1) |
| **Ferramentas** | Supabase · Claude API · Gmail / WhatsApp |
| **Autonomia** | ✅ Total — é um agente de informação, não de ação |
| **Escala ao CEO** | Sempre — é o destino do relatório |

**Relatório semanal (CEO - 5 linhas):**
```
📊 Financeiro FIC — Semana [X]

💰 Recebido: R$ XX.XXX
📋 A receber: R$ XX.XXX (X boletos)
⚠️ Em atraso: R$ X.XXX (X alunos — D+5)
💸 Despesas pagas: R$ X.XXX
📈 Caixa atual: R$ XX.XXX

→ Atenção: [alerta principal se houver]
```

**Relatório mensal (CEO - DRE simplificado):**
- Receita total (mensalidades + taxas)
- Inadimplência do mês (valor e percentual)
- Despesas por categoria
- Resultado líquido
- Comparativo com mês anterior

---

## 3. Modelo de Dados — Tabelas do Departamento Financeiro

### Tabelas Existentes (já no plano v2 do Agente 1)
- `cobrancas` — boletos emitidos, status, pagamentos
- `comunicacoes` — log de mensagens enviadas
- `comprovantes_recebidos` — comprovantes enviados por alunos

### Novas Tabelas (Agentes 2–6)

```sql
-- Agente 2: Régua de cobrança e inadimplência
CREATE TABLE inadimplencia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id          UUID REFERENCES alunos(id),
  cobranca_id       UUID REFERENCES cobrancas(id),
  dias_em_atraso    INT NOT NULL,
  valor_em_aberto   DECIMAL(10,2),
  status_regime     TEXT CHECK (status IN ('d1','d5','d15','d30','acordo','encerrado')),
  proximo_contato   TIMESTAMP,
  historico_acao    JSONB,  -- [{data, acao, resultado}, ...]
  acordo_proposto   BOOLEAN DEFAULT FALSE,
  acordo_aprovado   BOOLEAN,  -- NULL=aguardando CEO, TRUE=aprovado, FALSE=negado
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Agente 3: Contas a pagar / despesas
CREATE TABLE despesas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao        TEXT NOT NULL,
  fornecedor       TEXT,
  categoria        TEXT NOT NULL,  -- pessoal | infraestrutura | material | etc.
  valor            DECIMAL(10,2) NOT NULL,
  data_vencimento  DATE NOT NULL,
  data_pagamento   DATE,
  status           TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  recorrente       BOOLEAN DEFAULT FALSE,
  origem           TEXT,  -- 'manual' | 'nf_email' | 'importacao'
  nf_conteudo      TEXT,  -- conteúdo extraído via Claude Vision
  aprovada_ceo     BOOLEAN,  -- NULL=não precisa, TRUE=aprovada, FALSE=rejeitada
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Agente 4: Conciliação bancária
CREATE TABLE conciliacao_bancaria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_lancamento   DATE NOT NULL,
  descricao_extrato TEXT,
  valor             DECIMAL(10,2),
  tipo              TEXT CHECK (tipo IN ('credito','debito')),
  conciliado        BOOLEAN DEFAULT FALSE,
  referencia_id     UUID,  -- ID do registro no Supabase correspondente
  referencia_tabela TEXT,  -- 'cobrancas' | 'despesas'
  divergencia       TEXT,  -- descrição se não conciliado
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Agente 5: Fluxo de caixa projetado
CREATE TABLE fluxo_caixa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE NOT NULL,
  tipo            TEXT CHECK (tipo IN ('entrada_prevista','saida_prevista','saldo_dia')),
  valor           DECIMAL(10,2),
  origem          TEXT,  -- 'cobranca' | 'despesa' | 'calculado'
  origem_id       UUID,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 4. Endpoints do Departamento (Vercel Functions)

| Endpoint | Agente | Chamado por | Função |
|----------|--------|------------|--------|
| `POST /api/emit-boletos` | A1 | Trigger.dev (cron dia 20) | Emite e envia todos os boletos |
| `POST /api/payment-webhook` | A1 | Banco Inter | Confirmação automática de pagamento |
| `POST /api/whatsapp-webhook` | A1 | Meta/WhatsApp | Recebe mensagens dos alunos |
| `POST /api/cobranca-regua` | A2 | Trigger.dev (cron diário 8h) | Executa régua de cobrança por inadimplência |
| `POST /api/despesa-nova` | A3 | Manual / Gmail webhook | Registra nova despesa ou NF |
| `GET /api/despesas-semana` | A3 | Trigger.dev (segunda 8h) | Lista despesas da semana para CEO |
| `POST /api/conciliacao` | A4 | Trigger.dev (sexta 18h) | Executa conciliação bancária semanal |
| `GET /api/fluxo-caixa` | A5 | Trigger.dev (segunda 7h) | Projeta fluxo dos próximos 60 dias |
| `GET /api/relatorio-ceo` | A6 | Trigger.dev (domingo 20h) | Gera e envia relatório semanal ao CEO |

---

## 5. Roadmap de Implementação — Sessão a Sessão

### Fase 1 — Agente de Emissão de Cobranças (Agente 1)
*Referência técnica completa: `planos/SISTEMA-COBRANCAS-v2.md`*  
*Repositório: `ERP-Educacional/`*

| Sessão | Fase | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|------|---------------------|-------------------------------------|
| **S-01** | 1A | Ambiente: Inter sandbox + Supabase | Inter OAuth configurado + 3 tabelas criadas | `supabase/migrations/001_cobrancas.sql` |
| **S-02** | 1A | Primeiro Bolepix emitido | PDF gerado via SDK Inter + salvo no Supabase + enviado por e-mail | `api/financeiro/emit-boletos.py` |
| **S-03** | 1B | Canal WhatsApp integrado | Bolepix entregue ao aluno via WhatsApp + e-mail | `api/financeiro/emit-boletos.py` (atualizado) |
| **S-04** | 1C | Webhook de pagamento | Confirmação automática em < 30s após pagamento via Inter | `api/financeiro/payment-webhook.py` |
| **S-05** | 1D | Verificação de comprovante | Fluxo F3: aluno envia imagem → Claude Vision → Inter → confirmação | `api/financeiro/whatsapp-webhook.py` |
| **S-06** | 1E | Lembrete D-3 e D-1 | Agente envia lembrete automático antes do vencimento | `trigger/financeiro/lembrete-vencimento.py` |
| **S-07** | 1F | Homologação + Go-Live | Testes com alunos reais + Sentry ativo + em produção | `tests/financeiro/test_cobrancas.py` |

---

### Fase 2 — Agente de Cobrança e Renegociação (Agente 2)
*Repositório: `ERP-Educacional/`*

| Sessão | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|---------------------|-------------------------------------|
| **S-08** | Tabela inadimplencia + cron diário | `inadimplencia` criada + job diário 8h | `supabase/migrations/002_inadimplencia.sql` + `trigger/financeiro/regua-cobranca.py` |
| **S-09** | Régua D+1 e D+5 | WhatsApp automático de cobrança nos dias certos | `api/financeiro/cobranca-regua.py` |
| **S-10** | Régua D+15 + alerta CEO | Relatório de inadimplentes enviado ao CEO | `api/financeiro/cobranca-regua.py` (atualizado) |
| **S-11** | Fluxo de acordo (Human-in-the-loop) | CEO aprova/nega renegociação com 1 clique no WhatsApp | `api/financeiro/acordo-webhook.py` |
| **S-12** | Homologação Agente 2 | Testes com dados reais + Go-Live | `tests/financeiro/test_inadimplencia.py` |

---

### Fase 3 — Agente de Lançamento de Despesas (Agente 3)
*Repositório: `ERP-Educacional/`*

| Sessão | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|---------------------|-------------------------------------|
| **S-13** | Tabela despesas + endpoint manual | `despesas` criada + lançamento via formulário | `supabase/migrations/003_despesas.sql` + `api/financeiro/despesa-nova.py` |
| **S-14** | Importação de NF por e-mail | Gmail webhook → Claude Vision → lança no Supabase automaticamente | `api/financeiro/nf-email-webhook.py` |
| **S-15** | Relatório semanal de despesas | Lista "a pagar esta semana" enviada às segundas 8h | `trigger/financeiro/despesas-semana.py` |
| **S-16** | Alertas de limite orçamentário | Alerta CEO quando categoria ultrapassa 80% do orçamento | `api/financeiro/alerta-orcamento.py` |
| **S-17** | Homologação Agente 3 | Testes com dados reais + Go-Live | `tests/financeiro/test_despesas.py` |

---

### Fase 4 — Agente de Conciliação Bancária (Agente 4)
*Repositório: `ERP-Educacional/`*

| Sessão | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|---------------------|-------------------------------------|
| **S-18** | Tabela conciliacao + integração Inter | `conciliacao_bancaria` criada + busca automática do extrato | `supabase/migrations/004_conciliacao.sql` + `api/financeiro/conciliacao.py` |
| **S-19** | Lógica de matching | Cruza extrato Inter com Supabase (tolerância ± R$0,01 e ± 2 dias) | `api/financeiro/conciliacao.py` (atualizado) |
| **S-20** | Relatório semanal de conciliação | Relatório toda sexta ao CEO: ✅ conciliados + ⚠️ divergências | `trigger/financeiro/conciliacao-semanal.py` |
| **S-21** | Homologação Agente 4 | Testes com extrato real + Go-Live | `tests/financeiro/test_conciliacao.py` |

---

### Fase 5 — Agente de Fluxo de Caixa (Agente 5)
*Repositório: `ERP-Educacional/`*

| Sessão | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|---------------------|-------------------------------------|
| **S-22** | Tabela fluxo_caixa + cálculo base | Projeção de 30 dias com cobranças emitidas e despesas cadastradas | `supabase/migrations/005_fluxo_caixa.sql` + `api/financeiro/fluxo-caixa.py` |
| **S-23** | Alertas de caixa mínimo | CEO recebe alerta quando projeção fica abaixo do limite | `trigger/financeiro/alerta-caixa.py` |
| **S-24** | Projeção de 60 dias + sazonalidade | Agente identifica padrões históricos de inadimplência por mês | `api/financeiro/fluxo-caixa.py` (atualizado) |
| **S-25** | Homologação Agente 5 | Testes com dados reais + Go-Live | `tests/financeiro/test_fluxo_caixa.py` |

---

### Fase 6 — Agente de Relatórios (Agente 6)
*Repositório: `ERP-Educacional/`*

| Sessão | Foco | Entregável concreto | Arquivos criados em ERP-Educacional |
|--------|------|---------------------|-------------------------------------|
| **S-26** | Relatório semanal CEO | Consolidação dos 5 agentes → WhatsApp CEO toda segunda-feira | `trigger/financeiro/relatorio-ceo-semanal.py` |
| **S-27** | DRE mensal simplificado | Receita, inadimplência, despesas, resultado, comparativo | `trigger/financeiro/relatorio-ceo-mensal.py` |
| **S-28** | Dashboard HTML para o CEO | Página visual atualizável com dados reais do Supabase | `api/financeiro/dashboard-ceo.py` + `public/dashboard-financeiro.html` |
| **S-29** | Homologação + Go-Live total | Departamento Financeiro 100% operacional | `tests/financeiro/test_relatorios.py` |

---

## 6. Decisões Específicas do Departamento Financeiro

| Decisão | Opções | Prazo | Status |
|---------|--------|-------|--------|
| Canal WhatsApp | Meta Business API ⭐, Z-API, Evolution | Antes de S-03 | ⚠️ Pendente |
| Idioma Vercel Functions | Python (SDK Inter nativo) vs. TypeScript | S-01 | ⚠️ Pendente |
| Hospedagem PDFs | Supabase Storage vs. R2 Cloudflare vs. link direto Inter | S-01 | ⚠️ Pendente |
| Limite de alerta de caixa mínimo | Valor em R$ a definir com Marcelo | S-22 | 🔵 Futuro |
| Orçamento mensal por categoria | Valores a definir com Marcelo | S-13 | 🔵 Futuro |

> **✅ DECIDIDO — Repositório:** Todo o código vai para `ERP-Educacional/`. As tabelas novas são migrations adicionadas ao Supabase do ERP. Não há schema separado.

---

## 7. Matriz de Autonomia — Departamento Financeiro

| Ação | Agente age sozinho? | Motivo |
|------|-------------------|--------|
| Emitir bolepix mensal | ✅ Sim | Rotina definida, baixo risco |
| Confirmar pagamento recebido | ✅ Sim | Webhook garante veracidade |
| Enviar lembrete D-3 e D-1 | ✅ Sim | Informativo, sem consequência |
| Enviar cobrança D+1 e D+5 | ✅ Sim | Tom definido, dentro da régua |
| Registrar e categorizar NF | ✅ Sim | Automação de dados |
| Conciliar lançamentos automáticos | ✅ Sim | Matching baseado em regras |
| Gerar relatório CEO | ✅ Sim | É um agente de informação |
| Propor renegociação de dívida | ⚠️ Pede ao CEO | Decisão financeira |
| Aprovar nova despesa não recorrente | ⚠️ Pede ao CEO | Controle de gastos |
| Alertar sobre divergência bancária | ⚠️ Alerta CEO | Pode ser erro ou fraude |
| Realizar qualquer transferência | 🚫 Nunca | Decisão financeira crítica |
| Cancelar cobrança | 🚫 Nunca sem CEO | Impacto de receita |

---

## 8. KPIs do Departamento Financeiro

| Métrica | Meta | Medido por |
|---------|------|-----------|
| Taxa de boletos emitidos sem erro | 100% | Agente 1 |
| Tempo de confirmação de pagamento | < 30s | Agente 1 |
| Taxa de entrega de WhatsApp | ≥ 98% | Agente 1 |
| Inadimplência ativa | Reduzir 30% em 6 meses | Agente 2 |
| Cobertura de régua de cobrança | 100% dos inadimplentes | Agente 2 |
| Despesas lançadas manualmente | < 10% (resto é automático) | Agente 3 |
| Taxa de conciliação automática | ≥ 90% dos lançamentos | Agente 4 |
| Previsibilidade de caixa (erro) | < 5% de diferença na projeção de 30d | Agente 5 |
| Relatório CEO entregue toda segunda | 100% | Agente 6 |

---

## 9. Referências

| Documento | Localização | Usado em |
|----------|------------|---------|
| Masterplan v2 | `masterplans/MASTERPLAN-FIC-MULTIAGENTES-v2.md` | Visão geral |
| Sistema de Cobranças v2 (detalhe técnico) | `planos/SISTEMA-COBRANCAS-v2.md` | Sessões S-01 a S-07 |
| ERP-Educacional (**repositório de todo o código**) | `ERP-Educacional/` | Todas as Vercel Functions, migrations, jobs e testes vivem aqui |
| SDK Python Banco Inter | `github.com/inter-co/pj-sdk-python` | S-01 em diante |
| Memória do Ecossistema | `Ecossistema/memory/MEMORY.md` | Contexto geral |

---

*Departamento Financeiro v1.0 — Sessão 005 — Ecossistema de Inovação e IA.*
