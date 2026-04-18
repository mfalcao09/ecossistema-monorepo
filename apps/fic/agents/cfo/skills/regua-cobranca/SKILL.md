# SKILL: regua-cobranca

**Agent:** cfo-fic  
**Versão:** 1.0  
**Registrado em:** 2026-04-17  
**Fase:** Fase 0 (S16)

---

## Descrição

Executa a régua de cobrança automatizada para alunos inadimplentes da FIC.
Envia WhatsApp personalizado por estágio de atraso via Evolution API.
Respeita Art. II (HITL) para volumes acima de 10 alunos ou R$10k.

---

## Trigger

```
"dispare a régua"
"envie cobrança para inadimplentes"
"rode a régua de [X] dias"
"notifique alunos em atraso"
```

---

## Protocolo de execução

### Passo 1 — Dry-run sempre primeiro

```
disparar_regua_cobranca(dias_min=15, dry_run=true)
```

Apresenta ao Marcelo: quantos alunos, valor total, estágios. Pede confirmação.

### Passo 2 — Verificar Art. II

- Se `status = pending_approval`: parar e notificar Marcelo com detalhes
- Se total > R$10k OU > 10 alunos: HITL obrigatório
- Se dentro dos limites: pode executar após dry-run aprovado

### Passo 3 — Execução real

```
disparar_regua_cobranca(dias_min=15, dry_run=false)
```

### Passo 4 — Relatório pós-execução

```
gerar_relatorio_inadimplencia(formato="markdown")
```

Apresenta resultado ao Marcelo.

---

## Estágios da régua

| Estágio | Dias | Mensagem |
|---|---|---|
| lembrete-3d | -3 dias | Lembrete amigável pré-vencimento |
| vencido-1d | +1 dia | Cobrança inicial, inclui PIX |
| vencido-15d | +15 dias | Tom formal, solicita contato |
| vencido-30d | +30 dias | Aviso formal, risco Serasa |

---

## Restrições

- **NUNCA** executar sem dry-run anterior nesta sessão
- **NUNCA** pular Art. II — volume acima do limite requer Marcelo
- Estágio `vencido-30d` com Serasa: **requer aprovação explícita** mesmo dentro dos limites
- Não executar em domingos e feriados sem autorização

---

## Memória procedural

Após execução bem-sucedida, registrar no ECOSYSTEM:
- `workflow: regua-cobranca-fic`
- Campos: data, alunos_notificados, erros, total_valor
