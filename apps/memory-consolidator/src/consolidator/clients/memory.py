"""
Python Supabase wrapper para as 3 tabelas de memória.

Mirrors a interface do @ecossistema/memory (TypeScript), mas em Python.
Usa service_role key — bypassa RLS por design (worker interno).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from supabase import AsyncClient, acreate_client

from consolidator.config import Settings


@dataclass
class EpisodicRecord:
    id: str
    business_id: str
    agent_id: str
    user_id: str | None
    type: str
    outcome: str | None
    summary: str
    detail: str | None
    entities: list
    tools_used: list
    importance: float
    metadata: dict[str, Any]
    created_at: str


@dataclass
class SemanticRecord:
    id: str
    business_id: str
    agent_id: str
    user_id: str | None
    subject: str
    predicate: str
    object: str
    natural_language: str
    confidence: float
    source_episodic_id: str | None
    valid_until: str | None
    created_at: str


@dataclass
class WorkflowPattern:
    tools_used_pattern: list[str]
    occurrences: int
    examples: list[dict[str, Any]]


class EpisodicMemory:
    def __init__(self, sb: AsyncClient) -> None:
        self._sb = sb

    async def get_unprocessed(self, limit: int = 500) -> list[EpisodicRecord]:
        resp = await self._sb.rpc(
            "get_unprocessed_episodic", {"p_limit": limit}
        ).execute()
        return [_to_episodic(r) for r in (resp.data or [])]

    async def mark_processed(self, ids: list[str]) -> None:
        if not ids:
            return
        await self._sb.rpc(
            "mark_episodic_processed", {"p_ids": ids}
        ).execute()


class SemanticMemory:
    def __init__(self, sb: AsyncClient) -> None:
        self._sb = sb

    async def insert(
        self,
        *,
        business_id: str,
        agent_id: str,
        user_id: str | None,
        subject: str,
        predicate: str,
        object_: str,
        natural_language: str,
        confidence: float,
        source_episodic_id: str | None,
        metadata: dict | None = None,
    ) -> str | None:
        data: dict[str, Any] = {
            "business_id": business_id,
            "agent_id": agent_id,
            "subject": subject,
            "predicate": predicate,
            "object": object_,
            "natural_language": natural_language,
            "confidence": confidence,
            "metadata": metadata or {},
        }
        if user_id:
            data["user_id"] = user_id
        if source_episodic_id:
            data["source_episodic_id"] = source_episodic_id

        try:
            resp = await self._sb.table("memory_semantic").insert(data).execute()
            return resp.data[0]["id"] if resp.data else None
        except Exception:
            # Unique constraint violations (mesmo fact já existe) são silenciosas
            return None

    async def get_duplicate_groups(self) -> list[list[SemanticRecord]]:
        """Retorna grupos de facts ativos com mesmo (business, agent, user, subject, predicate)."""
        resp = await (
            self._sb.table("memory_semantic")
            .select("*")
            .is_("valid_until", "null")
            .order("created_at")
            .execute()
        )
        records = [_to_semantic(r) for r in (resp.data or [])]

        groups: dict[tuple, list[SemanticRecord]] = {}
        for r in records:
            key = (r.business_id, r.agent_id, r.user_id, r.subject, r.predicate)
            groups.setdefault(key, []).append(r)

        return [v for v in groups.values() if len(v) > 1]

    async def soft_delete(self, id_: str) -> None:
        """Soft-delete: seta valid_until = now (fact deixa de ser ativo)."""
        now = datetime.now(timezone.utc).isoformat()
        await self._sb.table("memory_semantic").update({"valid_until": now}).eq("id", id_).execute()

    async def supersede(self, old_id: str, new_id: str) -> None:
        """Marca old_id como superseded pelo new_id."""
        now = datetime.now(timezone.utc).isoformat()
        await self._sb.table("memory_semantic").update({"valid_until": now}).eq("id", old_id).execute()
        await self._sb.table("memory_semantic").update({"supersedes_id": old_id}).eq("id", new_id).execute()


class MemoryClient:
    def __init__(self, sb: AsyncClient) -> None:
        self._sb = sb
        self.episodic = EpisodicMemory(sb)
        self.semantic = SemanticMemory(sb)

    @classmethod
    async def create(cls, settings: Settings) -> MemoryClient:
        sb = await acreate_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        return cls(sb)

    async def decay_importance(self, *, decay_factor: float = 0.9, min_idle_days: int = 30) -> int:
        resp = await self._sb.rpc(
            "decay_memory_importance",
            {"p_decay_factor": decay_factor, "p_min_idle_days": min_idle_days},
        ).execute()
        return int(resp.data or 0)

    async def cleanup_stale(self, *, min_importance: float = 0.05, min_idle_days: int = 90) -> int:
        resp = await self._sb.rpc(
            "cleanup_stale_memories",
            {"p_min_importance": min_importance, "p_min_idle_days": min_idle_days},
        ).execute()
        return int(resp.data or 0)

    async def detect_workflow_patterns(
        self, *, min_occurrences: int = 3, since_days: int = 30
    ) -> list[WorkflowPattern]:
        resp = await self._sb.rpc(
            "detect_workflow_patterns",
            {"p_min_occurrences": min_occurrences, "p_since_days": since_days},
        ).execute()
        result = []
        for r in (resp.data or []):
            pattern_raw = r["tools_used_pattern"]
            examples_raw = r["examples"]
            result.append(
                WorkflowPattern(
                    tools_used_pattern=pattern_raw if isinstance(pattern_raw, list) else json.loads(pattern_raw),
                    occurrences=r["occurrences"],
                    examples=examples_raw if isinstance(examples_raw, list) else json.loads(examples_raw),
                )
            )
        return result

    async def store_briefing(self, date: str, business_id: str | None, content: str) -> None:
        await (
            self._sb.table("daily_briefings")
            .upsert({"date": date, "business_id": business_id, "content": content})
            .execute()
        )

    async def fetch_episodes_for_business(
        self, business_id: str, date: str, limit: int = 200
    ) -> list[EpisodicRecord]:
        resp = await (
            self._sb.table("memory_episodic")
            .select("id,business_id,agent_id,type,outcome,summary,detail,entities,tools_used,importance,metadata,created_at")
            .eq("business_id", business_id)
            .gte("created_at", f"{date}T00:00:00+00:00")
            .lt("created_at", f"{date}T23:59:59+00:00")
            .limit(limit)
            .execute()
        )
        return [_to_episodic(r) for r in (resp.data or [])]


def _to_episodic(r: dict[str, Any]) -> EpisodicRecord:
    return EpisodicRecord(
        id=r["id"],
        business_id=r["business_id"],
        agent_id=r["agent_id"],
        user_id=r.get("user_id"),
        type=r["type"],
        outcome=r.get("outcome"),
        summary=r["summary"],
        detail=r.get("detail"),
        entities=r.get("entities") or [],
        tools_used=r.get("tools_used") or [],
        importance=float(r.get("importance") or 0.5),
        metadata=r.get("metadata") or {},
        created_at=r["created_at"],
    )


def _to_semantic(r: dict[str, Any]) -> SemanticRecord:
    return SemanticRecord(
        id=r["id"],
        business_id=r["business_id"],
        agent_id=r["agent_id"],
        user_id=r.get("user_id"),
        subject=r["subject"],
        predicate=r["predicate"],
        object=r["object"],
        natural_language=r["natural_language"],
        confidence=float(r.get("confidence") or 1.0),
        source_episodic_id=r.get("source_episodic_id"),
        valid_until=r.get("valid_until"),
        created_at=r["created_at"],
    )
