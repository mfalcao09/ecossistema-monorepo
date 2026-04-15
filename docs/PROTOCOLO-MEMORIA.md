# PROTOCOLO-MEMORIA.md — Como Atualizar a Memória (Projeto + Central)

> **Regra absoluta:** Ao final de TODA sessão de trabalho, Claude DEVE executar este protocolo.
> Marcelo NUNCA deve precisar pedir para salvar. É automático.
>
> **🔑 PALAVRA-CHAVE DE ENCERRAMENTO: "Vou encerrar"**
> Quando Marcelo disser "vou encerrar" (ou variações como "vou fechar", "vou sair", "encerra"), Claude DEVE IMEDIATAMENTE executar o protocolo completo de salvamento ANTES de se despedir.
>
> **Localização permanente:** `/Users/marcelosilva/Projects/GitHub/PROTOCOLO-MEMORIA.md`
> **Memória central:** `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`
> **Kit de onboarding:** `/Users/marcelosilva/Projects/GitHub/ONBOARDING-KIT.md`

---

## Fluxo: Orient → Work → Persist

> ⚠️ **FASE B ATIVA desde 14/04/2026** — Supabase ECOSYSTEM é a fonte primária.
> `bootstrap_session()` substitui a leitura manual de TRACKER.md como Camada 0.
> Arquivos .md locais são backup de emergência e leitura humana.

```
INÍCIO DA SESSÃO (Orient) — FASE B
│
├── Camada 0 — PRIMÁRIA (OBRIGATÓRIO):
│   └── Chamar bootstrap_session() no Supabase ECOSYSTEM:
│       select bootstrap_session('[tarefa em 1 frase]', '[projeto]', 15);
│       → Retorna feedbacks estruturais + memórias contextuais relevantes
│
├── Camada 0 — FALLBACK (só se Supabase indisponível):
│   ├── Ler memory/TRACKER.md do projeto (~500 tokens)
│   └── Ler sprint ativo em memory/sprints/ (~1.500 tokens)
│
├── Camada 1b (SE segunda/quarta/sexta/domingo — ~800 tokens):
│   └── Ler memory/PENDENCIAS.md (auditoria plano vs execução)
│
├── Camada 2 (SOB DEMANDA — apenas quando necessário):
│   └── preferences.md, architecture.md, patterns.md, debugging.md, etc.
│
├── CENTRAL-MEMORY.md (se houver contexto cross-project relevante)
│
▼
DURANTE A SESSÃO (Work)
│
├── Trabalhar no escopo definido pelo sprint/sessão pré-planejada
├── Se sessão pré-planejada: seguir checklist de entregáveis do sprint
├── Indicar skills/plugins antes de cada tarefa (diretriz obrigatória)
│
▼
FINAL DA SESSÃO (Persist) — 8 passos obrigatórios
│
├── PASSO 0: INSERT no Supabase ECOSYSTEM (PRIORITÁRIO — fazer PRIMEIRO)
│           project='erp' ou 'ecosystem' conforme o projeto da sessão
├── PASSO 1: Salvar sessão individual (com backlinks) em memory/sessions/
├── PASSO 2: Atualizar sprint (marcar itens ✅, registrar sessão)
├── PASSO 3: Atualizar TRACKER.md (%, última sessão, próxima sessão)
├── PASSO 4: Atualizar MEMORY.md (rotacionar últimas 5 decisões)
├── PASSO 5: Atualizar CENTRAL-MEMORY.md
├── PASSO 6: Se escopo da sessão pré-planejada concluiu → indicar próxima
├── PASSO 7: Git commit + push das pastas memory/ (OBRIGATÓRIO — ver §PASSO 7)
```

---

## PASSO 1: Salvar Sessão Individual

Criar arquivo: `memory/sessions/sessao-NNN-YYYY-MM-DD.md`

