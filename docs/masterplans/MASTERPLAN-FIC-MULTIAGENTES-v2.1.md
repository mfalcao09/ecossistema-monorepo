# MASTERPLAN — Sistema Multi-Agentes FIC
**Versão:** 2.1
**Criado em:** 12/04/2026 (v2.0)
**Atualizado em:** 14/04/2026 (Sessão 014 — Patches P0→P4 de alinhamento com V8.1)
**Mudança principal (v2.1):** Declaração formal de herança do V8.1 Ecossistema (plano-fonte estratégico), IDs Supabase canônicos, cláusula LGPD/FIC, anexos de mapeamento Fases↔Ondas e RACI C-Suite↔Super-Crates.
**Projeto:** Ecossistema de Inovação e IA — Faculdades Integradas de Cassilândia
**Responsável:** Marcelo Silva (CEO)
**Status:** 🟡 Planejamento consolidado — Fase 1A (CFO) liberada para execução

---

## 🧭 P0 — PREÂMBULO E RELAÇÃO COM O V8.1 ECOSSISTEMA *(NOVO em v2.1)*

> **Este é um plano de aplicação, não um plano-fonte.**
>
> O plano-fonte é o **V8.1 Omega Multi-Provider Resilience Edition** do Ecossistema de Inovação e IA. Este MASTERPLAN FIC v2.1 é a **concretização tático-operacional** daquele plano numa unidade de negócio específica: **Faculdades Integradas de Cassilândia**.

### Princípio-mãe (Sessão 013 · 14/04/2026)

> *"O tático se alimenta do estratégico. Nunca o contrário. Quando houver divergência, o V8.1 prevalece."*
>
> — Marcelo Silva, CEO

### Relação Macro × Tático

```
╔══════════════════════════════════════════════════════════════════╗
║       🌍 V8.1 ECOSSISTEMA (FONTE · ESTRATÉGICO · MACRO)          ║
║                                                                  ║
║  22 Artigos Constitucionais · 13 Meta-Padrões · 28 Super-Crates  ║
║  7 Camadas (L1–L7) · 17 Ondas · Multi-Provider Resilience        ║
║  Cross-business: FIC · Klésis · Intentus · Splendori · Nexvy     ║
╚═══════════════════════════════╤══════════════════════════════════╝
                                │ herda
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ MASTERPLAN   │      │ MASTERPLAN   │      │ MASTERPLAN   │
  │     FIC      │      │  INTENTUS    │      │   KLÉSIS     │
  │   (v2.1)     │      │  (futuro)    │      │  (futuro)    │
  └──────────────┘      └──────────────┘      └──────────────┘
     ▲ ESTE                                    ▲ exceção LGPD
     DOCUMENTO                                 (menores)
```

### Por que esta separação importa

Antes da Sessão 013, existiam dúvidas sobre "conflitos" entre V8.1 e o MASTERPLAN FIC v2 (9 gaps, 2 contradições). A leitura correta é que não há conflitos competitivos — há **assimetria natural** entre um plano-fonte global e um plano-aplicação local. O v2.1 resolve isso tornando a herança **explícita**.

### Regras de sincronização (governança)

1. Toda nova versão do V8.1 dispara revisão cascata em todos os MASTERPLANs herdeiros.
2. Todo MASTERPLAN específico deve declarar no cabeçalho a versão V8.1 base e os Artigos/MP/SC/Ondas herdados (ver **P1**).
3. Divergências temporárias entre V8.1 e um MASTERPLAN devem ser registradas como `memory/decisions/divergencia-<motivo>-<data>.md` e resolvidas na próxima sessão de sincronização.
4. INSERT em `ecosystem_memory` (Supabase ECOSYSTEM) é obrigatório para qualquer decisão desta camada tática que contradiga o V8.1.

---

## 📜 P1 — CABEÇALHO DE HERANÇA V8.1 *(NOVO em v2.1)*

**Versão V8.1 base:** `V8.1 Omega Multi-Provider Resilience Edition (Plano B)` · declarada canônica em 14/04/2026 (Sessão 012).

### Artigos Constitucionais Herdados (22 artigos · todos aplicáveis)

