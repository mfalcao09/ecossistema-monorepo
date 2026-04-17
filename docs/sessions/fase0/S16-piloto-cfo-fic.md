# S16 — Piloto CFO-FIC E2E

**Sessão:** S16 · **Dia:** 3 · **Worktree:** `eco-pilot-cfo` · **Branch:** `feature/pilot-cfo-fic`
**Duração estimada:** 1 dia (8h)
**Dependências:** ✅ S11 (templates), ✅ S10 (orchestrator), ✅ S13 (clients), ✅ S8 (SC-29 v2)
**Bloqueia:** S17 (Validação E2E)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VI §§ 15-18** (C-Suite), **§ 36** (stack BR per negócio)
2. `docs/masterplans/MASTERPLAN-FIC-MULTIAGENTES-v2.1.md` — contexto FIC existente (upgrade em Fase 1)
3. `apps/erp-educacional/api/financeiro/` — Python APIs existentes (cron-inadimplencia, cron-regua, emit-boletos)
4. Banco Inter PJ docs: https://developers.inter.co/references/cobranca-bolepix-2 (cobrança v3)
5. Evolution API docs: webhook WhatsApp para envio de mensagens
6. `docs/research/ANALISE-VERTICAIS-BRASIL-PROFUNDA.md` — seção Banco Inter + ICP-Brasil

---

## Objetivo

Instanciar **CFO-FIC como agente real em produção**. Primeira prova que toda a Fase 0 funciona ponta-a-ponta: agente recebe tarefa → consulta memória → pega credencial via SC-29 Modo B → chama Banco Inter → envia WhatsApp via Evolution API → registra audit → trace em Langfuse → memorização do procedural.

**Tarefa piloto:** régua de cobrança para inadimplentes ≥15 dias.

---

## Escopo exato

```
apps/erp-educacional/agents/cfo/
├── agent.config.yaml                   # gerado por S11 create-csuite-agent
├── variant.md                          # copy of educacao.md
├── evolved-config/
│   ├── constitution.md                 # imutável (link pro @ecossistema)
│   ├── persona.md                      # customizada FIC (tom, preferências)
│   ├── user-profile.md                 # Marcelo + contexto FIC
│   ├── domain-knowledge.md             # FIC específico (Cassilândia, 44 anos, cursos, mensalidades)
│   └── strategies/
│       ├── task-patterns.md
│       ├── tool-preferences.md         # preferência por Inter, PyNFe, Chatwoot, Evolution API
│       └── error-recovery.md
├── tools/                              # tools específicas do CFO-FIC
│   ├── check_inadimplentes.ts
│   ├── emit_boleto_aluno.ts            # via SC-29 Modo B → Inter
│   ├── send_whatsapp_cobranca.ts       # via SC-29 Modo B → Evolution API
│   ├── gerar_relatorio_inadimplencia.ts
│   └── disparar_regua_cobranca.ts      # meta-tool que orquestra
├── skills/                             # SKILL.md registrados em skills_registry
│   ├── regua-cobranca/SKILL.md
│   ├── reconciliacao-bancaria/SKILL.md
│   └── emissao-boletos-mensal/SKILL.md
└── tests/
    ├── integration.test.ts             # mock Inter + Evolution API
    └── e2e-sandbox.test.ts              # usa sandbox Inter + número teste WhatsApp
```

---

## Decisões-chave

1. **Sandbox primeiro, produção depois** — Inter tem sandbox completo; WhatsApp usa número teste da Evolution
2. **Hooks constitucionais ativos** — especialmente Art. II bloqueia massa > R$10k
3. **Credenciais via SC-29 Modo B** — Inter client_id/secret/cert nunca expostos ao agente
4. **Idempotência obrigatória** (Art. III) — mesma régua disparada 2x no mesmo dia não duplica WhatsApp
5. **Memorização automática** — toda execução bem-sucedida vira memória procedural
6. **Approval workflow** — se >10 inadimplentes ou >R$10k, requer aprovação Marcelo

---

## Spec das tools

### `check_inadimplentes.ts`

