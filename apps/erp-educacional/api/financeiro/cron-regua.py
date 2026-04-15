"""
Cron — Régua de Cobrança (Escalada de Mensagens)
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A

Endpoint: POST /api/financeiro/cron-regua
Chamado por: Vercel Cron (todo dia às 08:00)

O que faz:
  Para cada cobrança com status 'vencido', calcula o número de dias de atraso
  e, se for um dia de disparo da régua, envia a mensagem correspondente.

Régua de cobrança FIC (dias contados a partir do vencimento):
  Dia  1  (=dia 09) → [E-mail]              Amigável  — "Quer um PIX para hoje?"
  Dia  3  (=dia 11) → [WhatsApp]            Lembrete  — Mesmo tom
  Dia  7  (=dia 15) → [WhatsApp + E-mail]   Atenção   — Informa saldo atual
  Dia 12  (=dia 20) → [WhatsApp]            Urgência  — Cita rematrícula
  Dia 17  (=dia 25) → [E-mail formal]       Institucional — Letterhead FIC
  Dia 22  (=dia 30) → [WhatsApp + E-mail]   Pré-restrição — Avisa bloqueio portal
  Dia 23  (=dia 31) → [Sistema]             Aplica restricao_aluno bloquear_portal

Nota: Fase A envia apenas e-mail. WhatsApp será habilitado na Fase B (Meta Business API).
      Os campos de dias acima referem-se a dias_atraso (dias após vencimento dia 08).
      "dia 09" do calendário = dia 1 de atraso (para boleto com vencimento no dia 08).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
from datetime import date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cron-regua")

# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY       = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM           = os.environ.get("EMAIL_FROM", "financeiro@fic.edu.br")
EMAIL_NOME_FROM      = os.environ.get("EMAIL_NOME_FROM", "FIC — Financeiro")
CRON_SECRET          = os.environ.get("CRON_SECRET", "")

MULTA_PERCENTUAL = float(os.environ.get("MULTA_PERCENTUAL_ATRASO", "10.0"))
JUROS_MENSAL     = float(os.environ.get("JUROS_MENSAL_ATRASO",     "2.0"))

# ---------------------------------------------------------------------------
# Régua: mapeamento dias_atraso → config da mensagem
# ---------------------------------------------------------------------------
REGUA = {
    # dias_atraso: (canais, tom, assunto_email)
    1:  (["email"],          "amigavel",      "Mensalidade em atraso — Regularize via PIX hoje"),
    3:  (["email"],          "lembrete",      "Lembrete: Mensalidade em aberto"),
    7:  (["email"],          "atencao",       "⚠️ Atenção: Saldo atualizado da sua mensalidade"),
    12: (["email"],          "urgencia",      "🔴 Urgente: Débito pode impedir rematrícula"),
    17: (["email"],          "institucional", "Notificação Financeira — Faculdades Integradas de Cassilândia"),
    22: (["email"],          "pre_restricao", "🚨 Aviso de Restrição Iminente — FIC"),
}

DIAS_APLICAR_RESTRICAO_PORTAL = 23


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
            resultado = _executar_regua()
            self._json(200, resultado)
        except Exception as e:
            logger.exception("Erro fatal no cron-regua")
            self._json(500, {"error": str(e)})

    def do_GET(self):
        self._json(200, {"status": "ok", "descricao": "Cron — Régua de Cobrança"})

    def _json(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------
def _executar_regua() -> dict:
    from supabase import create_client
    from decimal import Decimal, ROUND_HALF_UP

    hoje     = date.today()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Busca todas as cobranças vencidas (status='vencido')
    resp = supabase.table("cobrancas") \
        .select("id, aluno_id, valor, data_vencimento, "
                "alunos(id, nome, email, telefone, curso)") \
        .eq("status", "vencido") \
        .eq("tipo", "mensalidade") \
        .execute()

    cobrancas = resp.data or []
    logger.info(f"Cobranças em atraso para régua: {len(cobrancas)}")

    disparos   = 0
    restricoes = 0
    erros      = 0
    erros_log  = []

    for cob in cobrancas:
        try:
            cobranca_id  = cob["id"]
            aluno_id     = cob["aluno_id"]
            aluno        = cob.get("alunos") or {}
            vencimento   = date.fromisoformat(str(cob["data_vencimento"]))
            dias_atraso  = (hoje - vencimento).days

            if dias_atraso <= 0:
                continue

            # Calcular saldo atual
            valor_principal = Decimal(str(cob["valor"]))
            multa_pct  = Decimal(str(MULTA_PERCENTUAL)) / Decimal("100")
            juros_dia  = Decimal(str(JUROS_MENSAL)) / Decimal("100") / Decimal("30")
            dc         = Decimal("0.01")
            multa      = (valor_principal * multa_pct).quantize(dc, rounding=ROUND_HALF_UP)
            juros_acum = (valor_principal * juros_dia * Decimal(str(dias_atraso))).quantize(dc, rounding=ROUND_HALF_UP)
            saldo      = float(valor_principal + multa + juros_acum)

            # --- Aplicar restrição no dia 23 ---
            if dias_atraso == DIAS_APLICAR_RESTRICAO_PORTAL:
                _aplicar_restricao(supabase, aluno_id, cobranca_id, saldo)
                restricoes += 1

            # --- Verificar se é dia de disparo ---
            if dias_atraso not in REGUA:
                continue

            # Verificar se já foi enviado hoje (evita duplo disparo em caso de retry)
            ja_enviado = supabase.table("comunicacoes") \
                .select("id") \
                .eq("cobranca_id", cobranca_id) \
                .eq("tipo", "cobranca_inadimplencia") \
                .gte("created_at", f"{hoje}T00:00:00") \
                .execute()

            if ja_enviado.data:
                logger.info(f"Régua já disparada hoje para cobrança {cobranca_id} — pulando")
                continue

            canais, tom, assunto = REGUA[dias_atraso]
            enviado = False

            if "email" in canais and aluno.get("email"):
                enviado = _enviar_email_regua(
                    aluno, cobranca_id, dias_atraso, saldo, tom, assunto
                )

            # WhatsApp — placeholder para Fase B
            if "whatsapp" in canais:
                logger.info(f"WhatsApp (Fase B) — não implementado ainda. Aluno: {aluno.get('nome')}")

            _registrar_comunicacao(
                supabase, cobranca_id, aluno_id,
                tipo="cobranca_inadimplencia",
                canal="email" if "email" in canais else "whatsapp",
                status="enviado" if enviado else "falhou",
                mensagem=f"Régua dia {dias_atraso} ({tom}). Saldo R$ {saldo:.2f}",
            )

            if enviado:
                disparos += 1

        except Exception as e:
            erros += 1
            erros_log.append(f"Cobrança {cob.get('id')}: {str(e)}")
            logger.exception(f"Erro na régua para cobrança {cob.get('id')}: {e}")

    return {
        "data":       str(hoje),
        "disparos":   disparos,
        "restricoes": restricoes,
        "erros":      erros,
        "erros_log":  erros_log,
        "status":     "concluido" if erros == 0 else "concluido_com_erros",
    }


# ---------------------------------------------------------------------------
# Aplicar restrição de portal
# ---------------------------------------------------------------------------
def _aplicar_restricao(supabase, aluno_id: str, cobranca_id: str, saldo: float):
    """Insere restricao_aluno tipo bloquear_portal (ON CONFLICT DO NOTHING via upsert)."""
    # Verifica se já existe restrição ativa para não duplicar
    existente = supabase.table("restricoes_aluno") \
        .select("id") \
        .eq("aluno_id", aluno_id) \
        .eq("tipo", "bloquear_portal") \
        .eq("ativa", True) \
        .execute()

    if existente.data:
        logger.info(f"Restrição de portal já ativa para aluno {aluno_id}")
        return

    supabase.table("restricoes_aluno").insert({
        "aluno_id":    aluno_id,
        "cobranca_id": cobranca_id,
        "tipo":        "bloquear_portal",
        "motivo":      f"Débito em aberto há 23 dias. Saldo: R$ {saldo:.2f}",
        "ativa":       True,
        "criado_por":  "sistema",
    }).execute()

    logger.info(f"⛔ Restrição de portal aplicada para aluno {aluno_id}")


# ---------------------------------------------------------------------------
# E-mail da régua por tom
# ---------------------------------------------------------------------------
def _enviar_email_regua(
    aluno: dict,
    cobranca_id: str,
    dias_atraso: int,
    saldo: float,
    tom: str,
    assunto: str,
) -> bool:
    if not RESEND_API_KEY or not aluno.get("email"):
        return False

    import requests

    nome     = aluno.get("nome", "Aluno")
    saldo_fmt = f"R$ {saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    data_hoje = date.today().strftime("%d/%m/%Y")

    # Configuração visual por tom
    TOM_CONFIG = {
        "amigavel": {
            "cor":    "#1e40af",
            "emoji":  "😊",
            "titulo": "Seu boleto venceu ontem",
            "corpo":  (
                f"Identificamos que seu boleto não foi pago. Não se preocupe! "
                f"Você pode regularizar agora via PIX, gerando um código personalizado com o valor de hoje."
                f"<br><br>Para gerar o PIX de hoje ({saldo_fmt}), acesse o portal do aluno."
            ),
        },
        "lembrete": {
            "cor":    "#1e40af",
            "emoji":  "🔔",
            "titulo": "Lembrete: Mensalidade em aberto",
            "corpo":  (
                f"Ainda identificamos sua mensalidade em aberto. "
                f"Seu saldo atualizado hoje é de <strong>{saldo_fmt}</strong>.<br><br>"
                f"Acesse o portal para gerar o PIX do dia ou entre em contato conosco."
            ),
        },
        "atencao": {
            "cor":    "#d97706",
            "emoji":  "⚠️",
            "titulo": "Saldo atualizado da sua mensalidade",
            "corpo":  (
                f"Seu débito acumulou juros e multa. O valor de hoje é <strong>{saldo_fmt}</strong>.<br><br>"
                f"Para regularizar, acesse o portal e gere o código PIX válido até as 23h59 de hoje."
            ),
        },
        "urgencia": {
            "cor":    "#dc2626",
            "emoji":  "🔴",
            "titulo": "Débito pode impedir sua rematrícula",
            "corpo":  (
                f"Alertamos que débitos em aberto ao final do semestre podem impedir a renovação de matrícula.<br><br>"
                f"Seu saldo atual é de <strong>{saldo_fmt}</strong> ({dias_atraso} dias de atraso).<br><br>"
                f"Regularize o quanto antes acessando o portal do aluno."
            ),
        },
        "institucional": {
            "cor":    "#1e3a5f",
            "emoji":  "📋",
            "titulo": "Notificação Financeira Formal",
            "corpo":  (
                f"Por meio desta, notificamos o(a) aluno(a) <strong>{nome}</strong> sobre pendência "
                f"financeira no valor de <strong>{saldo_fmt}</strong>, referente à mensalidade em atraso "
                f"há {dias_atraso} dias.<br><br>"
                f"Solicitamos a regularização até o prazo de 5 dias úteis para evitar medidas adicionais."
            ),
        },
        "pre_restricao": {
            "cor":    "#7c3aed",
            "emoji":  "🚨",
            "titulo": "Aviso de Restrição Iminente",
            "corpo":  (
                f"Informamos que, em razão do débito de <strong>{saldo_fmt}</strong> ({dias_atraso} dias), "
                f"o acesso ao portal acadêmico será <strong>suspenso a partir de amanhã</strong>.<br><br>"
                f"Para evitar a restrição, regularize o débito ainda hoje acessando o portal."
            ),
        },
    }

    cfg = TOM_CONFIG.get(tom, TOM_CONFIG["lembrete"])

    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:{cfg['cor']};padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">{cfg['emoji']} {cfg['titulo']}</h2>
    <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;">
      Faculdades Integradas de Cassilândia — Setor Financeiro
    </p>
  </div>

  <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;">
    <p>Olá, <strong>{nome}</strong>!</p>
    <p>{cfg['corpo']}</p>

    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:16px 0;">
      <strong>Saldo em {data_hoje}:</strong>
      <span style="font-size:20px;font-weight:bold;color:#b45309;"> {saldo_fmt}</span>
      <br><small style="color:#78716c;">
        ({dias_atraso} dias de atraso · multa {int(MULTA_PERCENTUAL)}% + juros {JUROS_MENSAL}%/mês acumulados)
      </small>
    </div>

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#666;font-size:12px;">
      Dúvidas? Entre em contato com o setor financeiro:<br>
      📧 financeiro@fic.edu.br
    </p>
  </div>

  <div style="background:#eee;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
    <p style="color:#999;font-size:11px;margin:0;">FIC — Faculdades Integradas de Cassilândia</p>
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
                "subject": f"[FIC] {assunto} — {saldo_fmt}",
                "html":    html,
            },
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        logger.info(f"Régua e-mail ({tom}) enviado para {aluno.get('email')}")
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail régua ({tom}) para {aluno.get('email')}: {e}")
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