| Artigo | Nome | Como aplica no FIC |
|--------|------|-------------------|
| I | Primazia do Propósito | Todo agente FIC serve à missão educacional antes de servir à eficiência |
| II | Human-in-the-loop Crítico | CEO aprova ações de alto risco (assinaturas MEC, transferências, comunicados externos) |
| III | Idempotência Universal | Webhooks Inter, envios WhatsApp e notificações de cobrança nunca duplicam |
| IV | Rastreabilidade Total | Todo envio/confirmação/ação do agente é logado em `fic_agente_logs` |
| V | Memória Persistente | Histórico entre sessões preservado via Supabase ECOSYSTEM + `.md` cache |
| VI | Autonomia Gradual | Nível 0→1→2: começar manual, chegar a automatizado-com-supervisão |
| VII | Hierarquia Respeitada | Agente operacional → VP (Claudinho) → CEO (Marcelo). Nunca pular camadas |
| VIII | Confirmação por Baixa Real | Cobrança só confirmada via webhook Banco Inter; nunca por mensagem do aluno |
| IX | Falha Explícita | Agente que não sabe → consulta VP; VP que não sabe → consulta CEO |
| X | Princípio da Menor Surpresa | UX do sistema não quebra expectativas de secretaria/coordenação |
| XI | Reversibilidade | Toda ação de agente tem contramedida documentada (refund, rollback, cancel) |
| XII | Custos sob Controle | LLM budget por agente; alertas em threshold 70%/90% |
| XIII | **Skill-First** | Consultar Skill Registry (Cowork) antes de reinventar capability |
| XIV | Dual-Write (Supabase-first) | INSERT online primeiro; `.md` local vira cache |
| XV | Multi-Tenant Data Isolation | RLS `USING (tenant_id = current_setting(...))` em toda tabela compartilhada |
| XVI | Observabilidade por Default | Sentry + logs estruturados em toda Vercel Function |
| XVII | Testes antes do Deploy | Smoke-test (≥1 happy path) obrigatório antes de ativar agente em produção |
| XVIII | Data Contracts versionados | Schemas Zod/JSON versionados; breaking change exige patch bump |
| XIX | Segurança em Camadas | CSRF + RLS + rate-limit + validação server-side obrigatórios |
| XX | Soberania Local supera Dependência | Exceção Klésis (LGPD menores) preservada mesmo em multi-provider |
| XXI | Escolha de Modelo é Estratégia | Claude Opus para raciocínio; Haiku para tarefas rotineiras; fallback OpenRouter |
| XXII | Aprendizado é Infraestrutura | Cada sessão gera memória `ecosystem_memory`; nunca se perde conhecimento |

### Meta-Padrões Herdados (13 MP)

| MP | Nome | Aplicação no FIC |
|----|------|-----------------|
| MP-01 | Orquestrador Central + Especialistas | Claudinho (VP) orquestra CFO/CAO/CMO/CSO/CTO/CLO/COO-Ops IAs |
| MP-02 | Memória em Camadas | Working (TodoWrite) → Sessão (.md) → Ecossistema (Supabase) |
| MP-03 | Skill Registry First | Skills `edu-management`, `finance`, `sales`, `marketing` acionadas antes de custom |
| MP-04 | Dual-Write | Supabase ECOSYSTEM + `memory/*.md` em todo encerramento |
| MP-05 | Human-in-the-loop por Classe de Risco | Matriz de autonomia (§6) classifica cada decisão |
| MP-06 | Idempotência por Chave Natural | Boleto = (aluno_id, mes_ref); webhook = (txid, status) |
| MP-07 | **Multi-Provider Resilience** | Claude → OpenRouter → Workers AI (fallback N+2) |
| MP-08 | Audit Log Imutável | `fic_agente_logs` com append-only, PII mascarada |
| MP-09 | Retry com Backoff Exponencial | Trigger.dev jobs: 3 tentativas 1s/5s/30s |
| MP-10 | Validação em Camadas | Zod runtime + RLS DB + rate-limit edge |
| MP-11 | Rollback Declarativo | Toda action de agente declara compensation action |
| MP-12 | Custo Observável | OpenRouter tracking + Anthropic usage + Sentry cost-tag |
| MP-13 | Contratos de Dados Versionados | `schemas/fic/v1/boleto.ts`, `v1/aluno.ts` em repo |

### Super-Crates Herdados (28 SC · subset aplicável ao FIC)

| SC | Nome | Aplicação FIC | Fase/Onda FIC |
|----|------|---------------|---------------|
| SC-03 | Dual-Write Pipeline | Toda tabela crítica FIC com replicação Supabase→ECOSYSTEM | Onda 2 |
| SC-05 | Skill Router | Claudinho roteia pedidos da secretaria para skill certa | Onda 3 |
| SC-07 | Human Approval Queue | Fila `aprovacoes_pendentes` com UI no painel CEO | Onda 4 |
| SC-08 | Cost Observer | Dashboard `custos_agentes_fic` com alertas | Onda 4 |
| SC-10 | Webhook Hardening | Inter webhooks validam HMAC + ignoram replay via `event_id` | Onda 1 |
| SC-12 | Memory Consolidator | Job diário consolida `fic_agente_logs` em `ecosystem_memory` | Onda 6 |
| SC-14 | Agent Runner (Claude Agent SDK) | Template base para todo agente FIC | Onda 1 |
| SC-17 | Multi-Provider LLM Gateway | Fallback Claude→OpenRouter→Workers AI | Onda 7 |
| SC-19 | PII Mask Pipeline | CPF/RG/endereço mascarados em logs e LLM prompts | Onda 3 |
| SC-22 | Minors Data Fortress *(exceção Klésis)* | N/A para FIC maior de idade; **aplica** se FIC receber ≤17 | Onda 8 |
| SC-24 | RACI Registry | Ver Anexo B do v2.1 | Onda 5 |
| SC-27 | Incident Commander | Sentry + playbook de incident por classe | Onda 9 |
| SC-28 | Regulatory Deadline Watcher | Prazos e-MEC vigiados com alerta D-7/D-3/D-1 | Onda 10 |