```typescript
import { supabase } from '@ecossistema/shared-supabase';
import { tool } from '@anthropic-ai/claude-agent-sdk';

export const checkInadimplentes = tool({
  name: 'check_inadimplentes',
  description: 'Consulta alunos inadimplentes da FIC com filtros',
  input_schema: {
    type: 'object',
    properties: {
      dias_min: { type: 'number', default: 15 },
      curso_id: { type: 'string', nullable: true },
      limit: { type: 'number', default: 100 },
    },
  },
  handler: async ({ dias_min, curso_id, limit }) => {
    const { data } = await supabase('ifdnjieklngcfodmtied')
      .from('alunos_view_inadimplencia')
      .select('aluno_id, nome, cpf_hash, curso, mensalidade_valor, dias_atraso, whatsapp_hash')
      .gte('dias_atraso', dias_min)
      .eq(curso_id ? 'curso_id' : 'true', curso_id ?? 'true')
      .limit(limit);
    
    return {
      count: data.length,
      total_valor: data.reduce((s, a) => s + a.mensalidade_valor * Math.floor(a.dias_atraso / 30 + 1), 0),
      alunos: data.map(a => ({ aluno_id: a.aluno_id, dias_atraso: a.dias_atraso, valor_devido: ... })),
    };
  },
});
```

### `emit_boleto_aluno.ts` (via SC-29 Modo B)

```typescript
export const emitBoletoAluno = tool({
  name: 'emit_boleto_aluno',
  description: 'Emite boleto para um aluno via Banco Inter',
  input_schema: {
    type: 'object',
    required: ['aluno_id', 'mes_ref', 'valor'],
    properties: {
      aluno_id: { type: 'string' },
      mes_ref: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      valor: { type: 'number', minimum: 1 },
    },
  },
  idempotent: true,  // hook Art. III injeta key = sha256(aluno_id + mes_ref + hoje)
  handler: async ({ aluno_id, mes_ref, valor }) => {
    // Busca dados do aluno
    const aluno = await fetchAluno(aluno_id);
    
    // SC-29 Modo B — proxy
    const result = await credentials.proxy({
      credential_name: 'INTER_CLIENT_ID',  // junto vai client_secret e cert
      project: 'fic',
      target: {
        method: 'POST',
        url: 'https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas',
        headers: { 'Content-Type': 'application/json' },
        body: {
          seuNumero: `FIC-${aluno_id}-${mes_ref}`,
          valorNominal: valor,
          dataVencimento: calcDataVencimento(mes_ref),
          numDiasAgenda: 60,
          pagador: {
            cpfCnpj: aluno.cpf,
            tipoPessoa: 'FISICA',
            nome: aluno.nome,
            // ... endereço
          },
        },
      },
    });
    
    // Registra em cobrancas
    const { data: cobranca } = await supabase('ifdnjieklngcfodmtied')
      .from('cobrancas')
      .insert({
        aluno_id, mes_ref, valor, status: 'emitido',
        inter_cobranca_id: result.body.codigoSolicitacao,
        pix_qrcode: result.body.pix?.qrcode,
      })
      .select().single();
    
    return { cobranca_id: cobranca.id, inter_id: result.body.codigoSolicitacao };
  },
});
```

### `send_whatsapp_cobranca.ts`

Via Evolution API + template pre-aprovado:

```typescript
export const sendWhatsappCobranca = tool({
  name: 'send_whatsapp_cobranca',
  description: 'Envia mensagem de cobrança via WhatsApp (Evolution API)',
  input_schema: {
    type: 'object',
    required: ['aluno_id', 'estagio', 'cobranca_id'],
    properties: {
      aluno_id: { type: 'string' },
      estagio: { type: 'string', enum: ['lembrete-3d', 'vencido-1d', 'vencido-15d', 'vencido-30d'] },
      cobranca_id: { type: 'string' },
    },
  },
  handler: async (args) => {
    const aluno = await fetchAluno(args.aluno_id);
    const cobranca = await fetchCobranca(args.cobranca_id);
    const template = await fetchTemplate(args.estagio);  // template Chatwoot
    
    const text = renderTemplate(template, { aluno, cobranca });
    
    const result = await credentials.proxy({
      credential_name: 'EVOLUTION_API_TOKEN',
      project: 'fic',
      target: {
        method: 'POST',
        url: `${EVOLUTION_API_URL}/message/sendText/fic-instance`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          number: aluno.whatsapp_jid,
          text,
        },
      },
    });
    
    // Registra em comunicacoes
    await supabase('ifdnjieklngcfodmtied').from('comunicacoes').insert({
      aluno_id: args.aluno_id,
      canal: 'whatsapp',
      estagio: args.estagio,
      cobranca_id: args.cobranca_id,
      status: 'enviado',
      message_id: result.body.key.id,
    });
    
    return { sent: true, message_id: result.body.key.id };
  },
});
```

