"""
Agente 1 — Emissão de Cobranças (Contas a Receber)
Módulo Financeiro FIC — MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A

Endpoint: POST /api/financeiro/emit-boletos
Chamado por: Vercel Cron (dia 20 de cada mês, 9h) ou manualmente

Fluxo (F1 — Emissão e Envio Mensal):
  1. Decodifica certificados mTLS do Banco Inter (base64 → temp files)
  2. Obtém token OAuth2 do Inter (cache em memória)
  3. Busca alunos ativos no Supabase sem cobrança do mês corrente
  4. Para cada aluno:
       a. Emite Bolepix no Banco Inter (POST /cobranca/v3/cobrancas)
       b. Recupera detalhes (linhaDigitavel, pixCopiaECola)
       c. Baixa PDF do boleto
       d. Salva PDF no Supabase Storage (bucket: bolepix-pdfs)
       e. Registra cobrança na tabela `cobrancas`
       f. Envia por e-mail via Resend (Fase A)
  5. Retorna relatório da emissão

Status: ✅ S-02 — Implementação completa. Aguardando credenciais Inter sandbox.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import logging
import tempfile
import base64
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

# ---------------------------------------------------------------------------
# Configuração de logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("emit-boletos")


# ---------------------------------------------------------------------------
# Variáveis de ambiente
# ---------------------------------------------------------------------------
# Banco Inter — mTLS (certificados chegam como base64 das variáveis Vercel)
INTER_CLIENT_ID      = os.environ.get("INTER_CLIENT_ID", "")
INTER_CLIENT_SECRET  = os.environ.get("INTER_CLIENT_SECRET", "")
INTER_ACCOUNT_NUMBER = os.environ.get("INTER_ACCOUNT_NUMBER", "")
INTER_CERT_BASE64    = os.environ.get("INTER_CERT_BASE64", "")   # cert.crt em base64
INTER_KEY_BASE64     = os.environ.get("INTER_KEY_BASE64", "")    # chave.key em base64
INTER_ENVIRONMENT    = os.environ.get("INTER_ENVIRONMENT", "SANDBOX")

# URLs do Banco Inter por ambiente
INTER_BASE_URLS = {
    "SANDBOX":    "https://cdpj-sandbox.partners.uatinter.co",
    "PRODUCTION": "https://cdpj.partners.bancointer.com.br",
    "UAT":        "https://cdpj.partners.uatbi.com.br",
}

# Supabase
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# E-mail via Resend
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM     = os.environ.get("EMAIL_FROM", "financeiro@fic.edu.br")
EMAIL_NOME_FROM = os.environ.get("EMAIL_NOME_FROM", "FIC — Financeiro")

# Cron secret (Vercel passa automaticamente via Authorization: Bearer)
CRON_SECRET = os.environ.get("CRON_SECRET", "")

# FIC — config financeira
DIA_VENCIMENTO_PADRAO = int(os.environ.get("DIA_VENCIMENTO_PADRAO", "10"))
MULTA_PERCENTUAL      = float(os.environ.get("MULTA_PERCENTUAL", "2.00"))   # 2%
JUROS_MENSAL          = float(os.environ.get("JUROS_MENSAL", "1.00"))       # 1% ao mês

# Cache de token em memória (evita requisição a cada boleto)
_token_cache: dict = {}


# ---------------------------------------------------------------------------
# Handler principal (Vercel Serverless Function — Python)
# ---------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        """Emite Bolepix para todos os alunos ativos do mês corrente."""

        # 1. Validar autorização do cron
        auth_header = self.headers.get("Authorization", "")
        if CRON_SECRET and auth_header != f"Bearer {CRON_SECRET}":
            self._send_json(401, {"error": "Não autorizado"})
            return

        # 2. Verificar configuração mínima
        config_check = _check_config()
        if not config_check["ok"]:
            logger.error(f"Config incompleta: {config_check['missing']}")
            self._send_json(500, {
                "error": "Configuração incompleta",
                "missing": config_check["missing"],
                "hint": "Configure as variáveis de ambiente no painel Vercel"
            })
            return

        # 3. Executar emissão
        try:
            resultado = _emitir_boletos_mes_corrente()
            self._send_json(200, resultado)
        except Exception as e:
            logger.exception("Erro fatal na emissão de boletos")
            self._send_json(500, {"error": str(e)})

    def do_GET(self):
        """Health check e status da configuração."""
        config_check = _check_config()
        self._send_json(200, {
            "status": "ok" if config_check["ok"] else "config_pendente",
            "ambiente": INTER_ENVIRONMENT,
            "config": config_check
        })

    def _send_json(self, status_code: int, body: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())


# ---------------------------------------------------------------------------
# Verificação de configuração
# ---------------------------------------------------------------------------
def _check_config() -> dict:
    """Verifica se todas as variáveis de ambiente necessárias estão configuradas."""
    required = {
        "INTER_CLIENT_ID":         INTER_CLIENT_ID,
        "INTER_CLIENT_SECRET":     INTER_CLIENT_SECRET,
        "INTER_ACCOUNT_NUMBER":    INTER_ACCOUNT_NUMBER,
        "INTER_CERT_BASE64":       INTER_CERT_BASE64,
        "INTER_KEY_BASE64":        INTER_KEY_BASE64,
        "SUPABASE_URL":            SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_KEY,
    }
    missing = [k for k, v in required.items() if not v]
    return {
        "ok": len(missing) == 0,
        "missing": missing,
        "ambiente": INTER_ENVIRONMENT,
        "configurado": [k for k in required if required[k]]
    }


# ---------------------------------------------------------------------------
# Certificados mTLS — decodifica base64 e escreve em arquivos temporários
# ---------------------------------------------------------------------------
def _prepare_certs() -> tuple[str, str]:
    """
    Decodifica os certificados mTLS do Banco Inter das variáveis de ambiente.
    Retorna (cert_path, key_path) — caminhos de arquivos temporários.

    O Inter exige autenticação mTLS (certificado X.509 + chave privada).
    Armazenamos como base64 no Vercel para não depender de arquivos em disco.
    """
    cert_bytes = base64.b64decode(INTER_CERT_BASE64)
    key_bytes  = base64.b64decode(INTER_KEY_BASE64)

    # Escrever em /tmp (único diretório gravável no Vercel serverless)
    cert_path = "/tmp/inter_cert.crt"
    key_path  = "/tmp/inter_key.key"

    with open(cert_path, "wb") as f:
        f.write(cert_bytes)
    with open(key_path, "wb") as f:
        f.write(key_bytes)

    return cert_path, key_path


# ---------------------------------------------------------------------------
# OAuth2 — obter token do Banco Inter (com cache)
# ---------------------------------------------------------------------------
def _get_inter_token(cert_path: str, key_path: str, scope: str) -> str:
    """
    Obtém token OAuth2 do Banco Inter.
    Cache em memória: evita requisição nova a cada boleto na mesma execução.

    Escopos necessários:
    - boleto-cobranca.read  (leitura de cobranças)
    - boleto-cobranca.write (emissão de cobranças)
    """
    import requests
    import time

    cache_key = f"{INTER_CLIENT_ID}:{scope}"
    cached = _token_cache.get(cache_key)
    if cached and cached.get("expires_at", 0) > time.time() + 60:
        return cached["access_token"]

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    token_url = f"{base_url}/oauth/v2/token"

    resp = requests.post(
        token_url,
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
    expires_in = int(data.get("expires_in", 3600))
    data["expires_at"] = time.time() + expires_in
    _token_cache[cache_key] = data

    logger.info(f"Token Inter obtido. Expira em {expires_in}s.")
    return data["access_token"]


# ---------------------------------------------------------------------------
# Emissão de Bolepix — chamada à API do Inter
# ---------------------------------------------------------------------------
def _emitir_bolepix(
    cert_path: str,
    key_path: str,
    token: str,
    desconto_percentual: float = 0.0,
    aluno: dict,
    vencimento: date,
    your_number: str,
) -> dict:
    """
    Emite um Bolepix no Banco Inter para um aluno.
    Retorna o payload completo da resposta (incluindo codigoSolicitacao).

    Documentação: POST /cobranca/v3/cobrancas
    """
    import requests

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    url = f"{base_url}/cobranca/v3/cobrancas"

    headers = {
        "Authorization":       f"Bearer {token}",
        "Content-Type":        "application/json",
        "x-conta-corrente":    INTER_ACCOUNT_NUMBER,
    }

    # Monta payload do pagador
    # PersonType: FISICA (CPF) ou JURIDICA (CNPJ)
    # Detecta pelo tamanho do CPF/CNPJ
    cpf_cnpj = aluno.get("cpf", "").replace(".", "").replace("-", "").replace("/", "")
    tipo_pessoa = "JURIDICA" if len(cpf_cnpj) > 11 else "FISICA"

    # Extrai DDD e telefone (formato: "67912345678" → ddd="67", tel="912345678")
    telefone_raw = aluno.get("telefone", "")
    ddd = telefone_raw[:2] if len(telefone_raw) >= 10 else ""
    telefone = telefone_raw[2:] if len(telefone_raw) >= 10 else telefone_raw

    pagador = {
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
    }

    # Remove campos None/vazios do pagador (Inter rejeita campos nulos)
    pagador = {k: v for k, v in pagador.items() if v}

    # Multa: SEM multa no boleto — tratada internamente pela régua de cobrança.
    # Boleto expira no próprio dia do vencimento (numDiasAgenda=0).
    multa = {"codigo": "NAOTEMMULTA"}

    # Mora (juros): ISENTO no boleto — calculado internamente em inadimplencia_diaria.
    mora = {"codigo": "ISENTO"}

    # Desconto de pontualidade: válido até o próprio vencimento (quantidadeDias=0).
    # Só inclui o bloco se o aluno tiver desconto cadastrado.
    desconto = None
    if desconto_percentual and desconto_percentual > 0:
        desconto = {
            "codigo":          "PERCENTUAL",
            "quantidadeDias":  0,         # desconto válido até o dia do vencimento inclusive
            "taxa":            round(desconto_percentual, 2),
        }

    # Mensagem no boleto (até 5 linhas)
    mensagem = {
        "linha1": "Mensalidade FIC — Faculdades Integradas de Cassilândia",
        "linha2": f"Aluno: {aluno.get('nome', '')}",
        "linha3": f"Curso: {aluno.get('curso', '')} | Ref.: {vencimento.strftime('%m/%Y')}",
        "linha4": "Em caso de dúvidas: financeiro@fic.edu.br",
        "linha5": "",
    }

    # Valor nominal = mensalidade cheia (o Inter aplica o desconto automaticamente
    # se pago até quantidadeDias antes do vencimento, conforme bloco desconto acima).
    valor_nominal = float(aluno.get("valor_mensalidade", 0))

    payload = {
        "seuNumero":       your_number,
        "valorNominal":    f"{valor_nominal:.2f}",
        "dataVencimento":  vencimento.strftime("%Y-%m-%d"),
        "numDiasAgenda":   0,     # expira no próprio vencimento — dia 09 já não aceita pagamento
        "pagador":         pagador,
        "multa":           multa,
        "mora":            mora,
        "mensagem":        mensagem,
    }

    # Adiciona desconto apenas se configurado
    if desconto:
        payload["desconto"] = desconto

    resp = requests.post(
        url,
        json=payload,
        headers=headers,
        cert=(cert_path, key_path),
        timeout=30,
    )

    if not resp.ok:
        logger.error(f"Erro Inter ao emitir boleto para {aluno.get('nome')}: {resp.status_code} {resp.text}")
        resp.raise_for_status()

    return resp.json()


# ---------------------------------------------------------------------------
# Recuperar detalhes do Bolepix (linhaDigitável, pixCopiaECola)
# ---------------------------------------------------------------------------
def _recuperar_detalhes_bolepix(
    cert_path: str,
    key_path: str,
    token: str,
    request_code: str,
) -> dict:
    """
    Recupera os detalhes do Bolepix emitido.
    Retorna dict com: linhaDigitavel, codigoBarras, pixCopiaECola, txid.

    Documentação: GET /cobranca/v3/cobrancas/{requestCode}
    """
    import requests

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    url = f"{base_url}/cobranca/v3/cobrancas/{request_code}"

    headers = {
        "Authorization":    f"Bearer {token}",
        "x-conta-corrente": INTER_ACCOUNT_NUMBER,
    }

    resp = requests.get(url, headers=headers, cert=(cert_path, key_path), timeout=15)
    resp.raise_for_status()

    data = resp.json()

    boleto = data.get("boleto", {})
    pix    = data.get("pix", {})

    return {
        "linha_digitavel":  boleto.get("linhaDigitavel", ""),
        "codigo_barras":    boleto.get("codigoBarras", ""),
        "pix_copia_cola":   pix.get("pixCopiaECola", ""),
        "txid":             pix.get("txid", ""),
    }


# ---------------------------------------------------------------------------
# Baixar PDF do Bolepix
# ---------------------------------------------------------------------------
def _baixar_pdf_bolepix(
    cert_path: str,
    key_path: str,
    token: str,
    request_code: str,
) -> bytes:
    """
    Baixa o PDF do Bolepix como bytes.

    Documentação: GET /cobranca/v3/cobrancas/{requestCode}/pdf
    Resposta: { "pdf": "<base64>" }
    """
    import requests

    base_url = INTER_BASE_URLS.get(INTER_ENVIRONMENT, INTER_BASE_URLS["SANDBOX"])
    url = f"{base_url}/cobranca/v3/cobrancas/{request_code}/pdf"

    headers = {
        "Authorization":    f"Bearer {token}",
        "x-conta-corrente": INTER_ACCOUNT_NUMBER,
    }

    resp = requests.get(url, headers=headers, cert=(cert_path, key_path), timeout=15)
    resp.raise_for_status()

    data = resp.json()
    pdf_base64 = data.get("pdf", "")
    return base64.b64decode(pdf_base64)


# ---------------------------------------------------------------------------
# Salvar PDF no Supabase Storage
# ---------------------------------------------------------------------------
def _salvar_pdf_supabase(
    supabase,
    aluno_id: str,
    mes_referencia: date,
    request_code: str,
    pdf_bytes: bytes,
) -> str:
    """
    Salva o PDF do Bolepix no Supabase Storage.
    Bucket: bolepix-pdfs
    Caminho: {aluno_id}/{YYYY-MM}/{request_code}.pdf

    Retorna a URL pública do arquivo.
    """
    bucket = "bolepix-pdfs"
    path = f"{aluno_id}/{mes_referencia.strftime('%Y-%m')}/{request_code}.pdf"

    # Upload do PDF
    supabase.storage.from_(bucket).upload(
        path=path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )

    # Obter URL pública
    public_url = supabase.storage.from_(bucket).get_public_url(path)
    return public_url


# ---------------------------------------------------------------------------
# Registrar cobrança no Supabase
# ---------------------------------------------------------------------------
def _registrar_cobranca(
    supabase,
    aluno: dict,
    mes_referencia: date,
    vencimento: date,
    request_code: str,
    your_number: str,
    detalhes: dict,
    pdf_url: str,
    desconto_aplicado: float = 0.0,
) -> str:
    """
    Insere o registro da cobrança na tabela `cobrancas`.
    Retorna o ID da cobrança criada.

    valor = mensalidade cheia (o Inter aplica desconto internamente).
    desconto_aplicado = snapshot do % de desconto no momento da emissão.
    """
    valor_mensalidade = float(aluno.get("valor_mensalidade", 0))

    cobranca = {
        "aluno_id":                aluno["id"],
        "inter_request_code":      request_code,
        "your_number":             your_number,
        "tipo":                    "mensalidade",
        "valor":                   f"{valor_mensalidade:.2f}",
        "desconto_aplicado":       desconto_aplicado if desconto_aplicado > 0 else None,
        "mes_referencia":          str(mes_referencia),
        "data_vencimento":         str(vencimento),
        "status":                  "enviado",
        "bolepix_pdf_url":         pdf_url,
        "bolepix_linha_digitavel": detalhes.get("linha_digitavel", ""),
        "bolepix_pix_copia_cola":  detalhes.get("pix_copia_cola", ""),
    }

    resp = supabase.table("cobrancas").insert(cobranca).execute()

    if resp.data:
        return resp.data[0]["id"]
    raise RuntimeError(f"Falha ao inserir cobrança para aluno {aluno['id']}")


# ---------------------------------------------------------------------------
# Registrar comunicação enviada
# ---------------------------------------------------------------------------
def _registrar_comunicacao(
    supabase,
    cobranca_id: str,
    aluno_id: str,
    canal: str,
    status: str,
    mensagem: str,
    tipo: str = "envio_boleto",
):
    """Registra log de comunicação enviada ao aluno."""
    supabase.table("comunicacoes").insert({
        "cobranca_id": cobranca_id,
        "aluno_id":    aluno_id,
        "tipo":        tipo,
        "canal":       canal,
        "status":      status,
        "conteudo":    mensagem,
    }).execute()


# ---------------------------------------------------------------------------
# Enviar e-mail via Resend (Fase A)
# ---------------------------------------------------------------------------
def _enviar_email_bolepix(
    aluno: dict,
    cobranca_id: str,
    mes_referencia: date,
    vencimento: date,
    valor: str,
    linha_digitavel: str,
    pix_copia_cola: str,
    pdf_url: str,
    desconto_percentual: float = 0.0,
) -> bool:
    """
    Envia o Bolepix por e-mail via Resend API.

    Fase A: apenas e-mail (WhatsApp será implementado na Fase B com Meta Business API).
    Retorna True se enviado com sucesso.
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY não configurado — e-mail não enviado")
        return False

    import requests

    email_aluno = aluno.get("email", "")
    if not email_aluno:
        logger.warning(f"Aluno {aluno.get('nome')} sem e-mail cadastrado — pulando envio")
        return False

    nome_aluno = aluno.get("nome", "Aluno")
    mes_ano = mes_referencia.strftime("%B/%Y").capitalize()
    valor_fmt = f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    venc_fmt = vencimento.strftime("%d/%m/%Y")

    # Linha de desconto para exibir no e-mail (só se houver desconto)
    desconto_html = ""
    if desconto_percentual and desconto_percentual > 0:
        valor_cheio = float(aluno.get("valor_mensalidade", 0))
        valor_cheio_fmt = f"R$ {valor_cheio:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        desconto_html = f"""
        <tr><td style="color:#666;padding:4px 0;">Desconto pontualidade:</td>
            <td style="color:#16a34a;font-weight:bold;">- {int(desconto_percentual)}% (valor cheio: {valor_cheio_fmt})</td></tr>
        <tr><td style="color:#666;padding:4px 0;">⚠️ Válido até:</td>
            <td style="color:#b91c1c;font-weight:bold;">{venc_fmt} — após esta data o boleto é cancelado automaticamente</td></tr>
        """

    # HTML do e-mail
    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="color: white; margin: 0;">Faculdades Integradas de Cassilândia</h2>
    <p style="color: #a0c4ff; margin: 5px 0 0;">Setor Financeiro</p>
  </div>

  <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0;">
    <p>Olá, <strong>{nome_aluno}</strong>!</p>
    <p>Sua mensalidade referente a <strong>{mes_ano}</strong> está disponível para pagamento.</p>

    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="color: #666; padding: 4px 0;">Valor com desconto:</td>
            <td style="font-weight: bold; color: #1e3a5f;">{valor_fmt}</td></tr>
        {desconto_html}
        <tr><td style="color: #666; padding: 4px 0;">Vencimento:</td>
            <td style="font-weight: bold;">{venc_fmt}</td></tr>
      </table>
    </div>

    <p><strong>Pagar com PIX (copia e cola):</strong></p>
    <div style="background: #eef4ff; border: 1px solid #b3cde0; border-radius: 4px; padding: 12px;
                word-break: break-all; font-family: monospace; font-size: 12px;">
      {pix_copia_cola}
    </div>

    <p style="margin-top: 16px;"><strong>Pagar com Boleto (linha digitável):</strong></p>
    <div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 12px;
                word-break: break-all; font-family: monospace; font-size: 12px;">
      {linha_digitavel}
    </div>

    <p style="margin-top: 20px;">
      <a href="{pdf_url}" style="background: #1e3a5f; color: white; padding: 10px 20px;
         text-decoration: none; border-radius: 4px; display: inline-block;">
        📄 Baixar PDF do Boleto
      </a>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      Em caso de dúvidas, entre em contato com o setor financeiro:<br>
      📧 financeiro@fic.edu.br
    </p>
  </div>

  <div style="background: #eee; padding: 12px; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="color: #999; font-size: 11px; margin: 0;">
      FIC — Faculdades Integradas de Cassilândia | CNPJ: 00.000.000/0001-00
    </p>
  </div>
</body>
</html>
    """.strip()

    payload = {
        "from":    f"{EMAIL_NOME_FROM} <{EMAIL_FROM}>",
        "to":      [email_aluno],
        "subject": f"[FIC] Mensalidade {mes_ano} — Vencimento {venc_fmt}",
        "html":    html,
    }

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        logger.info(f"E-mail enviado para {email_aluno} (cobrança {cobranca_id})")
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail para {email_aluno}: {e}")
        return False