**Formato com backlinks de rastreabilidade (OBRIGATÓRIO no topo):**
```markdown
# Sessão NNN — Título descritivo

**Rastreabilidade:**
- Masterplan: [nome-do-masterplan]
- Sprint: [N] ([nome]) → Epic [X.Y]
- Plano: sessão pré-definida (item N de M do sprint) OU hotfix/avulsa
- Próxima: [NNN+1] → [escopo]

## O que foi feito
- [lista de entregas/decisões]

## Decisões tomadas
- [decisões técnicas ou estratégicas]

## Entregáveis do Epic (checklist)
- [x] Item concluído
- [ ] Item pendente ← ficou para sessão NNN+1

## Próximos passos
- [o que ficou pendente]

## Skills utilizadas
- [lista de skills/plugins acionados]
```

---

## PASSO 2: Atualizar Sprint

No arquivo `memory/sprints/sprint-N-nome.md`:
- Marcar US/Epic como ✅ se concluído
- Atualizar checklist de entregáveis ([ ] → [x])
- Adicionar sessão na tabela "Sessões Realizadas"
- Atualizar status da sessão pré-planejada (🔲 → ✅)
- Se sprint inteiro concluiu: marcar status como ✅ CONCLUÍDO

---

## PASSO 3: Atualizar TRACKER.md

No arquivo `memory/TRACKER.md`:
- Atualizar % de progresso do sprint
- Atualizar "Últimas 5 Sessões" (rotacionar)
- Atualizar "Próxima sessão"
- Atualizar data de atualização no cabeçalho

---

## PASSO 4: Atualizar MEMORY.md

No arquivo `memory/MEMORY.md`:
- Rotacionar "Decisões Ativas" (últimas 5 — remover a mais antiga)
- Atualizar "Tensões Ativas" se surgiram novas

---

## PASSO 5: Atualizar CENTRAL-MEMORY.md

> **Caminho:** `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`

- Incrementar contador de sessões
- Atualizar status de módulos se mudou
- Atualizar "Próximos passos"
- Adicionar decisão cross-project se aplicável
- Atualizar data no cabeçalho
- **Se a sessão criou ou instalou novas ferramentas (skill, plugin, MCP, IA):** atualizar `INVENTARIO-FERRAMENTAS.md` + commit `docs: update inventario — [nome]`

---

## PASSO 7: Git commit + push — memory/ obrigatório

> **Regra:** TODA sessão termina com git push das pastas `memory/`. Sem isso, o trabalho fica apenas local e pode ser perdido.
> **Automação:** A scheduled task `git-push-memory` (a cada 3h) faz push automático — mas o PASSO 7 ao final de cada sessão é obrigatório como garantia imediata.

### Caminho primário — Desktop Commander (git direto no Mac)

Via `mcp__desktop-commander__start_process`, para cada projeto da sessão:

```bash
# ERP-Educacional
cd /Users/marcelosilva/Projects/GitHub/ERP-Educacional
git add memory/
git diff --staged --quiet || git commit -m "memory: sessão [N] [YYYY-MM-DD]" --author="mfalcao09 <contato@marcelofalcao.imb.br>"
git push origin HEAD

# Ecossistema
cd /Users/marcelosilva/Projects/GitHub/Ecossistema
git add memory/ memory/auto/
git diff --staged --quiet || git commit -m "memory: sessão [N] [YYYY-MM-DD]" --author="mfalcao09 <contato@marcelofalcao.imb.br>"
git push origin HEAD

# intentus-plataform (quando for sessão do Intentus)
cd /Users/marcelosilva/Projects/GitHub/intentus-plataform
git add memory/
git diff --staged --quiet || git commit -m "memory: sessão [N] [YYYY-MM-DD]" --author="mfalcao09 <contato@marcelofalcao.imb.br>"
git push origin HEAD
```

### Caminho fallback — Sandbox Bash + bootstrap auth

Se Desktop Commander não disponível, primeiro rodar bootstrap (ver `bootstrap_git_auth_novo_sandbox.md`), depois:

```bash
SANDBOX_ID=$(pwd | awk -F/ '{print $3}')
TOKEN_FILE="/sessions/${SANDBOX_ID}/mnt/GitHub/.github-token"
git config --global credential.helper "store --file=$TOKEN_FILE"
git config --global user.name "mfalcao09"
git config --global user.email "contato@marcelofalcao.imb.br"

# Repetir o bloco add/commit/push acima usando os caminhos /sessions/${SANDBOX_ID}/mnt/
```

