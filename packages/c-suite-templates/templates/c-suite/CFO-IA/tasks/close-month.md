# Task: close-month

> **Invocador típico:** CFO-IA chief (trigger: `pg_cron` último dia útil do mês, 18h BRT)
> **Duração esperada:** 20-40 min por negócio
> **Masters envolvidos:** `fpa`, `tax`

---

## Objetivo

Fechar a competência do mês para um negócio: DRE consolidado, fluxo de caixa, apuração fiscal, variance vs orçado, recomendações.

## Pré-condições

- [ ] Todos os lançamentos do mês foram integrados em `{business}_pagamentos` e `{business}_receitas`
- [ ] Reconciliação bancária do mês está fechada (diff Inter ↔ Supabase < R$ 100)
- [ ] `specialist-inter` marcou `dia_util_ultimo = today` em `fechamento_mensal`
- [ ] Variables `{business}`, `competencia` (`YYYY-MM`) definidas

## Passos

1. **Chief** (`base-prompt.md` CFO-IA) recebe invocação com `{business, competencia}`
2. **Chief** valida pré-condições → se alguma falhar, **parar** e reportar (Art. IX)
3. **Chief** delega a **`master-fpa`**:
   - DRE mensal + YTD
   - Fluxo de caixa realizado
   - Variance orçado vs realizado (por conta contábil)
   - Cenário base para próximo mês
4. **Chief** delega a **`master-tax`**:
   - Apuração DAS / DCTF / retenções
   - Guias a pagar no próximo mês + prazos
   - Validação de divergências SPED
5. **Chief** roda `checklists/bam-alignment.md` sobre o resultado
6. **Chief** consolida em relatório único (tabelas + 5 bullets executivos + 3 recomendações)
7. **Chief** grava em `ecosystem_memory` com namespace `cfo.{business}.close.{competencia}` (Art. XIV)
8. **Chief** envia para CEO-IA do negócio + Marcelo (WhatsApp — Nível 2 Baileys)

## Pós-condições

- [ ] Relatório em `ecosystem_memory` (auditável)
- [ ] Guias de tributos com prazo < 10 dias flagadas no calendário
- [ ] Variance crítica (> 20%) escalada ao CEO-IA + Marcelo
- [ ] `audit_log` tem entrada `close-month` com `hash_sha256` do relatório

## Falhas comuns e tratamento

| Falha | Ação |
|---|---|
| Pré-condição 1 (lançamentos faltando) | Parar, listar lançamentos pendentes, escalar ao operacional do negócio |
| Variance > 50% sem explicação | Parar, acionar HITL Marcelo — **não** gerar recomendação automática |
| Divergência SPED > R$ 1k | Parar, escalar `master-tax` para auditoria |
| Timeout no Inter (Modo B) | Retry 3× com backoff; se persistir, escalar infra |

---

## Artigos prioritários

- **II — HITL** (escalar variance crítica)
- **IX — Falha Explícita** (nunca fabricar variance "explicada")
- **XIV — Dual-Write** (memory antes de mensagem)
