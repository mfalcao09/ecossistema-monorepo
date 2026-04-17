"""Tool de smoke-test — `hello(name)`.

Prova que auth + middleware estão funcionando ponta a ponta.
"""
from __future__ import annotations

from ..auth.scopes import require_scope


def register(mcp: "object") -> None:  # pragma: no cover — registrado em server.py
    """Registra a tool `hello` no FastMCP fornecido."""
    @mcp.tool  # type: ignore[attr-defined]
    @require_scope("reader")
    def hello(name: str = "mundo") -> str:  # noqa: D401
        """Ecoa `Olá, <name>!` — verifica que o servidor está vivo."""
        return f"Olá, {name}!"
