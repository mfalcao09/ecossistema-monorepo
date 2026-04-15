"""
Endpoint — Geração de PIX sob Demanda
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A

Endpoint: POST /api/financeiro/gerar-pix-demanda
Chamado por:
  - Portal do aluno (quando aluno clica "Gerar PIX")
  - Webhook WhatsApp (quando aluno responde "SIM" ou "PIX")

Body esperado (JSON):
  {
    "aluno_id": "uuid-do-aluno",           -- obrigatório
    "canal": "portal" | "whatsapp",        -- obrigatório
    "cobranca_id": "uuid",                 -- opcional: força cobrança específica
  }

Retorno:
  {
    "pix_copia_cola": "00020126...",
    "valor": 1345.60,
    "valido_ate": "2026-05-09",            -- expira às 23:59 deste dia
    "dias_atraso": 1,
    "pix_demanda_id": "uuid",
    "ja_existia": true | false             -- true = reutilizou PIX do dia, false = novo
  }

Regras:
  - Só 1 PIX por cobrança por dia (UNIQUE cobranca_id + data_validade)
  - Se já existe PIX para hoje → retorna o existente (idempotência)
  - Valor = principal + multa + juros acumulados até hoje
  - numDiasAgenda = 0 → expira no próprio dia (Inter baixa às 23:59)
  - Não gera PIX se cobrança já está paga
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
import base64
import time
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gerar-pix-demanda")

# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

INTER_CLIENT_ID      = os.environ.get("INTER_CLIENT_ID", "")
INTER_CLIENT_SECRET  = os.environ.get("INTER_CLIENT_SECRET", "")
INTER_ACCOUNT_NUMBER = os.environ.get("INTER_ACCOUNT_NUMBER", "")
INTER_CERT_BASE64    = os.environ.get("INTER_CERT_BASE64", "")
INTER_KEY_BASE64     = os.environ.get("INTER_KEY_BASE64", "")
INTER_ENVIRONMENT    = os.environ.get("INTER_ENVIRONMENT", "SANDBOX")

INTER_BASE_URLS = {
    "SANDBOX":    "https://cdpj-sandbox.partners.uatinter.co",
    "PRODUCTION": "https://cdpj.partners.bancointer.com.br",
    "UAT":        "https://cdpj.partners.uatbi.com.br",
}

MULTA_PERCENTUAL = float(os.environ.get("MULTA_PERCENTUAL_ATRASO", "10.0"))
JUROS_MENSAL     = float(os.environ.get("JUROS_MENSAL_ATRASO",     "2.0"))

_token_cache: dict = {}


# ---------------------------------------------------------------------------
# Handler Vercel
# ---------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length)) if length else {}
        except Exception:
            self._json(400, {"error": "Body JSON inválido"})
            return

        aluno_id = body.get("aluno_id", "").strip()
        canal    = body.get("canal", "portal").strip()
        cobranca_id_forçada = body.get("cobranca_id", "").strip() or None

        if not aluno_id:
            self._json(400, {"error": "aluno_id é obrigatório"})
            return
        if canal not in ("portal", "whatsapp"):
            self._json(400, {"error": "canal deve ser 'portal' ou 'whatsapp'"})
            return

        try:
            resultado = _gerar_pix(aluno_id, canal, cobranca_id_forçada)
            self._json(200, resultado)
        except ValueError as e:
            self._json(422, {"error": str(e)})
        except Exception as e:
            logger.exception("Erro ao gerar PIX sob demanda")
            self._json(500, {"error": str(e)})

    def do_GET(self):
        self._json(200, {"status": "ok", "descricao": "Endpoint — PIX sob Demanda"})

    def _json(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------
def _gerar_pix(aluno_id: str, canal: str, cobranca_id_forçada: str | None) -> dict:
    from supabase import create_client

    hoje     = date.today()
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 1. Buscar cobrança vencida do aluno
    if cobranca_id_forçada:
        q = supabase.table("cobrancas") \
            .select("id, aluno_id, valor, data_vencimento, alunos(nome, cpf, email, telefone, endereco, cidade, uf, cep)") \
            .eq("id", cobranca_id_forçada) \
            .eq("aluno_id", aluno_id) \
            .single() \
            .execute()
        cobranca = q.data
    else:
        # Pega a cobrança vencida mais antiga não paga
        q = supabase.table("cobrancas") \
            .select("id, aluno_id, valor, data_vencimento, alunos(nome, cpf, email, telefone, endereco, cidade, uf, cep)") \
            .eq("aluno_id", aluno_id) \
            .eq("tipo", "mensalidade") \
            .eq("status", "vencido") \
            .order("data_vencimento") \
            .limit(1) \
            .execute()
        cobranca = (q.data or [None])[0]

    if not cobranca:
        raise ValueError("Nenhuma cobrança vencida encontrada para este aluno")

    cobranca_id = cobranca["id"]
    aluno       = cobranca.get("alunos") or {}
    vencimento  = date.fromisoformat(str(cobranca["data_vencimento"]))
    dias_atraso = (hoje - vencimento).days

    if dias_atraso <= 0:
        raise ValueError("Esta cobrança ainda não venceu")

    # 2. Calcular valor do dia
    valor_principal = Decimal(str(cobranca["valor"]))
    multa, juros_acum, valor_total = _calcular_encargos(valor_principal, dias_atraso)

    # 3. Verificar se já existe PIX ativo para hoje
    pix_existente = supabase.table("pix_demanda") \
        .select("id, pix_copia_cola, valor, data_validade, status") \
        .eq("cobranca_id", cobranca_id) \
        .eq("data_validade", str(hoje)) \
        .eq("status", "ativo") \
        .execute()

    if pix_existente.data:
        pix = pix_existente.data[0]
        logger.info(f"PIX já existia para hoje — retornando existente (id: {pix['id']})")
        return {
            "pix_copia_cola":  pix["pix_copia_cola"],
            "valor":           float(pix["valor"]),
            "valido_ate":      str(hoje),
            "dias_atraso":     dias_atraso,
            "pix_demanda_id":  pix["id"],
            "ja_existia":      True,
        }

    # 4. Preparar certificados e token Inter
    cert_path, key_path = _prepare_certs()
    token = _get_inter_token(cert_path, key_path, "boleto-cobranca.read boleto-cobranca.write")

    # 5. Emitir PIX com vencimento = hoje, numDiasAgenda = 0
    your_number = _gerar_pix_number(aluno_id, hoje)
    emissao = _emitir_pix_inter(cert_path, key_path, token, aluno, valor_total, hoje, your_number, cobranca)
    request_code = emissao.get("codigoSolicitacao")

    # 6. Recuperar detalhes (pixCopiaECola, txid)
    detalhes = _recuperar_detalhes(cert_path, key_path, token, request_code)
    pix_copia_cola = detalhes.get("pix_copia_cola", "")
    txid           = detalhes.get("txid", "")

    # 7. Salvar em pix_demanda
    insert_resp = supabase.table("pix_demanda").insert({
        "cobranca_id":            cobranca_id,
        "aluno_id":               aluno_id,
        "inter_request_code":     request_code,
        "txid":                   txid,
        "pix_copia_cola":         pix_copia_cola,
        "valor":                  str(valor_total),
        "data_validade":          str(hoje),
        "canal_solicitacao":      canal,
        "dias_atraso_no_momento": dias_atraso,
        "status":                 "ativo",
    }).execute()

    pix_demanda_id = (insert_resp.data or [{}])[0].get("id", "")

    # 8. Registrar comunicação
    _registrar_comunicacao(
        supabase, cobranca_id, aluno_id,
        tipo="pix_demanda_enviado",
        canal=canal,
        status="enviado",
        mensagem=f"PIX sob demanda gerado via {canal} — Dia {dias_atraso} de atraso — R$ {valor_total:.2f}",
    )

    logger.info(f"PIX gerado: {request_code} | aluno {aluno_id} | valor R$ {valor_total:.2f} | válido {hoje}")

    return {
        "pix_copia_cola":  pix_copia_cola,
        "valor":           float(valor_total),
        "valido_ate":      str(hoje),
        "dias_atraso":     dias_atraso,
        "pix_demanda_id":  pix_demanda_id,
        "ja_existia":      False,
    }


# ---------------------------------------------------------------------------
# Cálculo de encargos (mesma lógica do cron-inadimplencia)
# ---------------------------------------------------------------------------
def _calcular_encargos(
    valor_principal: Decimal,
    dias_atraso: int,
) -> tuple[Decimal, Decimal, Decimal]:
    D = Decimal
    dois_casas = Decimal("0.01")

    multa_pct  = D(str(MULTA_PERCENTUAL)) / D("100")
    juros_dia  = D(str(JUROS_MENSAL)) / D("100") / D("30")

    multa      = (valor_principal * multa_pct).quantize(dois_casas, rounding=ROUND_HALF_UP)
    juros_acum = (valor_principal * juros_dia * D(str(dias_atraso))).quantize(dois_casas, rounding=ROUND_HALF_UP)
    total      = (valor_principal + multa + juros_acum).quantize(dois_casas, rounding=ROUND_HALF_UP)

    return multa, juros_acum, total


# ---------------------------------------------------------------------------
# Certificados mTLS
# ---------------------------------------------------------------------------
def _prepare_certs() -> tuple[str, str]:
    cert_path = "/tmp/inter_cert.crt"
    key_path  = "/tmp/inter_key.key"
    with open(cert_path, "wb") as f:
        f.write(base64.b64decode(INTER_CERT_BASE64))
    with open(key_path, "wb") as f:
        f.write(base64.b64decode(INTER_KEY_BASE64))
    return cert_path, key_path


# ---------------------------------------------------------------------------
# Token OAuth2
# ---------------------------------------------------------------------------
def _get_inter_token(cert_path: str, key_path: str, scope: str) -> str:
    import requests

    cache_key = f"{INTER_CLIENT_ID}:{scope}"
    cached = _token_cache.get(cache_key)
    if cached and cached.get("expires_at", 0) > time.time() + 60:
        return cached["access_token"]

    base_url  = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    resp = requests.post(
        f"{base_url}/oauth/v2/token",
        data={
            "client_id":     INTER_CLIENT_ID,
            "client_secret": INTER_CLIENT_SECRET,
            "grant_type":    "client_credentials",
            "scope":         scope,
        },
        cert=(cert_path, key_path),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    data["expires_at"] = time.time() + int(data.get("expires_in", 3600))
    _token_cache[cache_key] = data
    return data["access_token"]


# ---------------------------------------------------------------------------
# Emitir PIX de atraso no Inter
# ---------------------------------------------------------------------------
def _emitir_pix_inter(
    cert_path: str,
    key_path: str,
    token: str,
    aluno: dict,
    valor_total: Decimal,
    hoje: date,
    your_number: str,
    cobranca: dict,
) -> dict:
    import requests

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    headers  = {
        "Authorization":    f"Bearer {token}",
        "Content-Type":     "application/json",
        "x-conta-corrente": INTER_ACCOUNT_NUMBER,
    }

    cpf_cnpj   = (aluno.get("cpf") or "").replace(".", "").replace("-", "").replace("/", "")
    tipo_pessoa = "JURIDICA" if len(cpf_cnpj) > 11 else "FISICA"
    telefone_raw = aluno.get("telefone", "")
    ddd      = telefone_raw[:2] if len(telefone_raw) >= 10 else ""
    telefone = telefone_raw[2:] if len(telefone_raw) >= 10 else telefone_raw

    pagador = {k: v for k, v in {
        "cpfCnpj":    cpf_cnpj,
        "tipoPessoa": tipo_pessoa,
        "nome":       aluno.get("nome", ""),
        "email":      aluno.get("email", ""),
        "endereco":   aluno.get("endereco", ""),
        "cidade":     aluno.get("cidade", ""),
        "uf":         aluno.get("uf", ""),
        "cep":        (aluno.get("cep") or "").replace("-", ""),
        "ddd":        ddd,
        "telefone":   telefone,
    }.items() if v}

    # Mensagem do PIX
    venc_orig = cobranca.get("data_vencimento", "")
    mensagem = {
        "linha1": "FIC — Regularização de Mensalidade em Atraso",
        "linha2": f"Aluno: {aluno.get('nome', '')}",
        "linha3": f"Vencimento original: {venc_orig} | Válido até: {hoje.strftime('%d/%m/%Y')} 23h59",
        "linha4": "Este código expira ao final do dia. Um novo código será gerado amanhã.",
        "linha5": "Dúvidas: financeiro@fic.edu.br",
    }

    payload = {
        "seuNumero":      your_number,
        "valorNominal":   f"{float(valor_total):.2f}",
        "dataVencimento": str(hoje),
        "numDiasAgenda":  0,           # expira no próprio dia às 23:59
        "multa":          {"codigo": "NAOTEMMULTA"},
        "mora":           {"codigo": "ISENTO"},
        "pagador":        pagador,
        "mensagem":       mensagem,
    }

    resp = requests.post(
        f"{base_url}/cobranca/v3/cobrancas",
        json=payload,
        headers=headers,
        cert=(cert_path, key_path),
        timeout=30,
    )
    if not resp.ok:
        logger.error(f"Erro Inter ao emitir PIX: {resp.status_code} {resp.text}")
        resp.raise_for_status()

    return resp.json()


# ---------------------------------------------------------------------------
# Recuperar detalhes do PIX emitido
# ---------------------------------------------------------------------------
def _recuperar_detalhes(cert_path: str, key_path: str, token: str, request_code: str) -> dict:
    import requests

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    resp = requests.get(
        f"{base_url}/cobranca/v3/cobrancas/{request_code}",
        headers={
            "Authorization":    f"Bearer {token}",
            "x-conta-corrente": INTER_ACCOUNT_NUMBER,
        },
        cert=(cert_path, key_path),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    return {
        "linha_digitavel": data.get("boleto", {}).get("linhaDigitavel", ""),
        "codigo_barras":   data.get("boleto", {}).get("codigoBarras", ""),
        "pix_copia_cola":  data.get("pix", {}).get("pixCopiaECola", ""),
        "txid":            data.get("pix", {}).get("txid", ""),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _gerar_pix_number(aluno_id: str, hoje: date) -> str:
    """
    Chave única por aluno × dia para o Inter.
    Formato: PIXD{ALUNO6}{YYYYMMDD} = 4+6+8 = 18 chars (máx 15 do Inter...)
    Usar PXXX{ALUNO5}{YYYYMMDD} = 4+5+8 = 17 — ainda grande demais.
    Formato final: P{ALUNO7}{YYYYMMDD} = 1+7+8 = 16 — 1 char acima do limite.
    Usando: PD{ALUNO5}{YYYYMMDD} = 2+5+8 = 15 ✅
    """
    aluno_curto = aluno_id.replace("-", "")[:5].upper()
    return f"PD{aluno_curto}{hoje.strftime('%Y%m%d')}"


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
