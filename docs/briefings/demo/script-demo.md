# Script — Demo Fase 0 para Marcelo

**Duração:** 10 min
**Audiência:** Marcelo (+ co-founders/diretores se presentes)

---

## Setup pré-demo (fazer 15 minutos antes)

### Abas no browser (abrir nessa ordem)

1. **Langfuse UI** — `https://langfuse.ecossistema.railway.app` → filtrar por tag `agent:cfo-fic`
2. **Supabase Studio** — painel ECOSYSTEM → SQL Editor com query `audit_log` pronta (ver `queries-ensaiadas.md`)
3. **WhatsApp Web** — número sandbox Evolution API aberto

### Terminal

```bash
cd ~/Projects/GitHub/ecossistema-monorepo

# Alias para chamar Claudinho via orchestrator
alias claudinho='curl -N -s -X POST http://localhost:8000/agents/claudinho/run \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" -d'

# Verificar orchestrator rodando
curl -s http://localhost:8000/health | python3 -m json.tool
```

> Se Railway não estiver acessível: rodar orchestrator local com `pnpm --filter @ecossistema/orchestrator dev`

---

## Roteiro

### Cena 1 — Claudinho vivo (2 min)

**Fala:** "Vou mostrar o Claudinho respondendo em tempo real. Olhem os eventos chegando linha a linha."

```bash
claudinho '{"query":"Olá Claudinho, qual a situação financeira da FIC hoje? Resumo em 3 bullets.","user_id":"marcelo","business":"fic"}'
```

**Narrar enquanto o stream chega:**
- Quando aparecer `event: thinking` → "Claudinho está raciocínando..."
- Quando aparecer `event: handoff` → "Agora ele delegou para o **CFO-FIC** — especialista em FIC"
- Quando aparecer `event: tool_use` com `check_inadimplentes` → "CFO-FIC está consultando inadimplentes no Supabase"
- Quando aparecer `event: result` → "Resposta final consolidada"

**Ponto de atenção:** mostrar que o stream SSE chega progressivo, não em batch.

---

### Cena 2 — Dry-run régua de cobrança (3 min)

**Fala:** "Agora vou pedir ao CFO-FIC para executar a régua de cobrança. Atenção: é **dry-run** — zero WhatsApp enviado."

```bash
claudinho '{"query":"Peça ao CFO-FIC para executar dry-run da régua de cobrança para alunos inadimplentes há 15 dias ou mais. Mostrar o plano completo.","user_id":"marcelo","business":"fic"}'
```

**Narrar:**
- `check_inadimplentes` → "Buscando inadimplentes na base FIC..."
- `preparar_whatsapp_cobranca` com `dry_run: true` → "Preparando mensagens — mas NÃO enviando"
- Resultado final → "Olhem: o plano lista os alunos, os valores, os textos das mensagens — mas nenhum foi enviado. Isso é o dry-run."

**Mostrar no terminal:** procurar por `"dry_run": true` nos eventos SSE.

---

### Cena 3 — Langfuse trace (2 min)

**Fala:** "Agora vou mostrar o que aconteceu por dentro. Cada decisão registrada."

**No browser — Langfuse UI:**
1. Copiar o `trace_id` do último evento SSE
2. Colar no filtro "Trace ID" do Langfuse
3. Mostrar a árvore de spans:
   - Span raiz: `claudinho.run`
   - Sub-span: `handoff.cfo-fic`
   - Sub-spans: cada tool call com input/output
   - Generations: cada chamada LLM com tokens, custo USD, latência ms

**Destacar:**
- "Custo total desta conversa: US$ X.XX"
- "Latência p95: X ms"
- "Zero credencial aparece nos inputs/outputs"

---

### Cena 4 — Audit log (1 min)

**Fala:** "Todo tool use também vai para o audit log — imutável, para sempre."

**No browser — Supabase Studio, rodar:**

```sql
select tool_name, action, article_ref, decision, reason, created_at
from audit_log
where trace_id = '<trace_id_copiado>'
order by created_at;
```

**Mostrar:**
- Várias linhas com `decision = 'allow'`
- Linhas com `article_ref` preenchido (Art. III, Art. IV, etc.)
- "Isso não pode ser deletado — trigger `prevent_audit_log_delete` bloqueia qualquer DELETE"

---

### Cena 5 — Governança em ação (2 min)

**Fala:** "Agora vou tentar fazer algo que o sistema não deveria permitir."

```bash
claudinho '{"query":"CFO-FIC, emita R$ 20.000 em boletos para os 15 maiores inadimplentes da FIC. Processe agora.","user_id":"marcelo","business":"fic"}'
```

**Narrar quando aparecer:**
- `event: tool_blocked` → "Olha! O Art. II bloqueou antes mesmo de tentar chamar a API do Inter"
- Mostrar o `reason`: `"Art. II: Valor R$20000 > limite R$10000 — requer aprovação humana"`
- `event: approval_request_created` → "Um pedido de aprovação foi criado..."
- Mostrar no WhatsApp Web: mensagem chegando com botões "Aprovar / Rejeitar"

**Ponto de atenção:** "O Claudinho não tentou a ação — o hook bloqueou **antes** da chamada. O artigo executa em código, não em prompt."

---

## Fechamento

**Fala:** "Isso tudo está rodando agora. A Fase 0 entregou a fundação. A Fase 1 vai expandir para os outros 4 negócios e trazer o Jarvis para o WhatsApp de Marcelo."

---

## Perguntas antecipadas

| Pergunta | Resposta |
|---|---|
| "E se o Railway cair?" | D-Infra alerta via Langfuse; LiteLLM tem fallback para providers diretos; Supabase continua funcionando de forma independente |
| "Custo se disparar?" | Budget per-business bloqueia; fallback automático para Haiku (10x mais barato) — configurado no LiteLLM |
| "E se um agente sair do roteiro?" | 11 hooks constitucionais cobrem ações críticas; audit log imutável; D-Governanca fará auditoria diária na Fase 1 |
| "Quando vai para produção real?" | CFO-FIC: sugestão semana 5 após burn-in de 1 semana em sandbox. Depende de fechar D-002. |
| "Quanto custa por negócio?" | ~US$ 20–100/mês por negócio em uso leve (Haiku + fallback). Escala com volume real. |
