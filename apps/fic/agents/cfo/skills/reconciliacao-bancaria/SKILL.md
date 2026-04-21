# SKILL: reconciliacao-bancaria

**Agent:** cfo-fic  
**Versão:** 1.0  
**Registrado em:** 2026-04-17  
**Fase:** Fase 0 (S16) — stub para Fase 1

---

## Descrição

Reconcilia pagamentos recebidos no Banco Inter com cobranças registradas no Supabase FIC.
Identifica: pagamentos sem cobrança correspondente, cobranças em aberto já pagas,
divergências de valor.

**Status:** Skill declarada; implementação das tools `consultar_extrato_inter` e
`reconciliar_pagamento` será feita na Fase 1 após integração webhook Inter estar estável.

---

## Trigger

```
"reconcilie o banco"
"verifique pagamentos do Inter"
"confira se os pagamentos batem"
"qual o extrato de [data]?"
```

---

## Protocolo de execução (Fase 1)

### Passo 1 — Buscar extrato Inter

```
consultar_extrato_inter(data_inicio="YYYY-MM-DD", data_fim="YYYY-MM-DD")
```

### Passo 2 — Reconciliar contra cobrancas

```
reconciliar_pagamento(extrato_inter, cobrancas_pendentes)
```

### Passo 3 — Gerar relatório de divergências

Apresentar ao Marcelo divergências para resolução manual.

---

## Restrições

- Nunca marcar cobrança como paga sem evidência do webhook Inter
- Art. VIII: baixa real exige confirmação bancária, não apenas declaração do aluno
- Divergências > R$500: escalar para Marcelo antes de qualquer ajuste

---

## Fase 1 backlog

- [ ] Implementar tool `consultar_extrato_inter` (via SC-29 + Inter extrato v3)
- [ ] Implementar tool `reconciliar_pagamento`
- [ ] Webhook Inter → atualiza `fic_pagamentos` automaticamente
- [ ] Cron diário de reconciliação via pg_cron
