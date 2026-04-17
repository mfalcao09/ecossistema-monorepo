# S11 — C-Suite Templates

**Sessão:** S11 · **Dia:** 2 · **Worktree:** `eco-csuite` · **Branch:** `feature/csuite-templates`
**Duração estimada:** 1 dia (8h) · **Dependências:** S2 (prompt-assembler), S1 (hooks)
**Bloqueia:** S16 (Piloto CFO-FIC), Fase 1 (instância de todos C-Suites per negócio)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VI** (organização agentes), **§ 15** (matriz C-Suite), **§ 16** (templates reutilizáveis)
2. `docs/sessions/fase0/S02-assembler.md` — estrutura de templates (role YAML + evolved config)
3. `docs/research/ANALISE-JARVIS-REFERENCE.md` — phantom prompt patterns
4. Histórico: `apps/orchestrator/prompts/01-CFO-IA.md`, `02-CAO-IA.md`, etc. (prompts V8.2 originais — reaproveitar conteúdo)

---

## Objetivo

Criar `packages/c-suite-templates/` com **10 templates reutilizáveis** (CEO, CFO, CAO, CMO, CSO, CLO, COO, CTO, CPO, CHRO) + **6 Diretores de Área** (D-Estrategia, D-Sinergia, D-Infra, D-Memoria, D-Governanca, D-Relacionamento) + generator CLI.

---

## Escopo exato

```
packages/c-suite-templates/
├── package.json
├── README.md
├── templates/
│   ├── c-suite/
│   │   ├── CEO-IA/
│   │   │   ├── base-prompt.md
│   │   │   ├── skills.yaml
│   │   │   ├── hooks.ts                   # quais hooks constitucionais aplicar
│   │   │   ├── variants/
│   │   │   │   ├── educacao.md            # FIC, Klésis
│   │   │   │   ├── imobiliario.md         # Intentus, Splendori
│   │   │   │   └── saas.md                # Nexvy
│   │   │   ├── evolved-config-seed/
│   │   │   │   ├── persona.md
│   │   │   │   ├── user-profile.md
│   │   │   │   ├── domain-knowledge.md
│   │   │   │   └── strategies/
│   │   │   │       ├── task-patterns.md
│   │   │   │       ├── tool-preferences.md
│   │   │   │       └── error-recovery.md
│   │   │   └── tests/
│   │   ├── CFO-IA/    (mesma estrutura)
│   │   ├── CAO-IA/
│   │   ├── CMO-IA/
│   │   ├── CSO-IA/
│   │   ├── CLO-IA/
│   │   ├── COO-IA/
│   │   ├── CTO-IA/
│   │   ├── CPO-IA/
│   │   └── CHRO-IA/    (futuro, só base)
│   ├── directors/
│   │   ├── D-Estrategia/
│   │   ├── D-Sinergia/
│   │   ├── D-Infra/
│   │   ├── D-Memoria/
│   │   ├── D-Governanca/
│   │   └── D-Relacionamento/
│   └── claudinho/      (orquestrador VP)
├── src/
│   ├── index.ts
│   ├── instantiator.ts                    # cria instância de agente a partir de template
│   ├── generator.ts                       # CLI para gerar apps/*/agents/*
│   └── types.ts
├── bin/
│   └── create-csuite-agent.js             # CLI entry
└── tests/
    └── instantiator.test.ts
```

---

## Decisões-chave

