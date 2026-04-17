"""
Runtime — core run loop para Managed Agents.
Inspirado no phantom runtime (research-repos/phantom).

Fluxo:
  1. Recall memory (TODO S7)
  2. Assemble prompt 9-layer (TODO S2)
  3. Security wrap (phantom bookends)
  4. Stream via Anthropic beta sessions API
  5. Emite RuntimeEvent → SSE
  6. Log para Langfuse (TODO S9)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import anthropic
import structlog

from orchestrator.agents.registry import AgentDefinition
from orchestrator.clients.langfuse import LangfuseClient
from orchestrator.clients.memory import MemoryClient
from orchestrator.hooks.loader import HooksBridge
from orchestrator.prompt.assembler import PromptAssembler
from orchestrator.security.wrapping import wrap_security, unwrap_security

log = structlog.get_logger(__name__)


@dataclass
class RunRequest:
    query: str
    user_id: str
    session_id: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class RuntimeEvent:
    type: str  # init | thinking | tool_use | tool_result | assistant_message | end | error
    data: dict[str, Any]


class AgentRuntime:
    """
    Core runtime de execução de um agente via Anthropic Managed Agents.
    Uma instância por (agent_id, request).
    """

    def __init__(
        self,
        defn: AgentDefinition,
        client: anthropic.Anthropic,
    ) -> None:
        self.defn = defn
        self._client = client
        self._assembler = PromptAssembler()
        self._hooks = HooksBridge()
        self._memory = MemoryClient()
        self._langfuse = LangfuseClient()

    async def run(self, req: RunRequest) -> AsyncIterator[RuntimeEvent]:
        session_id = req.session_id or str(uuid.uuid4())
        bound = log.bind(agent_id=self.defn.id, session_id=session_id, user_id=req.user_id)
        bound.info("runtime_run_start")

        # 1. Recall memory — TODO(S7): trocar por memory.recall() real
        memories: list[str] = await self._memory.recall(req.query)

        # 2. Assemble prompt — TODO(S2): passar para PromptAssembler completo
        system_append = await self._assembler.assemble(
            agent_id=self.defn.id,
            query=req.query,
            memories=memories,
        )

        # 3. Start Langfuse trace — TODO(S9): trace real
        trace_id = await self._langfuse.start_trace(
            name=f"{self.defn.id}:run",
            session_id=session_id,
            user_id=req.user_id,
        )

        # 4. Security wrap (phantom [SECURITY]...[/SECURITY])
        wrapped_query = wrap_security(req.query, direction="inbound")

        # 5. Emit init event
        yield RuntimeEvent(
            type="init",
            data={
                "session_id": session_id,
                "agent": self.defn.id,
                "model": self.defn.model,
                "trace_id": trace_id,
            },
        )

        # 6. Executar via API
        if self.defn.stub or not self.defn.api_id:
            # Stub mode — responde sem chamar a API real
            async for event in self._run_stub(req, session_id, wrapped_query):
                yield event
        else:
            async for event in self._run_managed(req, session_id, wrapped_query, system_append):
                yield event

        await self._langfuse.end_trace(trace_id)
        bound.info("runtime_run_end")

    async def resume(self, session_id: str, message: str) -> AsyncIterator[RuntimeEvent]:
        """Retoma uma sessão Managed Agent existente."""
        bound = log.bind(agent_id=self.defn.id, session_id=session_id)
        bound.info("runtime_resume_start")

        wrapped = wrap_security(message, direction="inbound")

        yield RuntimeEvent(
            type="init",
            data={"session_id": session_id, "agent": self.defn.id, "resumed": True},
        )

        async for event in self._stream_session(session_id, wrapped):
            yield event

        bound.info("runtime_resume_end")

    # ── Execução real via Managed Agents ────────────────────────────────────

    async def _run_managed(
        self,
        req: RunRequest,
        session_id: str,
        query: str,
        system_append: str,
    ) -> AsyncIterator[RuntimeEvent]:
        assert self.defn.api_id is not None

        try:
            # Criar sessão (ou retomar se session_id existir)
            if req.session_id:
                api_session_id = req.session_id
            else:
                session = self._client.beta.sessions.create(
                    agent=self.defn.api_id,
                    title=f"{self.defn.id}:{req.user_id}:{session_id[:8]}",
                )
                api_session_id = session.id

            async for event in self._stream_session(api_session_id, query):
                yield event

        except Exception as exc:
            log.error("runtime_managed_error", error=str(exc))
            yield RuntimeEvent(type="error", data={"message": str(exc)})

    async def _stream_session(self, api_session_id: str, message: str) -> AsyncIterator[RuntimeEvent]:
        """Stream de eventos de uma sessão Managed Agents."""
        try:
            with self._client.beta.sessions.events.stream(api_session_id) as stream:
                # Enviar mensagem
                self._client.beta.sessions.events.send(
                    api_session_id,
                    events=[{
                        "type": "user.message",
                        "content": [{"type": "text", "text": message}],
                    }],
                )

                total_tokens = 0

                for raw_event in stream:
                    match raw_event.type:

                        case "agent.message":
                            text = ""
                            for block in getattr(raw_event, "content", []):
                                if hasattr(block, "text"):
                                    text += block.text
                            if text:
                                text_out = unwrap_security(text)
                                yield RuntimeEvent(
                                    type="assistant_message",
                                    data={"text": text_out},
                                )

                        case "agent.thinking":
                            yield RuntimeEvent(
                                type="thinking",
                                data={"text": getattr(raw_event, "thinking", "")},
                            )

                        case "agent.tool_use":
                            tool_name = getattr(raw_event, "name", "unknown")
                            tool_input = getattr(raw_event, "input", {})
                            # Hook PreToolUse
                            hook_result = await self._hooks.pre_tool_use({
                                "tool_name": tool_name,
                                "tool_input": tool_input,
                                "agent_id": self.defn.id,
                                "business_id": self.defn.business,
                            })
                            if hook_result.get("decision") == "block":
                                yield RuntimeEvent(
                                    type="tool_blocked",
                                    data={
                                        "tool": tool_name,
                                        "reason": hook_result.get("reason", "hook blocked"),
                                        "requires_approval": hook_result.get("requires_approval", False),
                                    },
                                )
                            else:
                                yield RuntimeEvent(
                                    type="tool_use",
                                    data={"tool": tool_name, "input": tool_input},
                                )

                        case "agent.tool_result":
                            tool_name = getattr(raw_event, "name", "unknown")
                            result = getattr(raw_event, "result", {})
                            # Hook PostToolUse
                            await self._hooks.post_tool_use({
                                "tool_name": tool_name,
                                "tool_input": getattr(raw_event, "input", {}),
                                "tool_result": result,
                                "agent_id": self.defn.id,
                                "business_id": self.defn.business,
                            })
                            yield RuntimeEvent(
                                type="tool_result",
                                data={"tool": tool_name, "result": result},
                            )

                        case "session.status_idled":
                            # HITL — agente aguardando aprovação (Art. II)
                            yield RuntimeEvent(
                                type="status_idled",
                                data={
                                    "session_id": api_session_id,
                                    "agent_id": self.defn.id,
                                    "stop_reason": str(getattr(raw_event, "stop_reason", "")),
                                },
                            )

                        case "session.status_idle" | "session.end":
                            usage = getattr(raw_event, "usage", None)
                            if usage:
                                total_tokens = getattr(usage, "total_tokens", 0)
                            break

                        case "session.status_error":
                            yield RuntimeEvent(
                                type="error",
                                data={"message": str(raw_event)},
                            )
                            break

                yield RuntimeEvent(
                    type="end",
                    data={"total_tokens": total_tokens, "session_id": api_session_id},
                )

                # Hook SessionEnd (Art. XXII)
                await self._hooks.session_end({
                    "agent_id": self.defn.id,
                    "session_id": api_session_id,
                    "total_tokens": total_tokens,
                })

        except Exception as exc:
            log.error("stream_session_error", error=str(exc))
            yield RuntimeEvent(type="error", data={"message": str(exc)})

    # ── Stub mode ────────────────────────────────────────────────────────────

    async def _run_stub(
        self, req: RunRequest, session_id: str, query: str
    ) -> AsyncIterator[RuntimeEvent]:
        """Resposta stub para agentes ainda não criados na API."""
        yield RuntimeEvent(
            type="thinking",
            data={"text": f"[STUB] {self.defn.id} ainda não está criado na API. Execute --setup."},
        )
        yield RuntimeEvent(
            type="assistant_message",
            data={
                "text": (
                    f"Olá! Sou {self.defn.name} ({self.defn.role}). "
                    f"Ainda estou em modo stub — execute `python claudinho_orchestrator.py --setup` "
                    f"para me ativar na Anthropic Managed Agents API. "
                    f"Você perguntou: {req.query}"
                )
            },
        )
        yield RuntimeEvent(
            type="end",
            data={"total_tokens": 0, "session_id": session_id, "stub": True},
        )
