"""Scopes canônicos e decorator `@require_scope`.

Hierarquia:
  reader   → apenas leitura (resources, consultas)
  operator → executa tools de efeito normal (default)
  admin    → ops privilegiadas (gestão de credenciais, reset, etc.)

Regra: quem tem `admin` implicitamente tem `operator` e `reader`;
quem tem `operator` tem `reader`.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

SCOPES: tuple[str, ...] = ("reader", "operator", "admin")

# Ordem = poder crescente.
_SCOPE_RANK: dict[str, int] = {name: i for i, name in enumerate(SCOPES)}


def has_scope(granted: list[str] | tuple[str, ...], required: str) -> bool:
    """True se qualquer scope concedido for >= o required na hierarquia."""
    if required not in _SCOPE_RANK:
        return False
    need = _SCOPE_RANK[required]
    return any(_SCOPE_RANK.get(s, -1) >= need for s in granted)


def require_scope(scope: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator que anota a tool com o scope mínimo exigido.

    O middleware de auth (ou o próprio AuthProvider via `AuthCheck`)
    lê `fn._required_scope` e decide se deixa passar.
    """
    if scope not in SCOPES:
        raise ValueError(f"Scope inválido: {scope!r}. Válidos: {SCOPES}")

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn._required_scope = scope  # type: ignore[attr-defined]
        return fn

    return decorator


def get_required_scope(tool_func: Callable[..., Any], default: str = "operator") -> str:
    """Retorna o scope exigido por uma tool; default = operator."""
    return getattr(tool_func, "_required_scope", default)
