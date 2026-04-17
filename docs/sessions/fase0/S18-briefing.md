# S18 — Briefing Marcelo + Demo

**Sessão:** S18 · **Dia:** 4 · **Worktree:** `eco-briefing` · **Branch:** `feature/briefing-fase0`
**Duração estimada:** meio dia (4h)
**Dependências:** ✅ S17 (Validação E2E + relatórios)
**Bloqueia:** início da Fase 1

---

## Leituras obrigatórias

1. `docs/sessions/fase0/VALIDACAO-E2E-RESULTADOS.md` (S17)
2. `docs/sessions/fase0/FASE0-FECHAMENTO.md` (S17)
3. `docs/masterplans/MASTERPLAN-V9.md` — **Parte XIII § 41** (fases)
4. Histórico: todos os commits da Fase 0 (`git log --oneline --since="4 days ago"`)

---

## Objetivo

Produzir **briefing executivo para Marcelo** apresentando o que foi entregue na Fase 0, estado de produção, economias mensais estimadas, débitos para Fase 1, e **demo ao vivo** do piloto CFO-FIC executando régua de cobrança dry-run.

**Audiência:** Marcelo (principal), possíveis convidados (co-founders/diretores humanos que queiram entender).

---

## Escopo exato

```
docs/briefings/
├── FASE0-BRIEFING-MARCELO.md          # doc principal
├── FASE0-BRIEFING-MARCELO.html        # versão web
├── assets/                            # diagramas, screenshots
│   ├── arquitetura-v9.png             # diagrama 4 camadas
│   ├── c-suite-matriz.png             # matriz C-Suite per negócio
│   ├── custo-projetado.png            # gráfico economia mensal
│   └── demo-sequencia.png             # fluxo da demo
└── demo/
    ├── script-demo.md                 # roteiro passo-a-passo
    ├── slides.html                    # se houver apresentação
    └── queries-ensaiadas.md           # queries pra fazer ao vivo
```

---

## Estrutura do briefing (markdown)