### Regras do PASSO 7

- ✅ Commitar APENAS `memory/` (não código — commits de código seguem o GIT-WORKFLOW-AUTONOMO.md)
- ✅ Usar `git diff --staged --quiet || git commit` — só commita se houver mudanças (evita commits vazios)
- ✅ Incluir `memory/auto/` no commit do Ecossistema (contém sincronização do .auto-memory)
- ❌ NUNCA pular este passo por pressa — é o que garante persistência real

---

## PASSO 6: Sessão Pré-Planejada — Indicar Próxima

Se a sessão fazia parte de um plano de sessões (definido no sprint):
- Confirmar para Marcelo: "Escopo da sessão [N] concluído"
- Indicar próxima sessão: "Próxima: sessão [N+1] → [escopo]"
- Se havia US/Epics que não couberam: registrar como pendência no sprint

---

## Sessões Pré-Planejadas

Dentro de cada arquivo de sprint, existe uma tabela "Plano de Sessões" que define:
- Quais US/Epics cada sessão implementa
- Ordem de execução
- Critério de "done" (checklist de entregáveis)

**Regras:**
- Claude propõe a distribuição, Marcelo SEMPRE aprova antes de iniciar
- Sessão sabe quando acabar (checklist do epic como critério)
- Protocolo de encerramento é automático ao completar escopo
- Sessões avulsas (hotfix, bugfix) marcam `Sprint: N/A (hotfix)` nos backlinks

---

## Automações de Auditoria

| Automação | Frequência | O que faz |
|-----------|------------|-----------|
| `daily-cross-memory-sync` | Diária 5h | Sync dados + atualizar TRACKER |
| `plan-audit` | Dom/Seg/Qua/Sex 9h30 | Cruzar plano×execução → PENDENCIAS.md |
| `weekly-memory-review` | Domingo 13h30 | Limpeza, consolidação, duplicatas |

---

## Quando CRIAR Novo Projeto

### Checklist de Novo Projeto

1. [ ] Ler `ONBOARDING-KIT.md` (de `/Users/marcelosilva/Projects/GitHub/`)
2. [ ] Criar pasta `memory/` com estrutura:
   ```
   memory/
   ├── TRACKER.md          (painel executivo — ponto de entrada)
   ├── MEMORY.md           (roteador — máximo 40 linhas)
   ├── PENDENCIAS.md       (template vazio — preenchido por automação)
   ├── masterplans/        (visão end-to-end de projetos grandes)
   ├── sprints/            (plano + progresso de cada sprint)
   ├── sessions/
   │   ├── SINTESE.md      (referência cronológica)
   │   └── sessao-001.md
   ├── preferences.md
   ├── architecture.md
   ├── patterns.md
   └── debugging.md
   ```
3. [ ] Criar `CLAUDE.md` do projeto
4. [ ] Adicionar na `CENTRAL-MEMORY.md`
5. [ ] Iniciar sessão 001

---

## Regras de Ouro

> **FASE B ativa:** Supabase é primário. INSERT antes dos arquivos locais.

1. **NUNCA** terminar sessão sem executar os 7 passos de Persist (inclui PASSO 0 — Supabase)
2. **NUNCA** criar projeto sem registrar na CENTRAL-MEMORY
3. **SEMPRE** incluir backlinks de rastreabilidade no topo de cada sessão
4. **SEMPRE** chamar `bootstrap_session()` no início de cada sessão (Fase B)
5. **SEMPRE** manter TRACKER.md como fallback quando Supabase indisponível
6. **SEMPRE** manter MEMORY.md abaixo de 40 linhas
7. **SEMPRE** manter CENTRAL-MEMORY abaixo de 300 linhas
8. **SEMPRE** que Claude propor sessões → Marcelo aprova antes de iniciar
9. **SEMPRE** INSERT no Supabase ANTES de salvar arquivos .md locais (Fase B)
10. Boot de sessão Fase B: `bootstrap_session()` = ~800 tokens (mais inteligente que ~2.000)
