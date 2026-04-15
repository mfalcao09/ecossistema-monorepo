"""
Cron — Expiração de PIX sob Demanda
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A

Endpoint: POST /api/financeiro/cron-expirar-pix
Chamado por: Vercel Cron (todo dia às 00:01)

O que faz:
  Marca como 'expirado' todos os registros em pix_demanda onde:
    - status = 'ativo'
    - data_validade < data de hoje  (já passou a meia-noite)

  Isso garante que nenhum PIX do dia anterior seja reutilizado.
  O Banco Inter já baixa o título automaticamente (numDiasAgenda=0),
  mas precisamos refletir esse estado também no nosso banco para que:
    - O portal do aluno não mostre PIX expirado como válido
    - O endpoint gerar-pix-demanda não tente reusar um PIX de ontem

Nota: roda às 00:01 para garantir que já seja o dia seguinte quando executar.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
from datetime import date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cron-expirar-pix")

# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
CRON_SECRET          = os.environ.get("CRON_SECRET", "")


# ---------------------------------------------------------------------------
# Handler Vercel
# ---------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        auth = self.headers.get("Authorization", "")
        if CRON_SECRET and auth != f"Bearer {CRON_SECRET}":
            self._json(401, {"error": "Não autorizado"})
            return
        try:
            resultado = _expirar_pix()
            self._json(200, resultado)
        except Exception as e:
            logger.exception("Erro fatal no cron-expirar-pix")
            self._json(500, {"error": str(e)})

    def do_GET(self):
        self._json(200, {
            "status":    "ok",
            "descricao": "Cron — Expiração de PIX sob Demanda (00:01 diário)",
        })

    def _json(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------
def _expirar_pix() -> dict:
    """
    Marca como 'expirado' todos os PIX ativos cuja data_validade é anterior a hoje.
    Roda às 00:01 → data_validade < hoje captura todos os PIX de ontem.
    """
    from supabase import create_client

    hoje     = date.today()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Busca PIX ativos com data_validade < hoje
    resp = supabase.table("pix_demanda") \
        .select("id, aluno_id, cobranca_id, data_validade, valor") \
        .eq("status", "ativo") \
        .lt("data_validade", str(hoje)) \
        .execute()

    expirados = resp.data or []
    logger.info(f"PIX a expirar: {len(expirados)}")

    if not expirados:
        return {
            "data":      str(hoje),
            "expirados": 0,
            "mensagem":  "Nenhum PIX ativo para expirar",
        }

    # Atualiza todos de uma vez (bulk update por IDs)
    ids = [p["id"] for p in expirados]

    # Supabase não suporta bulk update por lista de IDs em uma chamada,
    # então usamos um loop com update individual (quantidade esperada é pequena)
    erros = 0
    for pix in expirados:
        try:
            supabase.table("pix_demanda") \
                .update({"status": "expirado"}) \
                .eq("id", pix["id"]) \
                .eq("status", "ativo") \
                .execute()

            logger.info(f"PIX expirado: {pix['id']} | validade: {pix['data_validade']} | R$ {pix['valor']}")

        except Exception as e:
            erros += 1
            logger.error(f"Erro ao expirar PIX {pix['id']}: {e}")

    return {
        "data":      str(hoje),
        "expirados": len(expirados) - erros,
        "erros":     erros,
        "ids":       ids,
        "status":    "concluido" if erros == 0 else "concluido_com_erros",
    }