### Ondas Herdadas (17 Ondas V8.1 · mapeamento FIC em Anexo A)

> As 17 Ondas do V8.1 são cronologia do Ecossistema; no FIC elas se **entrelaçam** com as Fases 1A→3B. Ver **Anexo A (P4)** para o mapa bidirecional.

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

## 🗄️ P2 — IDs SUPABASE CANÔNICOS *(NOVO em v2.1)*

### Regra de separação ERP × ECOSYSTEM

**Dois papéis, dois bancos.** Não confundir nunca:

| Banco | ID do projeto | Região | Papel | O que contém |
|-------|---------------|--------|-------|--------------|
| **ERP-Educacional** | `ifdnjieklngcfodmtied` | `sa-east-1` | **Operacional** — dados de produção FIC | Alunos, boletos, disciplinas, processos de diploma, comprobatórios, acervo, histórico, XMLs, logs de agente |
| **ECOSYSTEM** | `gqckbunsfjgerbuiyzvn` | `us-east-2` | **Governança/Memória** — cross-business | Sessões de trabalho, decisões arquiteturais, feedback do usuário, referências, status de projetos, aprendizado persistente |
| **Intentus** | `bvryaopfjiyxjgsuhjsb` | (outra região) | Operacional Intentus | *Não tocar neste plano — é outro negócio* |

### Regras operacionais

1. **Código de produção FIC → ERP-Educacional (`ifdnjieklngcfodmtied`).** Agentes leem alunos, gravam cobranças, acionam webhooks nesse banco.
2. **Memória de sessão/decisão → ECOSYSTEM (`gqckbunsfjgerbuiyzvn`).** Toda decisão arquitetural, feedback do CEO, aprendizado do agente é persistido lá.
3. **Dual-write em eventos críticos.** Decisões que afetam código+governança (ex.: "adotar WhatsApp Business API") gravam nos dois: ERP em tabela operacional, ECOSYSTEM em `ecosystem_memory`.
4. **Nunca** gravar dados de produção (CPF, boleto, nota) no ECOSYSTEM.
5. **Nunca** gravar memória de trabalho/decisão no ERP.

### MCP tools vinculadas

| MCP Tool | Projeto default |
|----------|-----------------|
| `mcp__05dc4b38-c201-4b12-8638-a3497e112721__execute_sql` | Passar `project_id: "gqckbunsfjgerbuiyzvn"` para memória OU `"ifdnjieklngcfodmtied"` para operacional |
| `mcp__05dc4b38-c201-4b12-8638-a3497e112721__list_tables` | Ditto — sempre declarar projeto |

### Convenção de nomenclatura de tabelas FIC

| Prefixo | Finalidade | Exemplo | Banco |
|---------|-----------|---------|-------|
| `fic_` | Entidades operacionais FIC | `fic_alunos`, `fic_boletos` | ERP-Educacional |
| `fic_agente_` | Logs, eventos e aprovações dos agentes | `fic_agente_logs`, `fic_agente_aprovacoes_pendentes` | ERP-Educacional |
| `diploma_` | Pipeline de diploma digital | `diploma_processos`, `diploma_comprobatorios` | ERP-Educacional (já existe) |
| `ecosystem_` | Memória e governança cross-business | `ecosystem_memory`, `ecosystem_decisions` | ECOSYSTEM (já existe) |

### Checklist antes de criar tabela nova

- [ ] Qual banco? (operacional → ERP · memória → ECOSYSTEM)
- [ ] RLS ON com policy `authenticated` (Art. XIX)
- [ ] `search_path` fixo em triggers/functions
- [ ] Prefixo da nomenclatura correto
- [ ] Migration criada em `ERP-Educacional/supabase/migrations/`
- [ ] `ecosystem_memory` registra a decisão arquitetural (dual-write)

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
║                 🤖 CLAUDINHO (Claude Opus 4.6)                ║
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

## 4. Princípios do Sistema *(herdam Artigos V8.1 · ver P1)*

1. **Confirmação somente após baixa real** — nenhuma ação crítica sem validação no sistema *(Art. VIII)*
2. **Human-in-the-loop** — Marcelo aprova ações de alto risco antes de executarem *(Art. II)*
3. **Memória persistente** — histórico preservado entre conversas *(Art. V · MP-02)*
4. **Rastreabilidade total** — todo envio, confirmação e ação é logado *(Art. IV · MP-08)*
5. **Idempotência** — nenhuma notificação duplicada por falha de webhook *(Art. III · MP-06)*
6. **Autonomia gradual** — começar simples, expandir com confiança *(Art. VI)*
7. **Hierarquia respeitada** — agente operacional não escala direto ao CEO; passa pelo VP *(Art. VII · MP-01)*

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
           │  + Claude API (Opus)   │
           │  + OpenRouter fallback │
           │  + Workers AI fallback │
           └──────────┬─────────────┘
                      │
          ┌───────────┼────────────┐
          ↓                        ↓
  ┌──────────────┐      ┌──────────────────────┐
  │   SUPABASE   │      │   HUMAN-IN-THE-LOOP   │
  │ ERP-Educa-   │      │   WhatsApp / Email    │
  │ cional (prod)│      │   Marcelo autoriza    │
  └──────┬───────┘      └──────────────────────┘
         │ dual-write crítico
         ▼
  ┌──────────────┐
  │   SUPABASE   │
  │  ECOSYSTEM   │  ← memória, decisões, aprendizado
  │ (governança) │
  └──────────────┘
