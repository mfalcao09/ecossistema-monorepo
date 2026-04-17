"""Cliente de credenciais — wraps SC-29 (Supabase Vault) em Modo B proxy.

Ver V9 § SC-29. Em Modo B:
- A Edge Function ``credentials-proxy`` é o único ponto que decifra valores.
- MCP servers chamam ela com Authorization Supabase JWT + owner scope.
- Credenciais **nunca** ficam em env var/.md/log — sempre buscadas em runtime.

Esta classe é uma casca em Python; a implementação real depende da
Edge Function publicada em S08.
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

log = structlog.get_logger("mcp.credentials")


class CredentialError(RuntimeError):
    """Falha ao buscar credencial via proxy."""


class CredentialClient:
    """Busca credenciais pela Edge Function SC-29 Modo B."""

    def __init__(
        self,
        proxy_url: str,
        auth_token: str,
        *,
        timeout: float = 10.0,
    ) -> None:
        if not proxy_url:
            raise ValueError("proxy_url vazio.")
        self.proxy_url = proxy_url.rstrip("/")
        self._http = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    async def get(self, key: str, *, business_id: str = "ecosystem") -> str:
        """Retorna o valor cru da credencial. Levanta ``CredentialError`` em falha."""
        try:
            resp = await self._http.post(
                f"{self.proxy_url}/credentials/get",
                json={"key": key, "business_id": business_id},
            )
        except httpx.HTTPError as exc:
            raise CredentialError(f"Falha de rede ao buscar {key}: {exc}") from exc

        if resp.status_code == 404:
            raise CredentialError(f"Credencial ausente: {key}@{business_id}")
        if resp.status_code >= 300:
            raise CredentialError(
                f"Proxy retornou {resp.status_code}: {resp.text[:200]}"
            )

        body: dict[str, Any] = resp.json()
        value = body.get("value")
        if not isinstance(value, str):
            raise CredentialError(f"Resposta inválida do proxy para {key}.")
        return value

    async def close(self) -> None:
        await self._http.aclose()


async def get_credential(
    client: CredentialClient, key: str, *, business_id: str = "ecosystem"
) -> str:
    """Atalho funcional — `await get_credential(client, 'INTER_TOKEN')`."""
    return await client.get(key, business_id=business_id)
