# F1-S06 — Piloto Real CFO-FIC (D-002 close-out)

**Sessão:** F1-S06 · **Fase:** 1 · **Branch:** `feature/f1-s06-piloto-cfo-fic`
**Duração estimada:** 1 dia (5–7h)
**Pré-requisitos OBRIGATÓRIOS antes de iniciar:**

- PR #54 mergeado em main ✅ (S16 piloto + S19 WABA tools)
- P-004 executada: `ecosystem_credentials.acl` populado para `cfo-fic`
- Inter credenciais ativas no Vault (P-011/P-012/P-013 ✅)
- Railway Orchestrator com vars P-009 setadas

---

## Leituras obrigatórias

1. `CLAUDE.md` + `MEMORY.md`
2. `apps/fic/agents/cfo/agent.config.yaml` — configuração do agente
3. `apps/fic/agents/cfo/tools/` — 5 tools que PR #54 entregou
4. `packages/billing/src/index.ts` — InterClient (F1-S02 ✅)
5. `docs/sessions/fase1/PLANO-FASE1-PARALELO.md`

---

## Objetivo

Executar o **primeiro dry-run real** do CFO-FIC contra dados reais do ERP-FIC:

1. Conectar agente ao Supabase `ifdnjieklngcfodmtied` (ERP-FIC real)
2. Listar inadimplentes reais (≥ 15 dias)
3. Dry-run da régua de cobrança (nada enviado, apenas log)
4. Validar que Art.II HITL dispara para valores acima de R$10k

---

## Escopo exato

```
apps/fic/agents/cfo/
├── tools/
│   ├── check_inadimplentes.ts    # já criado em PR #54 — validar
│   ├── disparar_regua.ts         # já criado em PR #54 — validar dry_run flag
│   ├── emit_boleto_aluno.ts      # já criado em PR #54 — validar idempotência
│   ├── query_saldo_inter.ts      # já criado em PR #54
│   └── gerar_relatorio.ts        # já criado em PR #54
├── tests/
│   ├── integration.test.ts       # ATUALIZAR: rodar contra Supabase real (staging)
│   └── e2e/
│       └── piloto-dry-run.test.ts  # NOVO: cenário completo dry-run
└── pilot-results/
    └── 2026-04-21-dry-run.md     # NOVO: resultado do piloto
```

---

## Checklist de pré-voo

```bash
# 1. Verificar agente registrado no orchestrator
grep "cfo-fic" apps/orchestrator/config/agents.yaml

# 2. Verificar credenciais no Vault
# (via MCP Supabase ou curl SC-29)
# Deve ter: INTER_CLIENT_ID_FIC, INTER_CLIENT_SECRET_FIC, INTER_WEBHOOK_SECRET_FIC

# 3. Verificar ACL (P-004)
# SELECT credential_key, acl FROM ecosystem_credentials WHERE acl @> '["cfo-fic"]';
# Se vazio → P-004 ainda não executada (BLOQUEANTE)

# 4. Smoke test do orchestrator
curl https://<RAILWAY_URL>/health/detailed
# Todos os checks devem estar "ok"
```

---

## Dry-run do piloto

```typescript
// apps/fic/agents/cfo/tests/e2e/piloto-dry-run.test.ts

test("CFO-FIC lista inadimplentes reais", async () => {
  const result = await checkInadimplentes({
    business_id: "fic",
    dias_vencido: 15,
    supabase_project: "ifdnjieklngcfodmtied",
  });
  expect(result.total).toBeGreaterThanOrEqual(0);
  expect(result.items).toBeInstanceOf(Array);
  console.log(`[PILOTO] ${result.total} inadimplentes ≥ 15 dias`);
});

test("régua dry-run: sem envio real, apenas log", async () => {
  const result = await dispararRegua({
    business_id: "fic",
    dry_run: true,
    limite: 5,
  });
  expect(result.dry_run).toBe(true);
  expect(result.would_notify).toBeGreaterThanOrEqual(0);
  expect(result.sent).toBe(0); // nenhum envio real
  console.log(`[PILOTO] Enviaria para ${result.would_notify} alunos`);
});

test("Art.II bloqueia boleto > R$10k sem aprovação", async () => {
  await expect(
    emitBoletoAluno({
      aluno_id: "test-aluno",
      valor: 15000, // acima do threshold
      dry_run: true,
    }),
  ).rejects.toThrow("HITL required");
});
```

---

## Resultado do piloto

Criar `apps/fic/agents/cfo/pilot-results/2026-04-21-dry-run.md`:

```markdown
# Piloto CFO-FIC — Dry-Run [DATA]

## Ambiente

- Supabase: ifdnjieklngcfodmtied (ERP-FIC)
- Inter: sandbox (TESTE BOLETO API FIC 3)
- Orchestrator: [URL Railway]

## Resultados

- Inadimplentes ≥ 15 dias: [N]
- Régua dry-run: enviaria para [N] alunos
- Art.II HITL ativado: [sim/não nos casos esperados]
- Tempo total: [X]ms
- Custo estimado: ~R$[X] por execução

## Status

✅ APROVADO para produção / ⚠️ Ajustes necessários: [lista]

## Próximo passo

[ ] Marcelo aprova execução real (remover dry_run: true)
[ ] Primeiro boleto real emitido
```

---

## Débitos MEDIUM a fechar nesta sessão

Se tempo permitir (pois são simples):

- **D-005:** `routes/health.py` — implementar health checks reais (LiteLLM + Supabase + Langfuse)
- **D-006:** `apps/orchestrator/middleware/correlation.py` — X-Correlation-ID middleware
- **D-007:** `pnpm --filter @ecossistema/memory test:e2e` — script e documentação

---

## Critério de sucesso

- [ ] Pré-voo passou (credenciais, ACL, orchestrator health)
- [ ] `test:e2e` do piloto rodou com dados reais
- [ ] `pilot-results/2026-04-21-dry-run.md` criado com números reais
- [ ] Art.II HITL testado
- [ ] D-002 oficialmente encerrado no MEMORY.md
- [ ] D-005/D-006/D-007 fechados (se tempo permitir)
- [ ] CI verde
- [ ] Commit: `feat(piloto): F1-S06 CFO-FIC dry-run real — D-002 encerrado [F1-S06]`

---

## Handoff

- Após piloto aprovado: Marcelo decide quando virar `dry_run: false` para primeiro boleto real
- Documentar custo real por execução no MEMORY.md
- P-009 Railway vars + P-010 WABA webhook registration ainda precisam de ação de Marcelo
