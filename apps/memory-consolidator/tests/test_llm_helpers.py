"""Tests — llm helpers: classifier, extractor, summarizer."""

from __future__ import annotations

import pytest

# ─── classifier ───────────────────────────────────────────────────────────────

def test_classifier_procedural():
    from consolidator.llm.classifier import classify_summary
    assert classify_summary("Este é um workflow de aprovação") == "procedural"


def test_classifier_semantic():
    from consolidator.llm.classifier import classify_summary
    assert classify_summary("Marcelo usa FastAPI para suas APIs") == "semantic"


def test_classifier_default_episodic():
    from consolidator.llm.classifier import classify_summary
    assert classify_summary("Ciclo 042 finalizado com sucesso") == "episodic"


def test_classifier_empty():
    from consolidator.llm.classifier import classify_summary
    assert classify_summary("") == "episodic"


# ─── extractor ────────────────────────────────────────────────────────────────

def test_extracted_fact_valid():
    from consolidator.llm.extractor import ExtractedFact
    f = ExtractedFact(
        subject="Marcelo",
        predicate="usa",
        object="FastAPI",
        natural_language="Marcelo usa FastAPI",
        confidence=0.9,
    )
    assert f.is_valid is True


def test_extracted_fact_low_confidence_invalid():
    from consolidator.llm.extractor import ExtractedFact
    f = ExtractedFact(subject="X", predicate="Y", object="Z",
                      natural_language="X Y Z", confidence=0.5)
    assert f.is_valid is False


def test_extracted_fact_missing_fields_invalid():
    from consolidator.llm.extractor import ExtractedFact
    f = ExtractedFact(subject="", predicate="usa", object="FastAPI",
                      natural_language="usa FastAPI", confidence=0.9)
    assert f.is_valid is False


def test_parse_facts_filters_low_confidence():
    from consolidator.llm.extractor import parse_facts
    result_dict = {
        "facts": [
            {"subject": "A", "predicate": "B", "object": "C",
             "natural_language": "A B C", "confidence": 0.8},
            {"subject": "X", "predicate": "Y", "object": "Z",
             "natural_language": "X Y Z", "confidence": 0.3},
        ]
    }
    facts = parse_facts(result_dict)
    assert len(facts) == 1
    assert facts[0].subject == "A"


def test_parse_facts_empty_input():
    from consolidator.llm.extractor import parse_facts
    assert parse_facts({}) == []
    assert parse_facts([]) == []
    assert parse_facts({"facts": []}) == []


def test_extracted_fact_from_dict():
    from consolidator.llm.extractor import ExtractedFact
    f = ExtractedFact.from_dict({
        "subject": "CFO", "predicate": "calcula", "object": "folha",
        "natural_language": "CFO calcula folha mensalmente", "confidence": 0.85,
    })
    assert f.subject == "CFO"
    assert f.confidence == 0.85


# ─── summarizer ───────────────────────────────────────────────────────────────

def test_truncate_short_text():
    from consolidator.llm.summarizer import truncate_for_prompt
    assert truncate_for_prompt("hello", max_chars=100) == "hello"


def test_truncate_long_text():
    from consolidator.llm.summarizer import truncate_for_prompt
    text = "x" * 600
    result = truncate_for_prompt(text, max_chars=500)
    assert result.endswith("…")
    assert len(result) == 501


def test_truncate_none():
    from consolidator.llm.summarizer import truncate_for_prompt
    assert truncate_for_prompt(None) == ""


def test_episode_to_prompt_snippet():
    from consolidator.llm.summarizer import episode_to_prompt_snippet
    snippet = episode_to_prompt_snippet({"type": "task", "summary": "Fez X", "outcome": "success"})
    assert "task" in snippet
    assert "Fez X" in snippet
    assert "success" in snippet


def test_episode_to_prompt_snippet_with_detail():
    from consolidator.llm.summarizer import episode_to_prompt_snippet
    snippet = episode_to_prompt_snippet({"type": "task", "summary": "Fez X",
                                         "outcome": None, "detail": "Detalhe longo"})
    assert "Detalhe longo" in snippet