# ---------------------------------------------------------------------------
# Lógica principal de emissão
# ---------------------------------------------------------------------------
def _emitir_boletos_mes_corrente() -> dict:
    """
    Emite Bolepix para todos os alunos ativos que ainda não têm cobrança
    gerada para o mês corrente.
    """
    from supabase import create_client

    hoje           = date.today()
    mes_referencia = date(hoje.year, hoje.month, 1)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # ----- 1. Busca alunos ativos -----
    alunos_resp = supabase.table("alunos") \
        .select("id, nome, cpf, email, telefone, valor_mensalidade, dia_vencimento, "
                "desconto_pontualidade, endereco, cidade, uf, cep, curso") \
        .eq("status", "ativo") \
        .execute()

    alunos = alunos_resp.data or []
    logger.info(f"Alunos ativos: {len(alunos)}")

    if not alunos:
        return {
            "mes_referencia": str(mes_referencia),
            "alunos_processados": 0,
            "boletos_emitidos": 0,
            "boletos_ja_existiam": 0,
            "erros": 0,
            "mensagem": "Nenhum aluno ativo encontrado",
        }

    # ----- 2. Verifica quais já têm cobrança no mês -----
    cobrancas_resp = supabase.table("cobrancas") \
        .select("aluno_id") \
        .eq("mes_referencia", str(mes_referencia)) \
        .in_("status", ["gerado", "enviado", "pago"]) \
        .execute()

    alunos_com_cobranca = {c["aluno_id"] for c in (cobrancas_resp.data or [])}
    alunos_para_emitir = [a for a in alunos if a["id"] not in alunos_com_cobranca]

    logger.info(f"A emitir: {len(alunos_para_emitir)} | Já existem: {len(alunos_com_cobranca)}")

    if not alunos_para_emitir:
        return {
            "mes_referencia": str(mes_referencia),
            "alunos_processados": len(alunos),
            "boletos_emitidos": 0,
            "boletos_ja_existiam": len(alunos_com_cobranca),
            "erros": 0,
            "mensagem": "Todas as cobranças deste mês já foram emitidas anteriormente.",
        }

    # ----- 3. Preparar certificados mTLS -----
    cert_path, key_path = _prepare_certs()

    # ----- 4. Obter token OAuth2 -----
    token = _get_inter_token(
        cert_path, key_path,
        "boleto-cobranca.read boleto-cobranca.write"
    )

    # ----- 5. Emitir boletos -----
    emitidos   = 0
    erros      = 0
    erros_log  = []

    for aluno in alunos_para_emitir:
        try:
            aluno_id = aluno["id"]
            dia_vcto = aluno.get("dia_vencimento") or DIA_VENCIMENTO_PADRAO
            vencimento = _calcular_vencimento(dia_vcto, mes_referencia)
            your_number = _gerar_your_number(aluno_id, mes_referencia)

            # 5a. Calcular desconto e valor a cobrar
            desconto_pct = float(aluno.get("desconto_pontualidade") or 0)
            valor_cheio  = float(aluno.get("valor_mensalidade", 0))
            # Valor com desconto (usado só para exibição no e-mail)
            # O Inter aplica o desconto no boleto automaticamente
            valor_com_desconto = round(valor_cheio * (1 - desconto_pct / 100), 2)

            # 5b. Emitir Bolepix
            emissao_resp = _emitir_bolepix(
                cert_path, key_path, token, aluno, vencimento, your_number,
                desconto_percentual=desconto_pct,
            )
            request_code = emissao_resp.get("codigoSolicitacao")
            logger.info(f"Bolepix emitido: {request_code} (aluno: {aluno.get('nome')}, "
                        f"desconto: {desconto_pct}%)")

            # 5c. Recuperar detalhes (linhaDigitável + PIX)
            detalhes = _recuperar_detalhes_bolepix(cert_path, key_path, token, request_code)

            # 5d. Baixar PDF
            pdf_bytes = _baixar_pdf_bolepix(cert_path, key_path, token, request_code)

            # 5e. Salvar PDF no Supabase Storage
            pdf_url = _salvar_pdf_supabase(
                supabase, aluno_id, mes_referencia, request_code, pdf_bytes
            )

            # 5f. Registrar cobrança no banco
            cobranca_id = _registrar_cobranca(
                supabase, aluno, mes_referencia, vencimento,
                request_code, your_number, detalhes, pdf_url,
                desconto_aplicado=desconto_pct,
            )

            # 5g. Enviar e-mail via Resend (Fase A)
            email_ok = _enviar_email_bolepix(
                aluno=aluno,
                cobranca_id=cobranca_id,
                mes_referencia=mes_referencia,
                vencimento=vencimento,
                valor=str(valor_com_desconto),
                linha_digitavel=detalhes.get("linha_digitavel", ""),
                pix_copia_cola=detalhes.get("pix_copia_cola", ""),
                pdf_url=pdf_url,
                desconto_percentual=desconto_pct,
            )

            # 5h. Registrar comunicação
            _registrar_comunicacao(
                supabase, cobranca_id, aluno_id,
                tipo="envio_boleto",
                canal="email",
                status="enviado" if email_ok else "falhou",
                mensagem=f"Bolepix {mes_referencia.strftime('%m/%Y')} enviado por e-mail (desconto {desconto_pct}%)",
            )

            emitidos += 1
            logger.info(f"✅ {aluno.get('nome')} — {request_code} — e-mail: {'✅' if email_ok else '⚠️'}")

        except Exception as e:
            erros += 1
            msg = f"Aluno {aluno.get('nome')} ({aluno.get('id')}): {str(e)}"
            erros_log.append(msg)
            logger.exception(f"Erro ao processar {aluno.get('nome')}: {e}")

    return {
        "mes_referencia":       str(mes_referencia),
        "alunos_processados":   len(alunos),
        "boletos_a_emitir":     len(alunos_para_emitir),
        "boletos_ja_existiam":  len(alunos_com_cobranca),
        "boletos_emitidos":     emitidos,
        "erros":                erros,
        "erros_log":            erros_log,
        "ambiente":             INTER_ENVIRONMENT,
        "status":               "concluido" if erros == 0 else "concluido_com_erros",
    }


# ---------------------------------------------------------------------------
# Helpers de data
# ---------------------------------------------------------------------------
def _calcular_vencimento(dia_vencimento: int, mes_referencia: date) -> date:
    """Calcula a data de vencimento no mês corrente para um aluno."""
    try:
        return mes_referencia.replace(day=dia_vencimento)
    except ValueError:
        # Mês com menos dias (ex: fev/dia 30) → usa último dia do mês
        proximo_mes = mes_referencia.replace(day=28) + timedelta(days=4)
        return proximo_mes.replace(day=1) - timedelta(days=1)


def _gerar_your_number(aluno_id: str, mes_referencia: date) -> str:
    """
    Gera o identificador único rastreável para o Inter.
    Formato: FIC-{ALUNO8}-{YYYYMM}
    Limite do Inter: até 15 caracteres alfanuméricos.
    """
    aluno_curto = aluno_id.replace("-", "")[:8].upper()
    return f"FIC{aluno_curto}{mes_referencia.strftime('%Y%m')}"
