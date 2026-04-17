"""
Security wrapping — padrão phantom ([SECURITY]...[/SECURITY] bookends).

Envolvemos queries inbound e unwrappamos respostas outbound para:
  - Evitar prompt injection via dados externos
  - Sinalizar para o modelo que conteúdo entre tags é dado do usuário
  - Detectar vazamento de informações sensíveis

Referência: research-repos/phantom/src/agent/runtime.ts
"""

from __future__ import annotations

_INBOUND_OPEN = "[SECURITY:INBOUND]"
_INBOUND_CLOSE = "[/SECURITY:INBOUND]"
_OUTBOUND_OPEN = "[SECURITY:OUTBOUND]"
_OUTBOUND_CLOSE = "[/SECURITY:OUTBOUND]"


def wrap_security(text: str, direction: str = "inbound") -> str:
    """
    Envolve texto com bookends de segurança (phantom pattern).

    Args:
        text: Texto a envolver.
        direction: "inbound" (query do usuário) ou "outbound" (resposta do agente).

    Returns:
        Texto com bookends de segurança.
    """
    if direction == "inbound":
        return f"{_INBOUND_OPEN}\n{text}\n{_INBOUND_CLOSE}"
    else:
        return f"{_OUTBOUND_OPEN}\n{text}\n{_OUTBOUND_CLOSE}"


def unwrap_security(text: str) -> str:
    """
    Remove bookends de segurança do texto de resposta.
    Idempotente — se não tiver bookends, retorna texto original.
    """
    for tag_open, tag_close in [
        (_INBOUND_OPEN, _INBOUND_CLOSE),
        (_OUTBOUND_OPEN, _OUTBOUND_CLOSE),
    ]:
        if tag_open in text and tag_close in text:
            start = text.index(tag_open) + len(tag_open)
            end = text.index(tag_close)
            text = text[start:end].strip()
    return text
