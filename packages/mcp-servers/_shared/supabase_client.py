"""Cliente Supabase HTTP compartilhado.

Minimalista: só expõe um ``httpx.AsyncClient`` pré-configurado com os
headers corretos. Para queries complexas, cada MCP server importa isso
e chama ``client.post('/rest/v1/rpc/<fn>')`` etc.
"""
from __future__ import annotations

import httpx


def build_supabase_client(
    project_url: str,
    service_role_key: str | None = None,
    anon_key: str | None = None,
    *,
    timeout: float = 10.0,
) -> httpx.AsyncClient:
    """Constrói ``httpx.AsyncClient`` autenticado no Supabase.

    - Se ``service_role_key`` é fornecida, tem poderes elevados (use com
      cuidado — só em tools com scope `admin`).
    - Senão usa ``anon_key`` (RLS aplicada).
    """
    if not service_role_key and not anon_key:
        raise ValueError("Forneça service_role_key ou anon_key.")

    key = service_role_key or anon_key
    headers = {
        "apikey": key or "",
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return httpx.AsyncClient(
        base_url=project_url.rstrip("/"),
        headers=headers,
        timeout=timeout,
    )
