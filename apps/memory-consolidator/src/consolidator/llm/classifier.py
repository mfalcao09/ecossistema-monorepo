"""Classificador heurístico de tipo de memória (sem LLM — rápido)."""

from __future__ import annotations

PROCEDURAL_KEYWORDS = {"workflow", "processo", "procedure", "passo", "etapa", "rotina"}
SEMANTIC_KEYWORDS = {"é", "tem", "usa", "prefere", "evita", "pertence", "criou"}


def classify_summary(summary: str) -> str:
    """Retorna 'procedural', 'semantic' ou 'episodic' (default)."""
    lower = summary.lower()
    if any(kw in lower for kw in PROCEDURAL_KEYWORDS):
        return "procedural"
    if any(kw in lower for kw in SEMANTIC_KEYWORDS):
        return "semantic"
    return "episodic"