### `disparar_regua_cobranca.ts` (meta-tool)

```typescript
export const dispararReguaCobranca = tool({
  name: 'disparar_regua_cobranca',
  description: 'Executa régua de cobrança completa para inadimplentes',
  input_schema: {
    type: 'object',
    required: ['dias_min'],
    properties: {
      dias_min: { type: 'number', minimum: 1 },
      dry_run: { type: 'boolean', default: false },
    },
  },
  idempotent: true,
  handler: async ({ dias_min, dry_run }, ctx) => {
    // 1. Busca inadimplentes
    const { alunos, total_valor } = await checkInadimplentes.handler({ dias_min });
    
    // 2. Art. II: se total > R$10k ou >10 alunos, aprovação
    //    Hook já vai bloquear automaticamente — aqui é just-in-case
    if (total_valor > 10000 && !ctx.approved_by_human) {
      return {
        status: 'pending_approval',
        reason: 'Art. II: Total R$ ' + total_valor + ' excede limite. Aguardando Marcelo.',
        pending_alunos: alunos.length,
        pending_valor: total_valor,
      };
    }
    
    if (dry_run) {
      return { dry_run: true, would_notify: alunos.length, estimated_cost: 0.02 };  // ~R$0.02 por WhatsApp
    }
    
    // 3. Para cada aluno, envia WhatsApp no estágio apropriado
    const results = [];
    for (const aluno of alunos) {
      const estagio = computeEstagio(aluno.dias_atraso);
      try {
        const sent = await sendWhatsappCobranca.handler({
          aluno_id: aluno.aluno_id,
          estagio,
          cobranca_id: aluno.cobranca_ativa_id,
        });
        results.push({ aluno_id: aluno.aluno_id, status: 'sent', message_id: sent.message_id });
      } catch (e) {
        results.push({ aluno_id: aluno.aluno_id, status: 'error', error: String(e) });
      }
    }
    
    const sent = results.filter(r => r.status === 'sent').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    return {
      status: 'completed',
      total_alunos: alunos.length,
      total_valor,
      sent,
      errors,
      results,
    };
  },
});
```

---

## Domain Knowledge customizado (`evolved-config/domain-knowledge.md`)

```markdown
# FIC — Faculdades Integradas de Cassilândia

## Identidade
- 44 anos de tradição em Cassilândia-MS
- Cursos: Administração, Direito, Pedagogia, Publicidade, Psicologia, Biomedicina
- ~1.200 alunos matriculados
- Diploma digital via MEC Portaria 554/2021 (ICP-Brasil obrigatório)

## Financeiro

### Mensalidades
- Valor médio: R$ 850 (Adm) a R$ 1.450 (Biomedicina)
- Vencimento: dia 10 de cada mês
- Multa: 2% + juros 1%a.m.
- Taxa de inadimplência histórica: ~8% (meta: <6%)

### Banco Inter PJ
- Client ID: via SC-29 (`INTER_CLIENT_ID/fic`)
- Client Secret: via SC-29 (`INTER_CLIENT_SECRET/fic`)
- Certificado .crt/.key: via SC-29 (`INTER_CERT/fic`)
- Endpoints: https://cdpj.partners.bancointer.com.br/cobranca/v3/*
- Scopes necessários: cobranca-read, cobranca-write

### Régua de cobrança padrão

| Estágio | Dias | Canal | Template |
|---|---|---|---|
| lembrete-3d | -3 | WhatsApp | Lembrete amigável |
| vencido-1d | +1 | WhatsApp + Email | Cobrança inicial |
| vencido-15d | +15 | WhatsApp + ligação | Formal |
| vencido-30d | +30 | Email formal + Serasa (apr. Marcelo) | Escalação |

## Conformidade
- NFS-e via PyNFe (município: Cassilândia-MS)
- LGPD: dados de alunos classificados como sensíveis; parentes/responsáveis separados
- Diploma ICP-Brasil: via pyHanko sidecar (Fase 1)

## Sinais de alerta
- Inadimplência >10% em um curso → alerta CEO-FIC + Marcelo
- Queda 20% em novas matrículas → sinal concorrência
- Aumento em pedidos de cancelamento → investigar causa
```

---

## Instanciação via generator

