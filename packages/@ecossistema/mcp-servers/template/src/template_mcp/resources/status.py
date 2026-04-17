"""Resource `status://health` — usado como healthcheck interno e externo."""
from __future__ import annotations

from .. import __version__
from ..auth.scopes import require_scope


def register(mcp: "object", server_name: str) -> None:  # pragma: no cover
    """Registra resource e HTTP healthcheck."""
    @mcp.resource("status://health")  # type: ignore[attr-defined]
    @require_scope("reader")
    def health_status() -> dict:
        """Status básico — versão e nome do server."""
        return {
            "status": "ok",
            "server": server_name,
            "version": __version__,
        }
