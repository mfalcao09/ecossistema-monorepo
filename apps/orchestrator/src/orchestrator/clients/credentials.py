"""
Cliente SC-29 Credential Gateway (S8).
TODO(S8): implementar quando credential-gateway-v2 Edge Function estiver up.

Art. XX — Soberania Local: credenciais via SC-29, nunca hardcode.
"""

from __future__ import annotations

import httpx
import structlog

log = structlog.get_logger(__name__)


class CredentialsClient:
    """
    Busca credenciais do ecossistema via SC-29 Credential Gateway (Edge Function).
    TODO(S8): implementação completa.
    """

    def __init__(self, gateway_url: str = "") -> None:
        self._url = gateway_url
        self._available = bool(gateway_url)
        if not self._available:
            log.debug("credentials_client_stub_mode")

    async def get(self, name: str, project: str) -> str | None:
        """
        Busca credencial por nome e projeto.
        GET {gateway_url}?name={name}&project={project}
        TODO(S8): adicionar auth Bearer
        """
        if not self._available:
            log.debug("credentials_get_stub", name=name, project=project)
            return None

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    self._url,
                    params={"name": name, "project": project},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("value")
        except Exception as exc:
            log.error("credentials_get_error", name=name, project=project, error=str(exc))
            return None