```

### Stack Tecnológico *(com herança V8.1)*

| Componente | Tecnologia | Papel | Vínculo V8.1 |
|-----------|-----------|-------|--------------|
| Banco operacional | Supabase ERP-Educacional (`ifdnjieklngcfodmtied` · sa-east-1) | Fonte única de verdade FIC | MP-04 · SC-03 |
| Banco governança | Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn` · us-east-2) | Memória cross-business | MP-02 · Art. XIV |
| Hosting API | Vercel Functions (ERP-Educacional) | Código em `ERP-Educacional/api/` | SC-14 |
| Agendamento | Trigger.dev | Cron jobs e delayed jobs | MP-09 |
| Gateway de pagamento | Banco Inter (Bolepix) | Emissão de cobranças + webhooks | SC-10 |
| Canal WhatsApp | **Meta Business API** ⭐ (ver §9) | Comunicação com alunos | SC-14 |
| LLM primário | Claude Opus 4.6 / Sonnet 4.6 / Haiku 4.5 | Raciocínio dos agentes | Art. XXI |
| LLM fallback | OpenRouter → Workers AI | Resiliência multi-provider | MP-07 · SC-17 |
| Monitoramento | Sentry | Erros e alertas | Art. XVI · SC-27 |
| Storage primário | Supabase Storage | Documentos FIC | MP-07 |
| Storage fallback | Cloudflare R2 → Backblaze B2/S3 | Backup + DR | MP-07 |

---

## 🔐 P3 — CLÁUSULA LGPD / DADOS PESSOAIS FIC *(NOVO em v2.1)*

### Escopo legal

**FIC atende exclusivamente maiores de idade** (cursos de graduação e pós-graduação). Por isso, dados de **menores não são esperados** em produção FIC. Ainda assim, o plano inclui:

1. **Salvaguardas LGPD gerais** para todos os alunos (maiores) — capítulo geral desta cláusula.
2. **Exceção Klésis preservada** (SC-22 · Art. XX) — quando dados de menores chegarem ao ecossistema pelo Colégio Klésis, rota separada com embeddings locais, nunca por provedor externo.
3. **Hipótese FIC-menor** — se eventualmente um aluno menor de idade for matriculado (ex.: caso especial de PAS/admissão especial), disparar **protocolo Klésis-equivalente** (ver §P3.4).

### P3.1 Bases legais aplicáveis ao FIC

| Dado | Base legal LGPD | Finalidade |
|------|----------------|-----------|
| CPF, RG, nome completo | Art. 7º V (execução de contrato) | Matrícula e emissão de diploma |
| Endereço residencial | Art. 7º V | Correspondência oficial |
| E-mail, telefone | Art. 7º V | Comunicação acadêmica e cobrança |
| Histórico escolar | Art. 7º VI (exercício regular de direitos) | Prova de vínculo e histórico acadêmico |
| Dados financeiros (boletos) | Art. 7º V | Cobrança de mensalidades |
| Dados biométricos *(se houver)* | Art. 7º I (consentimento) | Acesso físico / autenticação (futuro) |

### P3.2 Tratamento de dados sensíveis e PII

- **PII em prompt LLM:** toda chamada Claude/OpenRouter/Workers passa por pipeline de mascaramento (SC-19) — CPF vira hash parcial, RG é omitido, endereço é anonimizado.
- **PII em logs:** `fic_agente_logs` grava apenas hash de identificação; o log bruto é armazenado em bucket criptografado com retenção 12 meses.
- **PII em embeddings:** embeddings de conteúdo FIC para RAG são gerados **sem PII** (já mascarada no preprocessing). Prova: auditoria trimestral.

### P3.3 Direitos do titular (alunos FIC)

| Direito | Canal | SLA |
|---------|-------|-----|
| Confirmação de existência de dado | Portal do aluno + e-mail `dpo@fic.edu.br` | 15 dias |
| Acesso aos dados | Portal do aluno (self-service) | imediato |
| Correção | Secretaria acadêmica | 5 dias |
| Anonimização/exclusão (após ciclo legal) | E-mail DPO + validação identidade | 30 dias |
| Portabilidade | Export PDF/XML via portal | 15 dias |
| Revogação de consentimento | Portal do aluno | imediato |

### P3.4 Protocolo "FIC-menor" *(hipótese rara, mas prevista)*

Se um aluno FIC for identificado como menor de 18 anos, **cai automaticamente na rota Klésis-equivalente**:

1. Flag `is_minor = true` no registro do aluno.
2. Consentimento do responsável legal obrigatório e arquivado.
3. LLM **não pode processar** dados desse aluno sem passar pelo pipeline de mascaramento reforçado.
4. Embeddings gerados usando **modelo local** (Workers AI on-device OU pipeline self-hosted), nunca Claude direto.
5. Auditoria mensal (vs. trimestral).
6. Em qualquer dúvida: VP (Claudinho) escala para CEO, que consulta CLO-IA (futuro) ou jurídico humano.

