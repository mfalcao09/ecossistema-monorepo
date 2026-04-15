"""
Agente 1 — Confirmação Automática de Pagamento
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1C

Endpoint: POST /api/financeiro/payment-webhook
Chamado por: Banco Inter (webhook automático após pagamento PIX ou Boleto)

Fluxo (F2 — Confirmação de Pagamento):
  1. Recebe payload do Inter (situation = RECEBIDO | EXPIRADO | CANCELADO)
  2. Verifica idempotência (evita processar mesmo pagamento duas vezes)
  3. Atualiza status da cobrança no Supabase
  4. Envia mensagem de confirmação ao aluno (WhatsApp Fase B | e-mail Fase A)
  5. Registra em `comunicacoes`

Status: 🟡 S-01 — Esqueleto criado, implementação em S-04 (Fase 1C)
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
import hmac
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("payment-webhook")

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
INTER_WEBHOOK_SECRET = os.environ.get("INTER_WEBHOOK_SECRET", "")  # para validar assinatura Inter


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        """Recebe e processa webhook de pagamento do Banco Inter."""

        # 1. Ler body
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        # 2. Validar assinatura Inter (quando INTER_WEBHOOK_SECRET estiver configurado)
        if INTER_WEBHOOK_SECRET:
            signature = self.headers.get("x-inter-signature", "")
            if not _validar_assinatura_inter(raw_body, signature):
                logger.warning("Assinatura Inter inválida — request rejeitado")
                self._send_json(401, {"error": "Assinatura inválida"})
                return

        # 3. Parsear payload
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Payload inválido"})
            return

        logger.info(f"Webhook Inter recebido: {json.dumps(payload, default=str)[:500]}")

        # 4. Processar cada item do payload
        # O Inter envia: {"payload": [{"requestCode": "...", "situation": "RECEBIDO", ...}]}
        itens = payload.get("payload", [])
        processados = 0
        erros = 0

        for item in itens:
            try:
                _processar_item_webhook(item)
                processados += 1
            except Exception as e:
                logger.exception(f"Erro processando item {item.get('requestCode')}: {e}")
                erros += 1

        # 5. Responder 200 para o Inter (mesmo em caso de erro parcial)
        # Inter espera 200 — caso contrário, tenta reenviar
        self._send_json(200, {
            "processados": processados,
            "erros": erros,
            "total": len(itens)
        })

    def _send_json(self, status_code: int, body: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())


def _validar_assinatura_inter(body: bytes, signature: str) -> bool:
    """
    Valida assinatura HMAC-SHA256 do webhook Inter.
    TODO (S-04): Confirmar algoritmo exato de assinatura com a documentação Inter.
    """
    if not INTER_WEBHOOK_SECRET:
        return True  # sem secret configurado, aceita tudo (só sandbox)
    expected = hmac.new(
        INTER_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _processar_item_webhook(item: dict):
    """
    Processa um item do payload do webhook Inter.

    Campos relevantes do payload Inter:
    - requestCode: str — código do boleto (chave de busca no Supabase)
    - situation: str — RECEBIDO | EXPIRADO | CANCELADO | A_RECEBER
    - statusDateTime: str — data/hora do evento
    - totalAmountReceived: float — valor efetivamente recebido
    - receivingOrigin: str — PIX | BOLETO
    - txid: str — ID da transação PIX
    """
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    request_code = item.get("requestCode")
    situation    = item.get("situation")
    valor_recebido = item.get("totalAmountReceived")
    forma_pagamento = item.get("receivingOrigin")  # PIX | BOLETO
    txid = item.get("txid")
    status_datetime = item.get("statusDateTime")

    if not request_code or not situation:
        logger.warning(f"Item sem requestCode ou situation: {item}")
        return

    # Busca a cobrança no Supabase
    resp = supabase.table("cobrancas") \
        .select("id, aluno_id, status, webhook_processado") \
        .eq("inter_request_code", request_code) \
        .single() \
        .execute()

    cobranca = resp.data
    if not cobranca:
        logger.warning(f"Cobrança não encontrada para requestCode: {request_code}")
        return

    # Idempotência — evita processar mesmo pagamento duas vezes
    if cobranca.get("webhook_processado") and situation == "RECEBIDO":
        logger.info(f"Webhook já processado para cobrança {cobranca['id']} — ignorando")
        return

    # Mapeia situation Inter → status interno
    status_map = {
        "RECEBIDO":  "pago",
        "EXPIRADO":  "vencido",
        "CANCELADO": "cancelado",
        "A_RECEBER": None,  # não processa — ainda pendente
    }
    novo_status = status_map.get(situation)
    if not novo_status:
        logger.info(f"Situation '{situation}' não requer atualização — ignorando")
        return

    # Atualiza cobrança
    update_data = {
        "status": novo_status,
        "webhook_processado": True,
    }
    if situation == "RECEBIDO":
        update_data.update({
            "data_pagamento": status_datetime,
            "forma_pagamento": forma_pagamento,
            "valor_recebido": valor_recebido,
            "txid_pix": txid,
        })

    supabase.table("cobrancas") \
        .update(update_data) \
        .eq("id", cobranca["id"]) \
        .execute()

    logger.info(f"Cobrança {cobranca['id']} atualizada para status '{novo_status}'")

    # TODO (S-04): Enviar notificação ao aluno (e-mail/WhatsApp)
    # _notificar_aluno(supabase, cobranca["aluno_id"], cobranca["id"], novo_status, forma_pagamento)
