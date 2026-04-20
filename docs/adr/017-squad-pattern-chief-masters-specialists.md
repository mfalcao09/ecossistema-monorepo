# ADR-017: Squad Pattern — Chief / Masters / Specialists no c-suite-templates

- **Status:** aceito
- **Data:** 2026-04-20
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** ADR-010 (C-Suite per negócio), MASTERPLAN-V9 § Parte VI §16, análise aiox-squads em `docs/research/`

## Contexto e problema

A V9 (ADR-010) define C-Suite per negócio + 6 Diretores de Área. O package `@ecossistema/c-suite-templates` (S11) implementou o **Chief** de cada C-level via `base-prompt.md` + `evolved-config-seed/` + `variants/` + `skills.yaml` + `hooks.ts`.

Três lacunas apareceram ao preparar o piloto CFO-FIC (S16):

1. **Sem subpersonas (tier 1).** O Chief carrega todo o escopo do C-level (FP&A + fiscal + execução bancária) num único prompt. Fica denso, difícil de evoluir partes independentes, e atropela especialização.
2. **Sem tasks atômicas.** Ações recorrentes (fechamento mensal, apuração de tributos, régua de cobrança) vivem espalhadas em skills e hooks — não há artefato reutilizável "uma tarefa, um arquivo".
3. **Sem workflows multi-agente.** Orquestração entre Chief e agentes especializados vive só em `hooks.ts` imperativo, sem manifesto YAML declarativo legível por humano e validável por schema.

Análise do repo `SynkraAI/aiox-squads` (benchmark, padrão MIT-style mas licença ausente no repo) mostrou padrão maduro: **Chief (tier 0) → Masters (tier 1) → Specialists (tier 2)** com `tasks/*.md`, `workflows/*.yaml`, `checklists/*.md` como subdirs irmãos.

## Opções consideradas

- **Opção A:** Extender `templates/c-suite/{ROLE}-IA/` com novos subdirs (`masters/`, `tasks/`, `workflows/`, `checklists/`). Additive. Zero impacto em CEO-IA/CFO-IA/D-Governanca já existentes.
- **Opção B:** Criar package novo `@ecossistema/squads` com schema próprio inspirado em aiox (`squad.yaml` + `config.yaml` + `agents/*.md`), duplicando o que `c-suite-templates` já resolve para o Chief.
- **Opção C:** Manter status quo. Tudo embutido no `base-prompt.md` e `hooks.ts`.

## Critérios de decisão

- Conflito com S11 (já em produção)
- Custo em LOC para habilitar o piloto CFO-FIC (S16 — seg 21/04)
- Reversibilidade
- Coerência com ADR-010 e MASTERPLAN-V9
- Extensibilidade para squads **não-C-Suite** no futuro (ex: squad compliance-LGPD cross-business)

## Decisão

**Escolhemos Opção A.**

Extender a convenção existente de `c-suite-templates` com quatro subdirs opcionais por template de role:

```
templates/c-suite/{ROLE}-IA/
├── base-prompt.md            ← (já existia) Chief tier 0
├── evolved-config-seed/      ← (já existia)
├── variants/                 ← (já existia)
├── skills.yaml               ← (já existia)
├── hooks.ts                  ← (já existia)
├── masters/       (NEW)      ← tier 1 subpersonas (1 .md por master)
├── tasks/         (NEW)      ← ações atômicas reutilizáveis
├── workflows/     (NEW)      ← pipelines multi-agente em YAML
└── checklists/    (NEW)      ← quality gates (ex: bam-alignment)
```

A camada **specialist (tier 2)** permanece no `task-registry` existente — não precisa duplicar em cada template. Executores (Inter API, PyNFe, BRy) continuam onde estão, invocados pelas tasks.

**Plano B (package `@ecossistema/squads`) fica arquivado como expansão futura** para quando aparecer o primeiro squad **não-mapeável em 1 C-level** (ex: squad jurídico cross-business, squad onboarding de aluno). Até lá, Opção A basta.

## Consequências

### Positivas
- S16 (piloto CFO-FIC seg 21/04) destravado — começa com `masters/fpa.md`, `masters/tax.md`, `tasks/close-month.md`, `workflows/wf-monthly-close.yaml`, `checklists/bam-alignment.md` já no repo
- Zero migração — CEO-IA e D-Governanca continuam funcionando sem mudança
- Tasks e workflows ganham formato auditável e versionável em YAML/MD
- `bam-alignment.md` formaliza o tripé (Viabilidade/Impacto/Propósito) como quality gate invocável
- Masters podem ser instanciados por CFO-FIC, CFO-Intentus etc. com variant próprio (mesmo padrão dos chiefs)

### Negativas
- `instantiator.ts` precisa estender para copiar os 4 novos subdirs para `apps/{business}/agents/{role}/` (~50 LOC — ver ação 2)
- Duas formas de "orquestração": `hooks.ts` imperativo (já existente, para artigos constitucionais) e `workflows/*.yaml` declarativo (novo, para fluxos de negócio). Risco de confusão — mitigado no README do package.
- Masters/tasks/workflows/checklists são **opcionais** — roles que não precisam (ex: D-Governanca hoje) podem omitir. Risco de divergência de maturidade entre templates.

### Neutras / riscos
- **Risco:** padrão AIOX evolui e divergimos em convenções nominais. **Mitigação:** AIOX é referência, não dependência. Schema nosso independe — sem imports, sem fork.
- **Risco:** workflow YAML vira linguagem própria inventada sem runtime claro. **Mitigação:** por enquanto é manifesto declarativo consumido pelo `instantiator` + Claudinho. Se Trigger.dev entrar (D4), mapear para sua DSL.

## Evidência / pesquisa

- Análise completa aiox-squads em agente de investigação (2026-04-20)
- `packages/c-suite-templates/templates/c-suite/CFO-IA/` estado atual (S11)
- Memória project `project_fase0_debitos_s17.md` (D-002 = piloto CFO-FIC pendente seg 21/04)

## Ação de implementação

1. ✅ Criar `masters/fpa.md` + `masters/tax.md` no template CFO-IA (genéricos, variant-agnostic)
2. ⏳ Estender `packages/c-suite-templates/src/instantiator.ts` para copiar novos subdirs em `apps/{business}/agents/{role}/` → pendência P-009
3. ✅ Criar `tasks/close-month.md` + `workflows/wf-monthly-close.yaml` + `checklists/bam-alignment.md`
4. ⏳ Atualizar `packages/c-suite-templates/README.md` com seção "Masters, Tasks, Workflows, Checklists"
5. ⏳ S16 (seg 21/04) — piloto CFO-FIC consome os 4 artefatos
6. ⏳ Replicar padrão em CEO-IA e D-Governanca quando houver demanda real (não especular)

## Revisão

Revisar quando:
- 3º squad (não-C-Suite) aparecer → reavaliar Plano B (package `@ecossistema/squads` genérico)
- Trigger.dev entrar em produção (D4) → avaliar migrar `workflows/*.yaml` para DSL do Trigger.dev