### P3.5 DPO e governança

- **DPO:** Marcelo Silva (CEO) até nomeação formal.
- **Auditoria LGPD:** trimestral, com relatório em `ecosystem_memory` (type=`reference`, tags=`[lgpd, auditoria]`).
- **Incidente de segurança:** playbook SC-27 + notificação ANPD em 48h + comunicação ao titular.

### P3.6 Relação com Art. XX (Soberania Local)

O Art. XX do V8.1 afirma "Soberania Local supera Dependência" — no FIC isso se materializa como:
- Dados operacionais FIC ficam em Supabase **sa-east-1** (território brasileiro).
- Embeddings de menores (se houver) nunca saem do território nacional.
- Backup DR (R2/B2) configurado com regras de residência de dados.

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
| Acesso a dados de possível menor (flag `is_minor`) | ⚠️ Pede autorização + pipeline reforçado | P3.4 |
| Assinar/protocolar documento MEC | 🚫 Nunca | Responsabilidade legal |
| Transferência bancária | 🚫 Nunca | Decisão financeira crítica |
| Exclusão/anonimização LGPD | 🚫 Nunca autônomo | Sempre supervisionado |

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

**Skills V8.1 acionadas:** `finance:journal-entry-prep`, `finance:reconciliation`, `finance:variance-analysis`, `finance:close-management`, `data:build-dashboard`.

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
| **Agente de Diploma Digital** | Pipeline XMLs MEC (já em desenvolvimento separado) | 🟢 Em produção parcial |

**Skills V8.1 acionadas:** `edu-management`, `customer-support:draft-response`, `operations:compliance-tracking`.
**SC vinculado:** SC-28 (Regulatory Deadline Watcher) para prazos MEC.

---

### 7.3 CMO — Diretor de Marketing IA 📣
**Status:** 🟡 P2 — Plano a criar

| Agente | Função |
|--------|--------|
| Agente de Conteúdo | Posts, e-mails, stories (Brand Comms skill) |
| Agente de Captação | Leads vestibular FIC / compradores Splendori |
| Agente de Tráfego | Relatórios de performance de campanhas |

**Skills V8.1 acionadas:** `brand-comms`, `marketing:content-creation`, `marketing:campaign-plan`, `true-copywriter`, `trend-hunter`.

---

### 7.4 CSO — Diretor Comercial IA 💼
**Status:** 🟡 P3 — Plano a criar

| Agente | Função |
|--------|--------|
| Agente de Prospecção | Apollo + Common Room |
| Agente de Follow-up | Negociações em aberto |
| Agente de Proposta | Propostas personalizadas automáticas |

**Skills V8.1 acionadas:** `sales:draft-outreach`, `sales:call-prep`, `apollo:prospect`, `common-room:prospect`, `sales-strategist`.

---

### 7.5 CTO — Diretor de Tecnologia IA ⚙️
**Status:** 🟡 P3 — Plano a criar

| Agente | Função |
|--------|--------|
| Squad de Dev (Buchecha/MiniMax líder) | Código, revisão, testes |
| Agente de Deploy | Vercel + Supabase |
| Agente de Monitoramento | Sentry, uptime, logs |

**Skills V8.1 acionadas:** `engineering:code-review`, `engineering:deploy-checklist`, `engineering:incident-response`, todas as `*-ai-assistant:*-pair-programming`.

---

### 7.6 CLO — Diretor Jurídico IA ⚖️
**Status:** 🔵 P4 — Futuro

| Agente | Função |
|--------|--------|
| Agente de Contratos | Minutas, revisão, compliance |
| Agente LGPD | Auditoria, DPO assist, direitos do titular |
| Agente Regulatório | MEC, ANPD, tributário |

**Skills V8.1 acionadas:** `legal-docs`, `legal:review-contract`, `legal:compliance-check`, `legal:triage-nda`.

---

### 7.7 COO-Ops — Diretor de Operações IA 🔧
**Status:** 🔵 P4 — Futuro

| Agente | Função |
|--------|--------|
| Agente de Processos Internos | SOPs, runbooks, mapeamento |
| Agente de Vendor Management | Fornecedores, contratos, custos |
| Agente de Capacity Planning | Dimensionamento de equipe e TI |

**Skills V8.1 acionadas:** `operations:process-doc`, `operations:runbook`, `operations:vendor-review`, `operations:capacity-plan`.

---

## 8. Roadmap Global

