# SKILL: emissao-boletos-mensal

**Agent:** cfo-fic  
**Versão:** 1.0  
**Registrado em:** 2026-04-17  
**Fase:** Fase 0 (S16)

---

## Descrição

Emite boletos mensais de mensalidade para alunos ativos da FIC via Banco Inter.
Idempotente: emitir 2x para o mesmo aluno no mesmo mês retorna o boleto existente.
Usa SC-29 Modo B — credenciais Inter nunca expostas ao agente.

---

## Trigger

```
"emita os boletos de [mês]"
"gere boleto para [aluno]"
"emita mensalidades de maio"
"boleto para aluno [ID] referente a [mês]"
```

---

## Protocolo de execução

### Caso 1 — Boleto individual

```
emit_boleto_aluno(aluno_id="uuid", mes_ref="2026-05", valor=850.00)
```

### Caso 2 — Emissão em massa (Fase 1)

Ainda não implementada. Usar loop sobre lista de alunos ativos.
**Art. II:** massa > 10 alunos requer aprovação Marcelo antes de executar.

---

## Regras de negócio FIC

- **Vencimento:** sempre dia 10 do mês de referência
- **Multa:** 2% após vencimento (aplicada pela Inter automaticamente)
- **Juros:** 1% a.m. após vencimento
- **Validade da agenda Inter:** 60 dias após vencimento
- **seuNumero:** `FIC-{aluno_id}-{mes_ref}` — garante unicidade na Inter

## Verificação pós-emissão

Conferir no painel Inter sandbox:
1. Acesse Inter Developers → Cobranças → Buscar por `seuNumero`
2. Confirmar que o boleto aparece com status `A_RECEBER`
3. Se PIX: escanear QR code no app Inter para confirmar

---

## Restrições

- **NUNCA** emitir boleto com valor zerado ou negativo
- Ambiente sandbox: `INTER_AMBIENTE=sandbox` deve estar setado
- Antes de ir a produção: validar 1 boleto sandbox com Marcelo

---

## Credenciais necessárias (SC-29)

```
INTER_CLIENT_ID/fic
INTER_CLIENT_SECRET/fic
INTER_CERT_PEM/fic      (.crt)
INTER_KEY_PEM/fic       (.key)
```

Provisionar via magic-link-vault antes do primeiro run real.
