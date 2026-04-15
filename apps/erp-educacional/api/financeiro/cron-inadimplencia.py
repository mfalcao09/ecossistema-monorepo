"""
Cron — Detecção de Inadimplência
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A

Endpoint: POST /api/financeiro/cron-inadimplencia
Chamado por: Vercel Cron (todo dia às 08:00, exceto dia 01-08 do mês)

O que faz:
  1. Busca cobranças com status 'enviado' cujo vencimento já passou
  2. Marca-as como 'vencida' no banco
  3. Para cada cobrança vencida, calcula o saldo do dia:
       - Multa: 10% fixo (aplicada apenas no dia 09 = 1º dia de atraso)
       - Juros: 2% ao mês = 0,0667%/dia (acumulado a partir do dia 09)
       - Valor total = principal + multa + juros acumulados
  4. Insere 1 registro em inadimplencia_diaria (ON CONFLICT DO NOTHING = idempotente)
  5. Se for o dia 09 (1º dia de atraso), dispara primeira mensagem de régua via Resend
     WhatsApp será implementado na Fase B com Meta Business API

Fórmulas:
  multa     = valor_principal × 0.10   (aplica-se 1x no dia 09)
  juros_dia = valor_principal × (0.02 / 30) × dias_atraso
  total     = valor_principal + multa + juros_dia
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cron-inadimplencia")

# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY       = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM           = os.environ.get("EMAIL_FROM", "financeiro@fic.edu.br")
EMAIL_NOME_FROM      = os.environ.get("EMAIL_NOME_FROM", "FIC — Financeiro")
CRON_SECRET          = os.environ.get("CRON_SECRET", "")

# Parâmetros financeiros (configuráveis via env)
MULTA_PERCENTUAL = float(os.environ.get("MULTA_PERCENTUAL_ATRASO", "10.0"))  # 10% fixo
JUROS_MENSAL     = float(os.environ.get("JUROS_MENSAL_ATRASO",     "2.0"))   # 2% ao mês


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
            resultado = _processar_inadimplencia()
            self._json(200, resultado)
        except Exception as e:
            logger.exception("Erro fatal no cron-inadimplencia")
            self._json(500, {"error": str(e)})

    def do_GET(self):
        self._json(200, {"status": "ok", "descricao": "Cron — Detecção de Inadimplência"})

    def _json(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------
def _processar_inadimplencia() -> dict:
    from supabase import create_client

    hoje    = date.today()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 1. Busca cobranças enviadas com vencimento anterior a hoje (boleto já expirou)
    resp = supabase.table("cobrancas") \
        .select("id, aluno_id, valor, data_vencimento, "
                "alunos(id, nome, email, telefone)") \
        .in_("status", ["enviado", "gerado"]) \
        .lt("data_vencimento", str(hoje)) \
        .eq("tipo", "mensalidade") \
        .execute()

    cobrancas_vencidas = resp.data or []
    logger.info(f"Cobranças vencidas encontradas: {len(cobrancas_vencidas)}")

    if not cobrancas_vencidas:
        return {
            "data": str(hoje),
            "processadas": 0,
            "mensagem": "Nenhuma cobrança vencida encontrada",
        }

    processadas   = 0
    erros         = 0
    primeira_msg  = 0  # cobranças onde foi o 1º dia (dia 09 = 1 dia de atraso)
    erros_log     = []

    for cob in cobrancas_vencidas:
        try:
            cobranca_id   = cob["id"]
            aluno_id      = cob["aluno_id"]
            aluno         = cob.get("alunos") or {}
            vencimento    = date.fromisoformat(str(cob["data_vencimento"]))
            dias_atraso   = (hoje - vencimento).days
            valor_principal = Decimal(str(cob["valor"]))

            # 2. Calcular multa + juros
            multa, juros_acum, total = _calcular_encargos(
                valor_principal, dias_atraso
            )

            # 3. Marcar cobrança como 'vencida' (idempotente — só se ainda não estiver)
            supabase.table("cobrancas") \
                .update({"status": "vencido"}) \
                .eq("id", cobranca_id) \
                .in_("status", ["enviado", "gerado"]) \
                .execute()

            # 4. Inserir/atualizar registro diário (ON CONFLICT DO NOTHING via upsert)
            supabase.table("inadimplencia_diaria").upsert({
                "cobranca_id":     cobranca_id,
                "aluno_id":        aluno_id,
                "data_referencia": str(hoje),
                "dias_atraso":     dias_atraso,
                "valor_principal": str(valor_principal),
                "valor_multa":     str(multa),
                "valor_juros_acum": str(juros_acum),
                "valor_total":     str(total),
            }, on_conflict="cobranca_id,data_referencia").execute()

            # 5. Se for o 1º dia de atraso → dispara mensagem inicial
            if dias_atraso == 1:
                enviado = _enviar_email_inadimplencia_dia1(aluno, cobranca_id, total, hoje)
                _registrar_comunicacao(
                    supabase, cobranca_id, aluno_id,
                    tipo="cobranca_inadimplencia",
                    canal="email",
                    status="enviado" if enviado else "falhou",
                    mensagem=f"Dia 1 de atraso. Saldo: R$ {total:.2f}",
                )
                if enviado:
                    primeira_msg += 1

            processadas += 1

        except Exception as e:
            erros += 1
            msg = f"Cobrança {cob.get('id')}: {str(e)}"
            erros_log.append(msg)
            logger.exception(f"Erro ao processar cobrança {cob.get('id')}: {e}")

    return {
        "data":           str(hoje),
        "processadas":    processadas,
        "primeira_msg":   primeira_msg,
        "erros":          erros,
        "erros_log":      erros_log,
        "status":         "concluido" if erros == 0 else "concluido_com_erros",
    }


# ---------------------------------------------------------------------------
# Cálculo de encargos
# ---------------------------------------------------------------------------
def _calcular_encargos(
    valor_principal: Decimal,
    dias_atraso: int,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Calcula multa + juros acumulados para N dias de atraso.

    Regras FIC:
    - Multa: 10% fixo, aplicada 1x a partir do 1º dia de atraso
    - Juros: 2% ao mês = 2/30 % por dia, acumulado linearmente
    - Ambos incidem sobre o valor principal cheio (sem descontos)

    Retorna: (multa, juros_acumulados, total)
    """
    D = Decimal
    dois_casas = Decimal("0.01")

    multa_pct  = D(str(MULTA_PERCENTUAL)) / D("100")   # 0.10
    juros_dia  = D(str(JUROS_MENSAL)) / D("100") / D("30")  # 0.02/30 ≈ 0.000667

    multa       = (valor_principal * multa_pct).quantize(dois_casas, rounding=ROUND_HALF_UP)
    juros_acum  = (valor_principal * juros_dia * D(str(dias_atraso))).quantize(dois_casas, rounding=ROUND_HALF_UP)
    total       = (valor_principal + multa + juros_acum).quantize(dois_casas, rounding=ROUND_HALF_UP)

    return multa, juros_acum, total