| Fase | Departamento | Entregável | Status | Ondas V8.1 vinculadas |
|------|-------------|-----------|--------|----------------------|
| **1A** | Financeiro | Agente de Cobranças — Emissão e envio por e-mail | 🔴 Próxima sessão | Ondas 1, 2, 3 |
| **1B** | Financeiro | Agente de Cobranças — Canal WhatsApp integrado | 🟡 Aguarda decisão WA | Onda 3 |
| **1C** | Financeiro | Agente de Cobranças — Confirmação via webhook | 🟡 Planejado | Onda 1 (SC-10) |
| **1D** | Financeiro | Agente de Cobranças — Verificação de comprovante | 🟡 Planejado | Onda 4 |
| **1E** | Financeiro | Agente de Cobrança e Renegociação | 🟡 Planejado | Onda 4 |
| **1F** | Financeiro | Agente de Lançamento de Despesas | 🟡 Planejado | Onda 5 |
| **1G** | Financeiro | Agente de Conciliação Bancária | 🟡 Planejado | Onda 5 |
| **1H** | Financeiro | Relatório CEO semanal (DRE simplificado) | 🟡 Planejado | Onda 6 (SC-08) |
| **2A** | Acadêmico | Agente de Evasão | 🔵 Futuro | Onda 8 |
| **2B** | Acadêmico | Agente Regulatório MEC | 🔵 Futuro | Onda 10 (SC-28) |
| **2C** | Acadêmico | Agente de Atendimento ao Aluno | 🔵 Futuro | Onda 9 |
| **3A** | Marketing | Agente de Conteúdo | 🔵 Futuro | Onda 11 |
| **3B** | Marketing | Agente de Captação | 🔵 Futuro | Onda 11 |

> **Mapa completo Fases↔Ondas:** ver **Anexo A (P4)**.

---

## 9. Decisões em Aberto (Global)

| Decisão | Opções | Prazo | Guardrail V8.1 |
|---------|--------|-------|----------------|
| Canal WhatsApp | **Meta Business API** ⭐, Z-API, Evolution, Twilio, Nexvy | Antes da Fase 1B | Art. XIX (segurança em camadas) |
| Arquitetura multi-negócio | Transversal vs. por unidade | Quando 2º negócio precisar | MP-13 (Data Contracts versionados) |
| Idioma Vercel Functions | Python (SDK Inter nativo) vs. TypeScript | Fase 1A | Art. XVIII (tooling padronizado) |
| LLM primário vs. fallback budget | % de tráfego Claude/OpenRouter/Workers AI | Fase 1A | MP-07 · Art. XXI |

> **✅ DECIDIDO:** Repositório de implementação = `ERP-Educacional/`. Não há mais opção de schema separado — os agentes vivem no ERP como extensão natural do sistema existente.

> **✅ DECIDIDO (Sessão 013):** V8.1 é plano-fonte; FIC é plano-aplicação. Divergências resolvidas por este v2.1 (ver P0).

---

## 10. KPIs do Sistema

| Métrica | Meta | Vínculo V8.1 |
|---------|------|--------------|
| % ações sem intervenção humana | ≥ 80% | Art. VI |
| Tempo de confirmação de pagamento | < 30 segundos | Art. VIII |
| Taxa de evasão mensal | Reduzir 20% em 6 meses | Agente Evasão (Fase 2A) |
| Boletos sem resposta em D+5 | Acionar lembrete automático | MP-09 |
| Prazos MEC perdidos | Zero | SC-28 · Art. II |
| Uptime dos agentes | ≥ 99% | MP-07 (multi-provider) |
| Inadimplência ativa | Reduzir 30% em 6 meses | Fase 1E |
| Incidentes LGPD | Zero com impacto | P3 · Art. XX |
| Custo LLM/agente | Dentro do budget MP-12 | SC-08 |
| Cobertura dual-write (decisões) | 100% | MP-04 · Art. XIV |

---

## 📎 P4 — ANEXOS DE MAPEAMENTO *(NOVO em v2.1)*

### Anexo A — Fases FIC ↔ Ondas V8.1 (mapa bidirecional)

#### A.1 Fases FIC → Ondas V8.1 (onde cada fase se apoia)

| Fase FIC | Ondas V8.1 principais | Ondas V8.1 de suporte |
|----------|----------------------|-----------------------|
| **1A** Cobranças e-mail | Onda 1 (Fundação) · Onda 2 (Dual-write) | Onda 3 (Skills) |
| **1B** Cobranças WhatsApp | Onda 3 (Skills) | Onda 1 (Fundação) |
| **1C** Webhook Inter | Onda 1 (Fundação) — SC-10 | Onda 7 (Multi-provider — fallback webhook) |
| **1D** Verificação comprovante | Onda 4 (Human-in-loop) | Onda 3 (Skills) |
| **1E** Renegociação | Onda 4 (Human-in-loop) | Onda 6 (Observabilidade) |
| **1F** Despesas | Onda 5 (RACI/Autonomia) | Onda 4 |
| **1G** Conciliação | Onda 5 (RACI/Autonomia) | Onda 6 |
| **1H** Relatório CEO | Onda 6 (Observabilidade) — SC-08 | Onda 5 |
| **2A** Evasão | Onda 8 (Intelligence/RAG) | Onda 6 |
| **2B** Regulatório MEC | Onda 10 (Regulatory) — SC-28 | Onda 2 |
| **2C** Atendimento aluno | Onda 9 (Conversational) | Onda 8 |
| **3A** Conteúdo | Onda 11 (Marketing/Brand) | Onda 3 |
| **3B** Captação | Onda 11 (Marketing/Brand) | Onda 8 |

#### A.2 Ondas V8.1 → Fases FIC (o que cada onda entrega ao FIC)