```bash
cd packages/@ecossistema/c-suite-templates
pnpm create-csuite-agent --business fic --role cfo
# Cria apps/fic/agents/cfo/ com:
#   agent.config.yaml
#   variant.md (educacao)
#   evolved-config/ (seed)
#   tools/ (stub)
#   tests/ (stub)

# Personalização manual após generator:
# 1. Expandir domain-knowledge.md (como acima)
# 2. Implementar tools reais (seções acima)
# 3. Registrar skills em skills_registry via EF SC-04
```

---

## Registro no orchestrator

Adicionar ao agent registry (`apps/orchestrator/agents/registry.yaml`):

```yaml
- id: cfo-fic
  name: CFO-IA FIC
  model: claude-sonnet-4-6
  business_id: fic
  config_path: /workspace/apps/fic/agents/cfo/agent.config.yaml
  tools:
    - check_inadimplentes
    - emit_boleto_aluno
    - send_whatsapp_cobranca
    - gerar_relatorio_inadimplencia
    - disparar_regua_cobranca
  mcps:
    - supabase-mcp
    - credential-mcp
    - memory-mcp
  enabled: true
```

---

## Credenciais necessárias em SC-29

Via magic-link-vault (S12), coletar antes do primeiro run real:

```bash
# Marcelo recebe via WhatsApp/CLI:
# "CFO-FIC está setup. Preciso das credenciais:
#   1. INTER_CLIENT_ID/fic — URL: https://vault.../abc123
#   2. INTER_CLIENT_SECRET/fic — URL: https://vault.../def456
#   3. INTER_CERT/fic (arquivo .crt) — URL: https://vault.../ghi789
#   4. INTER_KEY/fic (arquivo .key) — URL: https://vault.../jkl012
#   5. EVOLUTION_API_TOKEN/fic — URL: https://vault.../mno345"
```

Marcelo abre cada URL, cola credencial, confirma. SC-29 armazena cifrado.

---

## Testes obrigatórios

### `tests/integration.test.ts` (com mocks)
- check_inadimplentes retorna dados mockados
- emit_boleto_aluno chama SC-29 com payload correto (mockado)
- send_whatsapp chama SC-29 com payload correto
- disparar_regua com 15 alunos e total R$8k → executa sem approval
- disparar_regua com 15 alunos e total R$15k → retorna `pending_approval`

### `tests/e2e-sandbox.test.ts`
- Conecta SC-29 real, Inter sandbox, WhatsApp sandbox
- Emite 1 boleto sandbox
- Verifica recebido em Inter sandbox dashboard
- Envia 1 WhatsApp para número teste → recebe

---

## Critério de sucesso

- [ ] CFO-FIC instanciado em `apps/fic/agents/cfo/`
- [ ] Registrado no orchestrator agent registry
- [ ] 5 tools implementadas + testadas
- [ ] Domain knowledge customizado para FIC
- [ ] Credenciais em SC-29 (sandbox: Inter test + Evolution test instance)
- [ ] Smoke test: `POST /agents/cfo-fic/run` com `{"query":"Dispare régua dry-run"}` retorna plano
- [ ] Sandbox test: emite 1 boleto sandbox → cobrança aparece no dashboard Inter
- [ ] Sandbox test: envia 1 WhatsApp → mensagem chega
- [ ] Trace completo em Langfuse (tool calls, LLM calls, latência, custo)
- [ ] Memória procedural criada (workflow "regua-cobranca-fic" registrado)
- [ ] Audit log populado com ≥10 entradas após 1 execução dry-run
- [ ] Hook Art. II bloqueia corretamente (teste manual: tenta executar com total > R$10k → block)
- [ ] Commit: `feat(pilot): CFO-FIC agente + 5 tools + sandbox E2E validado`

---

## ⚠️ Avisos

1. **NUNCA** rodar em produção (alunos reais) sem aprovação explícita Marcelo
2. **Sempre dry_run primeiro** antes de execução real
3. **Sandbox Inter** → configurar em `INTER_AMBIENTE=sandbox` nas credenciais
4. **Evolution API teste** → usar instance separada da produção
5. **Remover dados de teste** do audit_log antes de ir a prod

---

## Handoff

- **S17 (Validação E2E)** inclui este piloto como smoke test principal
- **Fase 1** expande CFO-FIC para produção real + inicia outros 4 CFOs
- **D-Governanca** (futuro) audita CFO-FIC com mais rigor por ser financeiro

---

**Boa sessão. Esse é o momento em que a V9 sai do papel. Capriche.**
