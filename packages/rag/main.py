"""
RAG Engine — Ecossistema de IA (Marcelo Silva)
===============================================
Serviço Python que roda no Railway e gera embeddings para todas as memórias
do Supabase ECOSYSTEM, habilitando busca semântica (RAG).

Como funciona:
1. Busca memórias sem embedding no Supabase
2. Gera embedding via Gemini text-embedding-004 (768 dimensões)
3. Salva o embedding de volta no Supabase
4. Roda em loop contínuo — memórias novas são processadas automaticamente

Variáveis de ambiente necessárias no Railway:
  SUPABASE_URL        = https://gqckbunsfjgerbuiyzvn.supabase.co
  SUPABASE_SERVICE_KEY = <service_role key do painel Supabase>
  GEMINI_API_KEY      = <chave da Google AI Studio>
  BATCH_SIZE          = 10   (opcional, padrão 10)
  INTERVAL_SECONDS    = 3600 (opcional, padrão 1 hora)
"""

import os
import time
import logging
import requests

# ─── Configuração de logs ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("rag-engine")


# ─── Variáveis de ambiente ──────────────────────────────────────────────────
SUPABASE_URL      = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_KEY"]       # service_role key
GEMINI_API_KEY    = os.environ["GEMINI_API_KEY"]
BATCH_SIZE        = int(os.environ.get("BATCH_SIZE", "10"))
INTERVAL_SECONDS  = int(os.environ.get("INTERVAL_SECONDS", "3600"))  # 1h padrão

# Headers para chamadas ao Supabase (REST API)
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# URL da API de embeddings do Gemini
# Usando gemini-embedding-001 via v1beta (text-embedding-004 não disponível nesta chave)
GEMINI_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
)


# ─── Funções principais ──────────────────────────────────────────────────────

def buscar_memorias_sem_embedding(limite: int) -> list[dict]:
    """
    Busca memórias do Supabase que ainda não têm embedding gerado.
    Retorna lista de dicts com id, title, content.
    """
    url = f"{SUPABASE_URL}/rest/v1/ecosystem_memory"
    params = {
        "select": "id,title,content",
        "embedding": "is.null",       # apenas rows com embedding NULL
        "order": "created_at.asc",    # mais antigas primeiro
        "limit": str(limite),
    }
    resp = requests.get(url, headers=SUPABASE_HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def gerar_embedding(titulo: str, conteudo: str) -> list[float]:
    """
    Gera embedding via Gemini gemini-embedding-001.
    Concatena título + conteúdo para maximizar contexto semântico.
    Retorna lista de 768 floats (outputDimensionality=768 para compatibilidade com o banco).
    """
    texto = f"{titulo}\n\n{conteudo}"

    # Gemini aceita no máximo ~2048 tokens. Truncamos com segurança.
    texto = texto[:8000]

    payload = {
        "model": "models/gemini-embedding-001",
        "content": {
            "parts": [{"text": texto}]
        },
        "taskType": "RETRIEVAL_DOCUMENT",       # otimizado para busca
        "outputDimensionality": 768,            # trunca para 768 dims (compatível com o banco)
    }

    resp = requests.post(GEMINI_EMBED_URL, json=payload, timeout=30)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Gemini embedding falhou: {resp.status_code} — {resp.text[:200]}"
        )

    valores = resp.json()["embedding"]["values"]

    # Garante que temos exatamente 768 dimensões
    if len(valores) != 768:
        raise ValueError(f"Embedding retornou {len(valores)} dims, esperado 768")

    return valores


def salvar_embedding(memory_id: str, embedding: list[float]) -> None:
    """
    Faz UPDATE no Supabase, gravando o embedding gerado.
    """
    url = f"{SUPABASE_URL}/rest/v1/ecosystem_memory"
    params = {"id": f"eq.{memory_id}"}
    payload = {
        "embedding": embedding,    # Supabase aceita array JSON para vector
        "updated_at": "now()",
    }
    resp = requests.patch(
        url, headers=SUPABASE_HEADERS, params=params, json=payload, timeout=15
    )
    resp.raise_for_status()


def contar_pendentes() -> int:
    """Conta quantas memórias ainda estão sem embedding."""
    url = f"{SUPABASE_URL}/rest/v1/ecosystem_memory"
    headers = {**SUPABASE_HEADERS, "Prefer": "count=exact"}
    params = {"select": "id", "embedding": "is.null"}
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    resp.raise_for_status()
    # O total vem no header Content-Range: 0-N/TOTAL
    content_range = resp.headers.get("Content-Range", "0/0")
    total = content_range.split("/")[-1]
    return int(total) if total.isdigit() else 0


def contar_total() -> int:
    """Conta o total de memórias no banco."""
    url = f"{SUPABASE_URL}/rest/v1/ecosystem_memory"
    headers = {**SUPABASE_HEADERS, "Prefer": "count=exact"}
    params = {"select": "id"}
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    resp.raise_for_status()
    content_range = resp.headers.get("Content-Range", "0/0")
    total = content_range.split("/")[-1]
    return int(total) if total.isdigit() else 0


# ─── Loop principal ──────────────────────────────────────────────────────────

def processar_lote() -> int:
    """
    Busca um lote de memórias sem embedding e processa.
    Retorna o número de memórias processadas neste ciclo.
    """
    memorias = buscar_memorias_sem_embedding(BATCH_SIZE)

    if not memorias:
        return 0

    processadas = 0
    for mem in memorias:
        memory_id = mem["id"]
        titulo    = mem.get("title", "")
        conteudo  = mem.get("content", "")

        try:
            embedding = gerar_embedding(titulo, conteudo)
            salvar_embedding(memory_id, embedding)
            log.info(f"✅ Embedding gerado: '{titulo[:60]}'")
            processadas += 1

        except Exception as e:
            log.error(f"❌ Falhou '{titulo[:60]}': {e}")

        # Pequena pausa entre chamadas para respeitar rate limit do Gemini
        time.sleep(0.5)

    return processadas


def main():
    log.info("=" * 60)
    log.info("RAG Engine iniciado — Ecossistema de IA")
    log.info(f"Supabase: {SUPABASE_URL}")
    log.info(f"Batch size: {BATCH_SIZE} | Intervalo: {INTERVAL_SECONDS}s")
    log.info("=" * 60)

    ciclo = 0
    while True:
        ciclo += 1
        log.info(f"--- Ciclo #{ciclo} ---")

        try:
            pendentes = contar_pendentes()
            total     = contar_total()
            com_emb   = total - pendentes
            pct       = round(100 * com_emb / max(total, 1), 1)

            log.info(
                f"Status: {com_emb}/{total} memórias com embedding ({pct}%)"
            )

            if pendentes == 0:
                log.info("🎉 100% das memórias têm embedding! RAG totalmente ativo.")
            else:
                processadas = processar_lote()
                log.info(f"Lote processado: {processadas} memórias")

        except Exception as e:
            log.error(f"Erro no ciclo #{ciclo}: {e}")

        log.info(f"Aguardando {INTERVAL_SECONDS}s até próximo ciclo...")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