| Onda V8.1 | O que entrega ao FIC |
|-----------|---------------------|
| Onda 1 Fundação | Template Claude Agent SDK (SC-14), webhook hardening (SC-10) → habilita 1A+1C |
| Onda 2 Supabase-first · Dual-write | Pipeline `ecosystem_memory` (SC-03) → habilita persistência de memória em todas as fases |
| Onda 3 Skill Registry | Skill Router (SC-05) → habilita 1A e-mail, 1B WhatsApp, 2C atendimento |
| Onda 4 Human-in-the-loop | Fila de aprovação (SC-07) → habilita 1D, 1E e matriz de autonomia |
| Onda 5 RACI e Autonomia | RACI Registry (SC-24) → habilita 1F, 1G e escalação de risco |
| Onda 6 Observabilidade | Cost Observer (SC-08), Memory Consolidator (SC-12) → habilita 1H, relatório CEO |
| Onda 7 Multi-provider | LLM Gateway (SC-17) → habilita resiliência em TODAS as fases |
| Onda 8 Intelligence/RAG | Embeddings, pipeline PII (SC-19) → habilita 2A evasão, 3B captação |
| Onda 9 Conversational | Orquestração diálogo → habilita 2C atendimento aluno |
| Onda 10 Regulatory | Deadline Watcher (SC-28) → habilita 2B MEC |
| Onda 11 Marketing/Brand | Integrações marca + conteúdo → habilita 3A, 3B |

---

### Anexo B — RACI: C-Suite FIC ↔ Super-Crates V8.1

**Legenda RACI:** R=Responsible · A=Accountable · C=Consulted · I=Informed

| Super-Crate | CEO (Marcelo) | VP (Claudinho) | CFO-IA | CAO-IA | CMO-IA | CSO-IA | CTO-IA | CLO-IA | COO-IA |
|-------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| SC-03 Dual-Write Pipeline | A | R | C | C | C | C | **R** | I | I |
| SC-05 Skill Router | I | **R/A** | C | C | C | C | C | I | I |
| SC-07 Human Approval Queue | **A** | **R** | C | C | C | C | C | C | I |
| SC-08 Cost Observer | I | A | **R** | C | C | C | C | I | C |
| SC-10 Webhook Hardening | I | A | C | I | I | I | **R** | C | I |
| SC-12 Memory Consolidator | I | **R/A** | I | I | I | I | C | I | I |
| SC-14 Agent Runner | I | A | I | I | I | I | **R** | I | I |
| SC-17 Multi-Provider LLM | A | **R** | I | I | I | I | **R** | I | I |
| SC-19 PII Mask Pipeline | **A** | R | C | **R** | C | C | **R** | **R** | I |
| SC-22 Minors Data Fortress | **A** | R | I | **R** | I | I | C | **R** | I |
| SC-24 RACI Registry | A | **R** | C | C | C | C | C | C | **R** |
| SC-27 Incident Commander | **A** | R | I | I | I | I | **R** | C | C |
| SC-28 Regulatory Deadline Watcher | **A** | R | I | **R** | I | I | C | C | I |

> **Leitura:** células com **R** marcam a responsabilidade operacional principal; **A** marca a accountability final (quem é cobrado pelo resultado). CEO é Accountable em todas as decisões de risco alto (LGPD, regulatório, financeiro crítico, incidentes).

---

### Anexo C — Meta-Padrões V8.1 ↔ Implementação concreta no FIC

| MP | Nome | Onde aparece no FIC |
|----|------|--------------------|
| MP-01 Orquestrador + Especialistas | Claudinho + C-Suite IA (§2-3) |
| MP-02 Memória em Camadas | TodoWrite (sessão) + `.md` + `ecosystem_memory` (P2) |
| MP-03 Skill Registry First | Skills acionadas em cada diretor (§7.1-7.7) |
| MP-04 Dual-Write | P2 — regras operacionais |
| MP-05 HITL por Classe de Risco | §6 Matriz de Autonomia |
| MP-06 Idempotência por Chave Natural | `fic_boletos.uk (aluno_id, mes_ref)`; webhook `uk (txid, status)` |
| MP-07 Multi-Provider Resilience | §5 Stack (Claude → OpenRouter → Workers AI) |
| MP-08 Audit Log Imutável | `fic_agente_logs` append-only |
| MP-09 Retry com Backoff Exponencial | Trigger.dev jobs (§5) |
| MP-10 Validação em Camadas | Zod + RLS + rate-limit (Art. XIX) |
| MP-11 Rollback Declarativo | Cancelamento de boleto, refund, cancel WhatsApp |
| MP-12 Custo Observável | SC-08 (§ Anexo B) |
| MP-13 Contratos de Dados Versionados | `schemas/fic/v1/*.ts` |

---

### Anexo D — Skills do Skill Registry ↔ Agentes FIC