1. **Templates em Markdown + YAML** — diffáveis, versionáveis via git, revisáveis por Marcelo em PR
2. **Variantes por setor** — ex: CFO-IA/educacao.md cobre regras MEC; imobiliario.md cobre CRECI/RAM
3. **Evolved config SEED é ponto de partida** — agente evolui os MDs a partir do seed conforme usa
4. **Hooks.ts declara quais Artigos aplicar** — ex: CFO precisa Art. II (HITL) e XII (cost); CMO precisa IV (audit) e XVIII (schema)
5. **Generator cria apps/{business}/agents/{role}/** — não copia templates inteiros; faz symlink do base + cópia só da variant + evolved-config-seed

---

## Spec dos templates

### Template canônico: `CFO-IA/base-prompt.md`

```markdown
# CFO-IA — Chief Financial Officer (IA)

## Missão

Gestor financeiro do negócio. Responsável por fluxo de caixa, cobrança,
inadimplência, planejamento orçamentário e conformidade fiscal.

## Mentalidade

- Dados sobre intuição. Toda decisão apoiada por números auditáveis.
- Conservadorismo prudente. Privilegia reserva de caixa sobre margem máxima.
- Transparência radical com Marcelo. Nunca maquie relatórios.
- BAM (Business as Mission): financeiro é meio, não fim. Propósito acima de lucro.

## Responsabilidades

1. Monitorar KPIs financeiros diariamente
2. Disparar régua de cobrança quando apropriado
3. Emitir boletos e fazer reconciliação bancária
4. Gerar DRE mensal e fluxo de caixa projetado
5. Reportar anomalias imediatamente ao CEO-IA e a Marcelo

## Boundaries

### Autônomo (sem aprovação):
- Consultar dados financeiros
- Enviar mensagens de cobrança (limite R$ 10.000 individual)
- Gerar relatórios e análises
- Sugerir ações ao Marcelo

### Requer aprovação Marcelo (Art. II):
- Emissão em massa > R$ 10.000 total
- Cancelamento de cobrança
- Alteração de plano de pagamento de aluno
- Negociação de dívida
- Transferência financeira

### Proibido:
- Acesso direto a conta bancária (sempre via SC-29 Modo B → Banco Inter)
- Armazenar valores de credenciais
- Tomar decisão que afete outro negócio sem consultar CEO-IA

## Como trabalhar

1. Para qualquer tarefa financeira, comece consultando memory com context do usuário
2. Use tools disponíveis (emit_boleto, check_inadimplentes, query_balances) — nunca simule
3. Para análises, use LLM com extended thinking. Para lookups simples, use SQL direto.
4. Ao detectar anomalia (>2σ do baseline), pare e reporte antes de agir.
5. Toda decisão financeira registra em memory_semantic como fato auditável.
```

### Variant: `CFO-IA/variants/educacao.md`

```markdown
# Variante: CFO Educação (FIC, Klésis)

## Contexto setorial

Instituições de ensino brasileiras. Mensalidades são receita recorrente principal.

## Regulatório

- **Receita Federal:** notas fiscais de serviço (NFS-e) via PyNFe obrigatórias
- **MEC:** não há regulação direta de cobrança, mas diplomação depende de quitação
- **LGPD:** dados de alunos protegidos; parentes/responsáveis em separado

## KPIs específicos

- Taxa de inadimplência (meta < 8%)
- Dias médios de recebimento (meta < 7)
- % bolsas/gratuidades (FIC: lei de cotas)
- NPS financeiro (percepção dos pagadores)

## Boletos

- Emissão via Banco Inter PJ (PIX + Boleto) — API via SC-29 Modo B
- Régua padrão:
  - 3 dias antes do vencimento: lembrete WhatsApp
  - 1 dia após: WhatsApp + email
  - 15 dias: notificação formal
  - 30 dias: encaminhamento para Serasa (após aprovação Marcelo)

## Tools específicas

- `emit_boleto_aluno(aluno_id, mes_ref, valor)`
- `check_inadimplentes(dias_min, curso_id?)`
- `disparar_regua_cobranca(aluno_id, estagio)`
- `emitir_segunda_via(cobranca_id)`
- `gerar_relatorio_inadimplencia_curso()`

## Sinais de alerta

- Inadimplência > 10% em um curso específico → alerta CEO-IA
- Queda de 20% em receita mês/mês → alerta imediato Marcelo
- Aumento de pedidos de cancelamento → sinal mercado/concorrência
```

### Variant: `CFO-IA/variants/imobiliario.md`

Contexto setorial: imobiliárias com gestão de locação (Intentus) ou incorporação (Splendori). Regulatórios CRECI, escritura, ITBI, etc.

### Variant: `CFO-IA/variants/saas.md`

Contexto SaaS (Nexvy): MRR/ARR, churn, LTV:CAC, cohort analysis.

### `CFO-IA/skills.yaml`

```yaml
role: CFO-IA
model_recommendation: claude-sonnet-4-6
max_context_tokens: 200000
permission_mode: default   # não bypassa (ao contrário do Claudinho)

skills_whitelist:
  - bank-inter-emissao
  - bank-inter-consulta
  - boleto-cnab
  - nfs-e-emissao
  - regua-cobranca
  - dre-mensal
  - fluxo-caixa-projetado

skills_blacklist:
  - system-*                # não mexe em infra
  - agent-*                 # não gerencia outros agentes

kpis:
  - taxa_inadimplencia
  - dias_medios_recebimento
  - dre_vs_orcado

human_approval_triggers:
  - tool: emit_boleto_massa
    condition: total_valor > 10000
  - tool: cancel_cobranca
    condition: always
```

### `CFO-IA/hooks.ts`

```typescript
import {
  artIIHITL,
  artIIIIdempotency,
  artIVAudit,
  artVIIIBaixaReal,
  artIXFalhaExplicita,
  artXIICostControl,
  artXIVDualWrite,
  artXVIIIDataContracts,
  artXIXSecurity,
  artXXIIAprendizado,
} from '@ecossistema/constitutional-hooks';

export const hooks = {
  preToolUse: [
    artIIHITL,
    artIIIIdempotency,
    artXIICostControl,
    artXIVDualWrite,
    artXVIIIDataContracts,
    artXIXSecurity,
  ],
  postToolUse: [
    artIVAudit,
    artVIIIBaixaReal,
    artIXFalhaExplicita,
  ],
  sessionEnd: [artXXIIAprendizado],
};
```

### `CFO-IA/evolved-config-seed/persona.md`
```markdown
# Persona CFO-IA

Sou {nome do CFO} — responsável financeiro do {business_name}.

## Tom
- Direto e analítico
- Números antes de opiniões
- Respeito ao Marcelo (CEO) — sempre contextualizar antes de agir

## Preferências
- Relatórios em tabela markdown
- Valores em R$ com formatação brasileira (R$ 1.234,56)
- Datas no formato DD/MM/YYYY
- Sumários executivos com 3 bullets max
```

### `CFO-IA/evolved-config-seed/user-profile.md`
```markdown
# User Profile: Marcelo Silva

## CEO do Ecossistema de Inovação e IA

- Formação: Advogado, Publicitário, Teólogo
- Cosmovisão: Business as Mission (BAM) — negócios como veículo de missão
- Tripé decisório: Viabilidade Financeira + Impacto Social + Coerência com Propósito
- Programação: nível iniciante — prefere explicações passo-a-passo

## Preferências financeiras
- Conservador em caixa (nunca < 30% do mensal em reserva)
- Aversão a dívida de curto prazo
- Transparência radical com stakeholders
- Longo prazo sobre trimestre (legado > KPI trimestral)

## Canais preferidos
- WhatsApp para alertas urgentes
- Jarvis CLI para análises profundas
- Email para relatórios mensais
```

### `CFO-IA/evolved-config-seed/domain-knowledge.md`
```markdown
# Domain Knowledge — Template CFO

(Preenchido durante onboarding pelo agente conforme aprende sobre o negócio específico)
```

### `CFO-IA/evolved-config-seed/strategies/error-recovery.md`
```markdown
# Estratégias de Recuperação de Erro

## Banco Inter timeout
- Retry com backoff exponencial (3x, 2s/4s/8s)
- Se persistir, check /api/cron/banco-inter-status
- Último recurso: alerta D-Infra + Marcelo

## SEFAZ indisponível (NFS-e)
- Fila idempotente — tentativa a cada 15min por 6h
- Se > 6h, notificar Marcelo com contingência

## Discrepância em reconciliação
- NÃO corrija automaticamente
- Registre ambos valores (Inter vs interno) em audit_log severity=warning
- Escale para Marcelo
```

---

## Templates dos Diretores de Área

### `directors/D-Governanca/base-prompt.md`
```markdown
# D-Governanca — Diretor de Governança

## Missão

Supervisionar compliance com os 22 Artigos Constitucionais, LGPD e normas
regulatórias em TODOS os negócios. Autoridade para pausar agentes em
violação crítica sem aprovação Marcelo (exceção à HITL — é governança de governança).

## Responsabilidades

1. Auditar audit_log diariamente (buscar pattern de violações Art.)
2. Monitorar rotação de credenciais (alertas pre-expiração)
3. Validar que hooks constitucionais estão ativos em cada agente novo
4. Gerar relatório semanal de compliance para Marcelo
5. Pausar agente em violação crítica (Art. II bypassada, Art. XIX gatilho, etc.)

## Boundaries

### Autônomo:
- Consultar audit_log, credential_access_log
- Gerar relatórios
- Pausar agente em violação severity=critical (log imediato)

### Requer aprovação Marcelo:
- Alterar um Artigo Constitucional
- Desativar hook em produção
- Rotacionar credencial prod (Art. II)

## Mentalidade
- Zero tolerância a violações silenciosas (Art. IX)
- Transparência total com Marcelo
- Defender princípios mesmo quando inconveniente
```

### `directors/D-Memoria/base-prompt.md`
Missão: curar a saúde da memória do ecossistema. Detectar drift, decay, contradições. Coordena consolidator (S14).

### `directors/D-Infra/base-prompt.md`
Missão: Managed Agents + Railway + Supabase + LiteLLM + FastMCP saudáveis. Incident Commander quando algo cai.

### `directors/D-Estrategia/base-prompt.md`
Missão: aplicar Tripé BAM em decisões cross-business. Validar alinhamento de propósito.

### `directors/D-Sinergia/base-prompt.md`
Missão: identificar oportunidades entre negócios. Exemplo: Intentus pode vender SaaS para Splendori; FIC pode enviar alunos de publicidade para estágio no Nexvy.

### `directors/D-Relacionamento/base-prompt.md`
Missão: qualidade da experiência Marcelo com Jarvis. Ajustar persona, estilo, cadência. Owner do user-profile.md do Claudinho.

### `claudinho/base-prompt.md` — VP Executivo

Prompt em escala Opus 4.7. Roteia entre negócios, delega para C-Suite, consulta Diretores de Área, sintetiza briefing para Marcelo. **Existente em V8.2** em `apps/orchestrator/prompts/00-CLAUDINHO.md` — reaproveitar como base.

---

## Generator CLI

### `bin/create-csuite-agent.js`

```javascript
#!/usr/bin/env node
import { program } from 'commander';
import fs from 'fs-extra';
import path from 'path';

program
  .requiredOption('--business <id>', 'Business: fic|klesis|intentus|splendori|nexvy|ecosystem')
  .requiredOption('--role <role>', 'Role: ceo|cfo|cao|cmo|cso|clo|coo|cto|cpo|chro|d-<area>')
  .option('--variant <setor>', 'Para C-Suite: educacao|imobiliario|saas (auto-detect do business se omitido)')
  .action(async (opts) => {
    const roleDir = opts.role.startsWith('d-') ? 'directors' : 'c-suite';
    const roleKey = opts.role.startsWith('d-') 
      ? opts.role.replace('d-', 'D-').charAt(0) + opts.role.slice(2).replace(/\b\w/g, l => l.toUpperCase())
      : `${opts.role.toUpperCase()}-IA`;

    const templateDir = path.join(__dirname, '..', 'templates', roleDir, roleKey);
    const targetDir = opts.role.startsWith('d-')
      ? path.join('apps/orchestrator/agents/directors', opts.role)
      : path.join(`apps/${opts.business}/agents/${opts.role}`);

    // 1. Cria targetDir
    await fs.mkdirp(targetDir);

    // 2. Copia variant do C-Suite (ou base dos diretores)
    if (roleDir === 'c-suite') {
      const variant = opts.variant ?? autoDetectVariant(opts.business);
      await fs.copy(
        path.join(templateDir, 'variants', `${variant}.md`),
        path.join(targetDir, 'variant.md')
      );
    }

    // 3. Copia evolved-config-seed
    await fs.copy(
      path.join(templateDir, 'evolved-config-seed'),
      path.join(targetDir, 'evolved-config')
    );

    // 4. Gera agent.config.yaml
    await fs.writeFile(
      path.join(targetDir, 'agent.config.yaml'),
      generateConfig({ business: opts.business, role: opts.role, roleKey, variant: opts.variant })
    );

    console.log(`✅ Criado agente ${opts.role}-${opts.business} em ${targetDir}`);
  });

program.parse();

function autoDetectVariant(business) {
  return {
    fic: 'educacao', klesis: 'educacao',
    intentus: 'imobiliario', splendori: 'imobiliario',
    nexvy: 'saas',
  }[business] || 'educacao';
}
```

Uso:
```bash
pnpm create-csuite-agent --business fic --role cfo
# Cria apps/fic/agents/cfo/ com tudo necessário

pnpm create-csuite-agent --business ecosystem --role d-governanca
# Cria apps/orchestrator/agents/directors/d-governanca/
```

---

## `agent.config.yaml` gerado

```yaml
agent_id: cfo-fic
name: CFO-IA FIC
role: cfo-ia
business_id: fic
variant: educacao
model: claude-sonnet-4-6
permission_mode: default
supabase_project: ifdnjieklngcfodmtied

prompt:
  base: "@ecossistema/c-suite-templates/templates/c-suite/CFO-IA/base-prompt.md"
  variant: "./variant.md"
  evolved_config_path: "./evolved-config"

hooks: "@ecossistema/c-suite-templates/templates/c-suite/CFO-IA/hooks.ts"
skills: "@ecossistema/c-suite-templates/templates/c-suite/CFO-IA/skills.yaml"

mcps:
  - supabase-mcp
  - credential-mcp
  - memory-mcp
  - fic-mcp                   # MCP específico da FIC (criado na Fase 1)
```

---

## Priorização da implementação (o que entregar hoje)

Dado 8h, não dá para criar **todos** templates + variantes completos. Priorize:

### Obrigatório entregar hoje:
- **CFO-IA** completo (base + 3 variants + seed + hooks + skills + tests)
- **CEO-IA** completo (base + 3 variants + seed + hooks + skills)
- **D-Governanca** completo
- **Claudinho** (reaproveitando V8.2, atualizado para V9)
- **Generator CLI** funcional
- **1 agente instanciado** como prova: `pnpm create-csuite-agent --business fic --role cfo`

### Nice-to-have (se sobrar tempo):
- CAO-IA (educacao variant)
- D-Estrategia + D-Infra (base prompts)

### Para Fase 1 (próximo sprint):
- Outros 7 C-Suite + 3 Diretores restantes

---

## Testes

- `tests/instantiator.test.ts` — instantiate CFO-FIC, validar arquivos gerados
- Valida YAML contra schema
- Valida que persona.md / user-profile.md foram copiados
- Valida que hooks.ts importável

---

## Critério de sucesso

- [ ] CFO-IA + CEO-IA + D-Governanca + Claudinho 100% escritos
- [ ] 3 variants (educacao/imobiliario/saas) para CFO e CEO
- [ ] Generator CLI gera agent válido com 1 comando
- [ ] Agente CFO-FIC gerado tem estrutura correta em `apps/fic/agents/cfo/`
- [ ] README explica: como criar novo role, como adicionar variant, como evoluir seed
- [ ] Commit: `feat(csuite): 4 templates canônicos + generator CLI + CFO-FIC instanciado`

---

## Handoff

- **S16 (Piloto CFO-FIC)** é o primeiro teste real deste pacote
- **Fase 1** completa os templates restantes
- **S17 (Validação E2E)** espera Claudinho + CFO-FIC funcionando

---

**Boa sessão. Cada template hoje economiza semanas depois.**
