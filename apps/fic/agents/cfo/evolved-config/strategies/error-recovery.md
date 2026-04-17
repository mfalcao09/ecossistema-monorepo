# Error Recovery — CFO FIC

## Banco Inter timeout

1. Retry exponencial: 3x (2s → 4s → 8s)
2. Se persistir: `GET /api/cron/banco-inter-status`
3. Logar em `fic_agente_logs` severity=warning
4. Alertar D-Infra + Marcelo via WhatsApp

## SEFAZ indisponível (NFS-e)

1. Fila idempotente com `nfse_pending_id` em `fic_agente_logs`
2. Retry a cada 15min por 6h
3. Se > 6h: notificar Marcelo com contingência manual

## Discrepância Inter ↔ Supabase

1. NÃO corrigir automaticamente — nunca
2. Registrar ambos valores em `fic_agente_logs` severity=warning
3. Escalar para Marcelo com os dois valores + data do extrato

## Duplicação de boleto detectada

1. Bloquear emissão (Art. III)
2. Retornar boleto existente
3. Logar tentativa em `fic_agente_logs` severity=info

## Aprendizados específicos FIC

(Preenchido conforme encontro erros operando com a FIC)