| Agente FIC | Skills V8.1 primárias | Skills V8.1 secundárias |
|-----------|----------------------|------------------------|
| Emissão de Cobranças | `finance:journal-entry-prep` | `operations:runbook` |
| Cobrança e Renegociação | `finance:reconciliation`, `customer-support:draft-response` | `sales-strategist` |
| Lançamento de Despesas | `finance:journal-entry` | `operations:vendor-review` |
| Conciliação Bancária | `finance:reconciliation` | `data:analyze` |
| Fluxo de Caixa | `finance:variance-analysis` | `data:build-dashboard` |
| Relatórios Financeiros | `finance:financial-statements`, `finance:close-management` | `data:create-viz` |
| Evasão | `data:statistical-analysis`, `edu-management` | `customer-support:draft-response` |
| Regulatório MEC | `operations:compliance-tracking`, `edu-management` | `legal:compliance-check` |
| Atendimento Aluno | `customer-support:draft-response`, `customer-support:ticket-triage` | `edu-management` |
| Conteúdo | `brand-comms`, `marketing:content-creation`, `true-copywriter` | `trend-hunter` |
| Captação | `sales:draft-outreach`, `marketing:campaign-plan` | `apollo:prospect` |
| Diploma Digital | `edu-management`, `legal-docs` | `pdf`, `engineering:documentation` |

---

### Anexo E — Artefatos de documentação exigidos por fase

| Fase | Artefatos obrigatórios | Onde |
|------|----------------------|------|
| 1A Cobranças | Runbook emissão, Política de retry, Test report smoke | `ERP-Educacional/docs/agentes/cobrancas/` |
| 1B WhatsApp | Política de templates, plano de escalonamento, LGPD | `ERP-Educacional/docs/agentes/whatsapp/` |
| 1C Webhook | Verificação HMAC, playbook replay, runbook rollback | `ERP-Educacional/docs/agentes/webhook-inter/` |
| Cada sessão | Arquivo `sessoes/sessao-NNN-YYYY-MM-DD.md` + INSERT ECOSYSTEM | `Ecossistema/memory/sessions/` + Supabase |

---

## 11. Referências

| Documento | Localização |
|----------|------------|
| **Plano-fonte V8.1 Ecossistema** | `PLANO-ECOSSISTEMA-V8-OMEGA-INFINITE-SYNERGY.html` |
| **Resolução de conflitos V8.1 × MASTERPLAN FIC** | `ALINHAMENTO-V8.1-MASTERPLAN-FIC-CONFLITOS-E-RESOLUCAO.md/.html` |
| Sessão 013 (origem do v2.1) | `memory/sessions/sessao-013-2026-04-14.md` |
| Departamento Financeiro (CFO) | `planos/DEPARTAMENTO-FINANCEIRO-v1.md` |
| Sistema de Cobranças v2 (detalhe técnico) | `planos/SISTEMA-COBRANCAS-v2.md` |
| Memória central (cross-project) | `GitHub/CENTRAL-MEMORY.md` |
| Ecossistema doc-mãe | `ECOSSISTEMA-INOVACAO-IA.md` |
| ERP-Educacional (código) | `ERP-Educacional/` |
| Histórico de versões | v1.0 → `masterplans/MASTERPLAN-FIC-MULTIAGENTES-v1.md` · v2.0 → `masterplans/MASTERPLAN-FIC-MULTIAGENTES-v2.md` |

---

## 12. Próximos Passos Imediatos

### Frente FIC (este masterplan)

1. **Sessão 015** — Início Fase 1A (Agente de Emissão de Cobranças): criar migration `fic_alunos`/`fic_boletos`/`fic_agente_logs` no ERP-Educacional, estrutura `ERP-Educacional/api/agentes/cobrancas/emissao.ts`, smoke-test com Banco Inter sandbox.
2. **Sessão 016** — Concluir Fase 1A e iniciar 1B (decisão WhatsApp finalizada + template Meta Business API).
3. **Sessão 017** — Fase 1C (webhook Inter com HMAC + SC-10 hardening).

### Frente Ecossistema (V8.1)

1. **Sessão paralela X1** — Início Onda 1 (Fundação): Claude Agent SDK template, `ecosystem_memory` schema finalizado, webhook hardening base reusável.
2. **Sessão paralela X2** — Onda 2 (Supabase-first · Dual-write): pipeline de replicação crítica ERP→ECOSYSTEM ativado.
3. **Sessão paralela X3** — Onda 3 (Skill Router): SC-05 online, CFO-IA roteando pedidos pelas skills certas.

> **Interlock:** a cada 2 sessões FIC + 2 sessões Ecossistema, Claudinho roda reconciliação entre os dois avanços e atualiza este v2.1 se necessário (pode gerar v2.2, v2.3, etc.).

---

## Histórico de Versões

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0 | 12/04/2026 | Criação — 6 agentes, arquitetura base |
| 2.0 | 12/04/2026 | Nova hierarquia corporativa (CEO → VP → C-Suite), CFO como primeiro diretor, roadmap expandido |
| **2.1** | **14/04/2026** | **Alinhamento V8.1 · P0 preâmbulo + P1 herança (Artigos/MP/SC/Ondas) + P2 IDs Supabase canônicos + P3 cláusula LGPD/FIC + P4 anexos de mapeamento (A Fases↔Ondas, B RACI, C MPs, D Skills, E Artefatos). Sessão 014.** |

---

*Masterplan v2.1 — Sessões 013-014 — Ecossistema de Inovação e IA · FIC como aplicação herdeira do V8.1.*