```markdown
# Fase 0 Concluída — Ecossistema V9

**Status:** ✅ Fechada | **Data:** 2026-04-{XX} | **Duração:** 4 dias (18 sessões paralelas)

## TL;DR para Marcelo

Em 4 dias, 18 sessões paralelas entregaram a **fundação completa da V9**:

- **Infraestrutura:** 5 serviços Railway + 5 Edge Functions + 4 migrations ECOSYSTEM
- **Packages:** 9 packages reutilizáveis do ecossistema (`@ecossistema/*`)
- **Governança:** 11 Artigos Constitucionais agora são **código que roda**, não só texto
- **Piloto:** CFO-FIC instanciado e validado em sandbox (Inter + Evolution API)
- **Custo estimado:** ~US$ 150-250/mês em infra + ~US$ 100-500 em LLM (per business)

**Próximo passo:** abrir Fase 1 — expandir C-Suite nos 5 negócios + Jarvis Stage 2 (WhatsApp).

---

## O que mudou para você, na prática

### 1. Não vai mais perder memória

Dealbreaker resolvido. `@ecossistema/memory` + pgvector 3-tier + auto-embedding.
Sessão fecha, abre depois, Claudinho já sabe quem você é, o que decidiram, que negócio estão falando.

### 2. Segurança de credenciais

Credenciais (Inter, BRy, OpenRouter) **nunca aparecem em chat** mais.
Novo fluxo: agente precisa → envia link Magic Link pro Marcelo → você cola no browser → cifrado → SC-29 faz call em proxy → agente recebe **só o resultado**, nunca a chave.

### 3. Governança automática

Artigo II (HITL): agente tentou emitir boleto de R$ 15k? **Bloqueado em código**. Chega WhatsApp pra você aprovar.
Artigo XIX (Segurança): agente tentou `rm -rf /`? Bloqueado.
11 Artigos assim, rodando 24/7 sem você pensar nisso.

### 4. Observabilidade real

Todo LLM call, todo tool use, toda decisão do agente registrada em Langfuse.
Dashboard de custo per negócio, alertas quando próximo do budget.
Correlation ID liga: "o que o Claudinho fez na sessão X" → todos os logs em 1 clique.

### 5. Piloto validado

CFO-FIC instanciado. Executou dry-run de régua de cobrança com 5 alunos de teste:
- Checou inadimplentes
- Preparou WhatsApps
- Gravou proposta em memory
- Trace completo em Langfuse
- ✅ Zero credenciais expostas

---

## Arquitetura entregue

![Arquitetura V9](assets/arquitetura-v9.png)

**4 camadas operacionais:**

| Camada | Conteúdo | Tecnologia |
|---|---|---|
| L1 Agentes | Claudinho, CFO-FIC, D-Governanca | Anthropic Managed Agents |
| L2 Serviços | Orchestrator, LiteLLM, Langfuse, Consolidator | Railway |
| L3 Edge Functions | 5 EFs (SC-29 v2, Webhook, PII, Skills, Dual-Write) | Supabase EFs |
| L4 Dados | ECOSYSTEM + ERP-FIC + Intentus + memory 3-tier | Postgres + pgvector + ClickHouse |

---

## O que foi entregue — 18 sessões

| # | Sessão | Entregável | Status |
|---|---|---|---|
| S1 | Constitutional Hooks | 11 hooks executáveis | ✅ |
| S2 | Prompt Assembler | Phantom 9-layer | ✅ |
| S3 | MCP Template | FastMCP scaffold + generator CLI | ✅ |
| S4 | Migrations D1 | 4 migrations ECOSYSTEM + RLS | ✅ |
| S5 | LiteLLM | Proxy Railway + 6 virtual keys | ✅ |
| S6 | ADRs + Runbooks | 15 ADRs + 6 runbooks | ✅ |
| S7 | Memory Package | Mem0 wrapper + 3-tier + hybrid retrieval | ✅ |
| S8 | Edge Functions | 5 EFs (SC-29 v2, SC-10, SC-19, SC-04, SC-03) | ✅ |
| S9 | Langfuse | Self-host Railway (Postgres + ClickHouse) | ✅ |
| S10 | Orchestrator | FastAPI expondo Managed Agents | ✅ |
| S11 | C-Suite Templates | 4 templates (CEO, CFO, D-Gov, Claudinho) + generator | ✅ |
| S12 | Magic Link Vault | AES-256-GCM + Next.js form | ✅ |
| S13 | Clients | credentials + litellm-client + observability | ✅ |
| S14 | Consolidator | Railway worker sleeptime | ✅ |
| S15 | CI/CD | GitHub workflows + testes E2E | ✅ |
| S16 | Piloto CFO-FIC | Agente real + 5 tools + sandbox OK | ✅ |
| S17 | Validação E2E | 10 spec files + relatório | ✅ |
| S18 | Este briefing | — | ✅ |

---

## Números da Fase 0

- **99 repositórios** analisados a fundo (48 no desenvolvimento, 51 catálogo descoberto)
- **~400 KB** de pesquisa consolidada
- **18 sessões** em **4 dias** corridos
- **22 Artigos** Constitucionais preservados + **11 virando hooks**
- **29 Super-Crates** reclassificadas por tecnologia
- **10 padrões** roubados de código real (phantom, Mem0, Letta, FastMCP, etc.)
- **30-35 agentes C-Suite** mapeados para os 5 negócios (6 já com template pronto)
- **6 Diretores de Área** definidos

---

## Economia projetada

### Antes (V8.2 sem implementação)
- Acesso a credenciais manual → tempo Marcelo + risco vazamento
- Memória via `.md` local → perda em toda compactação
- Sem governança executável → agente pode violar Artigos sem detectar
- Sem observability → custos LLM descobertos só na fatura

### Depois (V9 em produção)
| Item | Economia |
|---|---|
| Rotação de credenciais automatizável | ~2h/mês Marcelo |
| Zero perda de memória entre sessões | Dealbreaker resolvido |
| Hooks previnem ações indevidas | Evita pelo menos 1 bug financeiro/mês |
| Budgets per-business + fallbacks | Controle de custo em ~30% |
| Briefing diário consolidado | ~3h/semana Marcelo |

### Custo operacional mensal estimado
| Componente | USD/mês |
|---|---|
| Railway (orchestrator + LiteLLM + Langfuse + consolidator) | 80-120 |
| Supabase ECOSYSTEM (já existente, crescimento marginal) | 25-50 |
| LLMs (com fallbacks Haiku) — 5 businesses em uso leve | 100-500 |
| **Total inicial** | **~US$ 205-670/mês** |

*(Escala conforme tráfego. Com Jarvis Stage 2 ativo e 20-30 agents em uso real, estimamos ~US$ 500-1500/mês estabilizado.)*

---

## Conformidade constitucional executável

11 dos 22 Artigos agora rodam como hooks no Claude Agent SDK:

| Hook | Roda em | Função |
|---|---|---|
| Art. II HITL | PreToolUse | Bloqueia ações > R$10k ou irreversíveis sem você aprovar |
| Art. III Idempotência | PreToolUse | Impede duplicatas em 24h |
| Art. IV Audit | PostToolUse | Grava em audit_log append-only |
| Art. VIII Baixa Real | PostToolUse | Valida sucesso real (não 202 vazio) |
| Art. IX Falha Explícita | PostToolUse | Transforma silent fail em erro |
| Art. XII Custos | PreToolUse | Verifica budget antes de chamada cara |
| Art. XIV Dual-Write | PreToolUse | Intercepta Write em memory/.md e redireciona |
| Art. XVIII Data Contracts | PreToolUse | Valida JSON Schema |
| Art. XIX Segurança | PreToolUse | Bloqueia comandos perigosos |
| Art. XX Soberania | PreToolUse | Prefere Supabase a API externa |
| Art. XXII Aprendizado | SessionEnd | Extrai padrões pra memory |

---

## Débitos identificados (vão para Fase 1)

{extrair de S17 relatório — se houver}

1. Lista os itens concretos
2. Classificados por severity
3. Associados a sessão ou feature owner

---

## Próximas fases

### Fase 1 (semanas 5-8) — Expansão
- **C-Suite completo nos 5 negócios** (~30 agentes)
- **Jarvis Stage 2 (WhatsApp)** via Evolution API + pipecat
- **6 Diretores de Área no ecossistema** (dashboards + auditoria automática)
- **Piloto real** do CFO-FIC em produção (deixar sandbox)
- **SC-29 Modo B** em uso obrigatório para todas integrações externas

### Fase 2 (semanas 9-12) — Jarvis Stage 3 (Voz)
- App Electron/Swift com push-to-talk
- Groq Whisper + ElevenLabs
- livekit/agents runtime
- Briefing diário via voz

### Fase 3 (semanas 13-24) — Jarvis Always-On (Stage 4)
- Wake-word + always-listening
- Proactive triggers
- Ambient agent pattern

---

## Demo ao vivo (10 minutos)

Roteiro em `docs/briefings/demo/script-demo.md`.

**Preparação:** 3 terminais abertos (orchestrator live, langfuse UI, audit log query).

**Sequência:**
1. **"Olá Claudinho, qual a situação da FIC hoje?"** → Claudinho delega para CFO-FIC → responde números reais do sandbox
2. **"Dispare régua de cobrança dry-run"** → CFO-FIC executa → mostra plano
3. **Mostra Langfuse trace** → cada chamada LLM, tool use, custo, latência
4. **Mostra Audit log** → 11 hooks rodando em cada tool
5. **Tentar ação proibida** → "Emita R$ 20.000 em boletos" → **Art. II bloqueia** → aparece pedido de aprovação em WhatsApp (simulado)
6. **Memória em ação** → "Lembra da minha preferência de modelo?" → Claudinho recupera de memory_semantic

---

## Reconhecimentos

A Fase 0 foi construída com evidência real:
- 99 repositórios de código aberto de produção analisados
- Ideias roubadas de: phantom, Mem0, Letta, FastMCP, LiteLLM, Langfuse, pipecat, LiveKit, Chatwoot, Evolution API, Documenso, pyHanko, entre outros
- Muito obrigado pelas comunidades OSS brasileiras: nfephp-org, Tada Software (PyNFe), Maritaca AI, Evolution API

---

## Perguntas que Marcelo deve responder

Para passar para Fase 1:

1. ✅ Aprova o que foi entregue?
2. ✅ Concorda com débitos identificados + prioridade?
3. ✅ Modo de execução Fase 1: continuar 6 sessões paralelas ou balanceado (4)?
4. ✅ Qual negócio prioritário após FIC? (Klésis, Intentus, Splendori, Nexvy?)
5. ✅ Jarvis Stage 2 — pode alocar número WhatsApp dedicado?
6. ✅ Budget LLM mensal — aprovar estimativas por negócio?
7. ✅ **Produção real do CFO-FIC** — quando? (sugestão: semana 5 após burn-in de 1 semana em sandbox)
```

---

## Versão HTML (`FASE0-BRIEFING-MARCELO.html`)

Converter o markdown acima com mesmo estilo da V9 HTML (dark theme, responsivo).

Reaproveitar CSS de `docs/masterplans/MASTERPLAN-V9.html`.

---

## Script da demo (`docs/briefings/demo/script-demo.md`)

```markdown
# Script — Demo Fase 0 para Marcelo

**Duração:** 10 min
**Setup:** 3 abas no browser + 1 terminal

## Abas preparadas

1. Langfuse UI — https://langfuse.ecossistema.internal — filtrado por "cfo-fic"
2. Supabase Studio — audit_log query pronta
3. WhatsApp Web (sandbox) — número teste

## Terminal preparado

```bash
cd ~/Projects/GitHub/ecossistema-monorepo
# Aliases:
alias claudinho="curl -N -X POST https://orchestrator.ecossistema.internal/agents/claudinho/run \
  -H 'Authorization: Bearer \$OWNER_TOKEN' -H 'Content-Type: application/json' -d"
```

## Roteiro

### Cena 1 — Claudinho vivo (2min)

```
claudinho '{"query":"Olá Claudinho, qual a situação financeira da FIC hoje? Resumo em 3 bullets.","user_id":"marcelo"}'
```

Narrar enquanto stream chega:
- "Vejam o `event: handoff` — Claudinho delegou para o CFO-FIC"
- "Agora o CFO-FIC está consultando `check_inadimplentes`"
- "Resposta final consolidada"

### Cena 2 — Dry-run régua (3min)

```
claudinho '{"query":"Peça ao CFO-FIC para fazer dry-run da régua de cobrança para inadimplentes ≥15 dias","user_id":"marcelo"}'
```

Mostrar na tela:
- Eventos SSE em tempo real
- Plano gerado (sem envio real)
- "Zero WhatsApp enviado ainda — dry-run"

### Cena 3 — Langfuse (2min)

Abrir UI Langfuse:
- Filtro por trace_id da última chamada
- Mostrar: 8 spans, 3 generations, custo total USD, latência p95
- Clicar em um span → ver input/output (sem exposição de secrets)

### Cena 4 — Audit log (1min)

Supabase Studio, query:
```sql
select tool_name, action, article_ref, decision, reason, created_at
from audit_log
where trace_id = '<corr_id>'
order by created_at;
```

Mostrar:
- 15+ linhas
- Alguns `decision='allow'`, alguns `article_ref` presente
- Tudo rastreável

### Cena 5 — Governança em ação (2min)

```
claudinho '{"query":"CFO-FIC, emita R$ 20.000 em boletos para os 15 maiores inadimplentes","user_id":"marcelo"}'
```

Mostrar:
- SSE emite `tool_blocked` com `reason: "Art. II: Valor R$20000 > limite R$10000..."`
- `approval_request_created`
- WhatsApp chega no número do Marcelo: "🔔 Aprovação solicitada..."

### Cena 6 — Memória (1min)

Após alguns ping-pongs, mostrar em Supabase Studio:
```sql
select content, importance, created_at
from memory_semantic
where user_id = 'marcelo' and agent_id = 'cfo-fic'
order by created_at desc limit 5;
```

Destacar: "Na próxima sessão, Claudinho começa com esse contexto."

## Fechamento

"Isso tudo está em produção agora. A Fase 1 vai expandir para os outros 4 negócios + trazer o Jarvis pro WhatsApp."

## Perguntas antecipadas

- **"E se o Railway cair?"** → D-Infra vai alertar; temos fallback LiteLLM para providers diretos; Supabase continua
- **"Custo se ficar em 5k/mês?"** → Budget per-business bloqueia; fallback pra Haiku (10x mais barato) automático
- **"E um agente sair do script?"** → 11 hooks constitucionais; audit log imutável; D-Governanca audita diariamente
```

---

## Critério de sucesso

- [ ] `FASE0-BRIEFING-MARCELO.md` (~2-3 páginas visuais)
- [ ] `FASE0-BRIEFING-MARCELO.html` (versão web pronta)
- [ ] `script-demo.md` detalhado
- [ ] Queries de demo ensaiadas e testadas
- [ ] Diagramas salvos em `assets/` (gerar via Mermaid ou exportar de tool)
- [ ] Marcelo recebe briefing por WhatsApp + email com link ao HTML
- [ ] Demo ao vivo executada (pode ser gravada)
- [ ] Commit: `docs(briefing): Fase 0 entregue — briefing + demo ao vivo`

---

## Handoff

- **Marcelo** aprova abertura da Fase 1
- Débitos identificados viram primeiros items do backlog Fase 1
- Sessão A da Fase 1: Jarvis Stage 2 (WhatsApp) — prioritária

---

**Última sessão da Fase 0. O ecossistema sai do papel. Capriche na comunicação.**
