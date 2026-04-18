"""Helpers de summarização de episódios."""

from __future__ import annotations


def truncate_for_prompt(text: str | None, max_chars: int = 500) -> str:
    if not text:
        return ""
    return text[:max_chars] + ("…" if len(text) > max_chars else "")


def episode_to_prompt_snippet(ep: dict) -> str:
    """Converte um episódio em snippet legível para prompts."""
    parts = [f"[{ep.get('type', '?')}] {ep.get('summary', '')}"]
    if ep.get("outcome"):
        parts.append(f"outcome={ep['outcome']}")
    if ep.get("detail"):
        parts.append(truncate_for_prompt(ep["detail"], 200))
    return " | ".join(parts)
