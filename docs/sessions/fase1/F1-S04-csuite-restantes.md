# F1-S04 — C-Suite Restantes: CSO, CLO, COO, CAO

**Sessão:** F1-S04 · **Fase:** 1 · **Branch:** `feature/f1-s04-csuite-restantes`
**Duração estimada:** 1 dia (6–8h)
**Dependências:** S11 (CEO-IA + CFO-IA como referência ✅), S02 (prompt-assembler ✅), ADR-019 (squad pattern ✅)
**Bloqueia:** Fase 2 (expand C-Suite para os outros 4 negócios)

---

## Leituras obrigatórias

1. `CLAUDE.md` + `MEMORY.md`
2. `packages/c-suite-templates/templates/c-suite/CFO-IA/` — template canônico
3. `packages/c-suite-templates/templates/c-suite/CEO-IA/` — segundo template de referência
4. `docs/adr/019-squad-pattern-chief-masters-specialists.md` — padrão de squad (Chief/Masters/Specialists)
5. `apps/fic/agents/cfo/agent.config.yaml` — padrão de instanciação

---

## Objetivo

Criar os 4 templates C-Suite ausentes seguindo **exatamente** o padrão do CFO-IA (incluindo squad pattern do ADR-019) e instanciar todos no FIC. Ao final, FIC terá 6 agentes C-Suite completos.

### Os 4 templates

| Sigla      | Nome                       | Responsabilidades no negócio educacional                             |
| ---------- | -------------------------- | -------------------------------------------------------------------- |
| **CSO-IA** | Diretor Comercial e Social | Captação de alunos, funil de matrículas, marketing, redes, parceiros |
| **CLO-IA** | Diretor Jurídico           | Contratos, MEC, LGPD, compliance, sindicatos, contencioso            |
| **COO-IA** | Diretor de Operações       | Calendário acadêmico, coordenação pedagógica, facilities, NPS        |
| **CAO-IA** | Diretor Administrativo     | RH, folha, fornecedores, contratos operacionais, facilities          |

> **CFO ≠ CAO:** CFO = finanças (Inter, boletos, inadimplência, DRE). CAO = administrativo (pessoal, fornecedores, contratos). Roles separados.

---

## Estrutura de cada template (igual CFO-IA)

```
packages/c-suite-templates/templates/c-suite/{ROLE}-IA/
├── base-prompt.md              # Persona + responsabilidades + regras constitucionais
├── hooks.ts                    # createConstitutionalHooks com thresholds do papel
├── skills.yaml                 # 5-8 skills específicas do papel
├── variants/
│   └── educacao.md             # Especialização para IES/ensino básico
├── evolved-config-seed/
│   ├── persona.md
│   ├── user-profile.md
│   └── strategies/
│       ├── task-patterns.md
│       ├── tool-preferences.md
│       └── error-recovery.md
├── masters/                    # ADR-019 squad pattern
│   └── {especialidade}.md
├── tasks/
│   └── {task-recorrente}.md
├── workflows/
│   └── wf-{fluxo-principal}.yaml
└── checklists/
    └── bam-alignment.md        # Checklist BAM (igual ao CFO-IA)
```

---

## Instâncias FIC

```
apps/fic/agents/
├── cso/
│   ├── agent.config.yaml       # role: cso, business_id: fic, variant: educacao
│   ├── variant.md              # Customizações FIC (cursos, público-alvo, WABA FIC)
│   └── evolved-config/         # Pasta vazia + .gitkeep
├── clo/
├── coo/
└── cao/
```

`agent.config.yaml` segue exatamente o padrão de `apps/fic/agents/cfo/agent.config.yaml`.

---

## Conteúdo dos base-prompt.md

Cada prompt deve cobrir:

1. **Identidade** — nome, papel, empresa FIC, cosmovisão BAM
2. **Responsabilidades** — 6-8 bullet points específicos do papel
3. **Ferramentas** — lista de skills e gatilhos de uso
4. **Constituição** — Art.II HITL para ações irreversíveis, Art.XII budget, Art.XIX SC-29
5. **Relacionamento** — como se reporta ao CEO-IA e colabora com os outros diretores
6. **Formato** — objetivo, com evidência antes de recomendação, resumo executivo no topo

### CSO-IA skills esperadas

- `lead_capture` — capturar lead de landing page / WABA
- `matricula_pipeline` — gerenciar pipeline S4 (ERP)
- `campanha_sms_waba` — disparar campanha via templates WABA aprovados
- `relatorio_captacao` — gerar relatório de conversão funil

### CLO-IA skills esperadas

- `revisar_contrato` — analisar contrato e sugerir alterações
- `compliance_mec` — checklist de obrigações MEC
- `alerta_lgpd` — verificar conformidade LGPD em processo
- `busca_jurisprudencia` — consultar banco de jurisprudência interno

### COO-IA skills esperadas

- `calendario_academico` — gerar/consultar calendário
- `alocacao_sala` — gerenciar alocação de espaços
- `nps_aluno` — coletar e analisar NPS de alunos
- `retencao_aluno` — trigger de ação para aluno em risco

### CAO-IA skills esperadas

- `folha_pagamento_preview` — pré-visualizar folha antes do fechamento
- `fornecedor_crud` — cadastrar/atualizar fornecedor
- `contrato_rh` — emitir contrato de trabalho padrão
- `relatorio_headcount` — relatório de quadro de pessoal

---

## hooks.ts padrão (adaptar por role)

```typescript
import { createConstitutionalHooks } from "@ecossistema/constitutional-hooks";

export const hooks = createConstitutionalHooks({
  agentId: "cso-fic", // ajustar por instância
  artII: {
    // Ações que requerem HITL antes de executar
    blockedTools: ["disparar_campanha_em_massa", "enviar_email_lista"],
    financialThreshold: 5000, // R$ — CSO: campanhas acima disso precisam HITL
  },
  artXII: {
    dailyBudgetLimit: 500, // USD
  },
});
```

---

## Validação pós-criação

```bash
# Testar que o generator CLI funciona para os novos roles
pnpm --filter @ecossistema/c-suite-templates build
node packages/c-suite-templates/bin/create-csuite-agent.js --business klesis --role cso
# → deve gerar apps/klesis/agents/cso/ sem erro
```

---

## Critério de sucesso

- [ ] 4 templates em `packages/c-suite-templates/templates/c-suite/`
- [ ] 4 instâncias FIC em `apps/fic/agents/`
- [ ] Cada template tem squad pattern completo (masters/ + tasks/ + workflows/ + checklists/)
- [ ] `create-csuite-agent --role cso/clo/coo/cao` gera estrutura válida
- [ ] CI verde (`pnpm --filter @ecossistema/c-suite-templates build`)
- [ ] Commit: `feat(csuite): 4 templates CSO/CLO/COO/CAO + instâncias FIC + squad pattern [F1-S04]`

---

## Handoff

- Fase 2 replica cada template para Klésis, Splendori, Intentus, Nexvy com `variant.md` específica
- P-113: `instantiator.ts` precisa ser estendido para copiar `masters/tasks/workflows/checklists/` (hoje copia só chief + variants)