# ---------------------------------------------------------------------------
# E-mail do 1º dia de atraso (dia 09)
# ---------------------------------------------------------------------------
def _enviar_email_inadimplencia_dia1(
    aluno: dict,
    cobranca_id: str,
    valor_total: Decimal,
    hoje: date,
) -> bool:
    """Envia e-mail amigável no 1º dia de atraso informando o saldo e opção de PIX."""
    if not RESEND_API_KEY or not aluno.get("email"):
        return False

    import requests

    nome = aluno.get("nome", "Aluno")
    vt   = f"R$ {float(valor_total):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    data = hoje.strftime("%d/%m/%Y")

    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">Faculdades Integradas de Cassilândia</h2>
    <p style="color:#a0c4ff;margin:5px 0 0;">Setor Financeiro</p>
  </div>

  <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;">
    <p>Olá, <strong>{nome}</strong>!</p>
    <p>Identificamos que seu boleto de mensalidade venceu ontem e ainda não
       foi identificado o pagamento em nosso sistema.</p>

    <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>Saldo atual ({data}):</strong></p>
      <p style="font-size:24px;font-weight:bold;color:#b45309;margin:0;">{vt}</p>
      <p style="font-size:12px;color:#78716c;margin:4px 0 0;">
        (inclui multa de {int(MULTA_PERCENTUAL)}% + juros de {JUROS_MENSAL}% ao mês)
      </p>
    </div>

    <p>Você pode regularizar agora via <strong>PIX</strong>. Para receber o código PIX
       personalizado com o valor de hoje, acesse o portal do aluno ou responda
       esta mensagem com a palavra <strong>PIX</strong>.</p>

    <p style="color:#6b7280;font-size:13px;">
      ⚠️ O valor do PIX é atualizado diariamente conforme os juros acumulados.
      Um código gerado hoje é válido apenas até as 23h59 de hoje.
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#666;font-size:12px;">
      Dúvidas? Entre em contato com o setor financeiro:<br>
      📧 financeiro@fic.edu.br
    </p>
  </div>

  <div style="background:#eee;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
    <p style="color:#999;font-size:11px;margin:0;">
      FIC — Faculdades Integradas de Cassilândia
    </p>
  </div>
</body>
</html>
""".strip()

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            json={
                "from":    f"{EMAIL_NOME_FROM} <{EMAIL_FROM}>",
                "to":      [aluno["email"]],
                "subject": f"[FIC] Mensalidade em atraso — Saldo {vt} em {data}",
                "html":    html,
            },
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        logger.info(f"E-mail dia 1 enviado para {aluno.get('email')}")
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail dia 1 para {aluno.get('email')}: {e}")
        return False


# ---------------------------------------------------------------------------
# Helper: registrar comunicação
# ---------------------------------------------------------------------------
def _registrar_comunicacao(
    supabase,
    cobranca_id: str,
    aluno_id: str,
    tipo: str,
    canal: str,
    status: str,
    mensagem: str,
):
    supabase.table("comunicacoes").insert({
        "cobranca_id": cobranca_id,
        "aluno_id":    aluno_id,
        "tipo":        tipo,
        "canal":       canal,
        "status":      status,
        "conteudo":    mensagem,
    }).execute()
