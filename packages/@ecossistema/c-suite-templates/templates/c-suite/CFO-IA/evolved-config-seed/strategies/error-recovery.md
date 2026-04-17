# Estratégias de Recuperação de Erro — CFO-IA

## Banco Inter — timeout ou erro de API

**Sintoma:** `fetch` para `cdpj.partners.inter.co` retorna timeout ou 5xx

**Protocolo:**
1. Retry com backoff exponencial: 3 tentativas (2s → 4s → 8s)
2. Se persistir: verificar status Inter em `/api/cron/banco-inter-status`
3. Se confirmado problema Inter: logar em `audit_log` severity=warning + parar operação
4. Último recurso: alerta D-Infra + Marcelo via WhatsApp

**Nunca:** tentar operação sem confirmação bancária (Art. VIII)

---

## SEFAZ indisponível (NFS-e)

**Sintoma:** emissão de NFS-e retorna erro SEFAZ

**Protocolo:**
1. Adicionar emissão à fila idempotente com `nfse_pending_id`
2. Tentar a cada 15min por 6h
3. Se > 6h: notificar Marcelo com contingência (emissão manual)
4. Nunca considerar serviço como faturado sem NFS-e emitida

---

## Discrepância em reconciliação bancária

**Sintoma:** valor no Inter ≠ valor registrado internamente

**Protocolo:**
1. NÃO corrija automaticamente — nunca
2. Registre ambos valores em `audit_log` severity=warning
   ```json
   { "inter_value": 1234.56, "internal_value": 1200.00, "diff": 34.56 }
   ```
3. Escale para Marcelo com os dois valores e data do extrato
4. Aguardar instrução antes de qualquer ajuste

---

## Erro de idempotência detectado

**Sintoma:** tentativa de emitir boleto para `(aluno_id, mes_ref)` já existente

**Protocolo:**
1. Bloquear emissão imediatamente (Art. III)
2. Retornar o boleto existente (não criar novo)
3. Logar tentativa de duplicação em `audit_log` severity=info
4. Se for boleto vencido: verificar se deve emitir renovação vs. segunda via

---

## LLM com custo acima do threshold (Art. XII)

**Sintoma:** budget mensal > 90%

**Protocolo:**
1. Alertar Marcelo imediatamente
2. Reduzir chamadas: usar `claude-haiku` para tarefas simples
3. Cache de análises repetitivas em `ecosystem_memory`
4. Escalar para D-Infra revisão de prompts

---

## Aprendizados de erros específicos do negócio

(Agente preenche conforme encontra erros no negócio específico)
