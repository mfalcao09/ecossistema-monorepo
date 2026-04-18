"""Prompt builder helpers para extraction de facts."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ExtractedFact:
    subject: str
    predicate: str
    object: str
    natural_language: str
    confidence: float

    @classmethod
    def from_dict(cls, d: dict) -> ExtractedFact:
        return cls(
            subject=str(d.get("subject", "")),
            predicate=str(d.get("predicate", "")),
            object=str(d.get("object", "")),
            natural_language=str(d.get("natural_language", "")),
            confidence=float(d.get("confidence", 0.0)),
        )

    @property
    def is_valid(self) -> bool:
        return (
            self.confidence >= 0.7
            and bool(self.subject.strip())
            and bool(self.predicate.strip())
            and bool(self.object.strip())
            and bool(self.natural_language.strip())
        )


def parse_facts(result: dict | list) -> list[ExtractedFact]:
    """Parseia o resultado JSON do LLM em ExtractedFact válidos."""
    raw_facts = result.get("facts", []) if isinstance(result, dict) else []
    return [f for raw in raw_facts if (f := ExtractedFact.from_dict(raw)).is_valid]
