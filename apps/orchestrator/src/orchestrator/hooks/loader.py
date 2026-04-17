"""
HooksBridge — chama @ecossistema/constitutional-hooks (TypeScript) via
child process Node.js ouvindo stdin/stdout.

O processo Node lê linhas JSON do stdin e responde com linha JSON no stdout:
  stdin:  {"hook":"preToolUse","ctx":{...}}
  stdout: {"decision":"allow"}  ou  {"decision":"block","reason":"..."}

Arquitetura: um processo Node por instância do orchestrator (singleton por
worker uvicorn). O processo é lazy-started no primeiro uso.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger(__name__)

# Resposta padrão quando bridge não está disponível (fail-open para hooks não-bloqueantes)
_FALLBACK_ALLOW = {"decision": "allow"}
_FALLBACK_DENY = {"decision": "block", "reason": "hooks bridge indisponível"}


class HooksBridge:
    """
    Singleton lightweight — mantém um processo Node vivo por instância.
    Thread-safe via asyncio Lock.
    """

    _proc: asyncio.subprocess.Process | None = None
    _lock: asyncio.Lock | None = None
    _script_path: Path | None = None

    def __init__(self, script_path: Path | None = None) -> None:
        if script_path is not None:
            HooksBridge._script_path = script_path
        if HooksBridge._lock is None:
            HooksBridge._lock = asyncio.Lock()

    @classmethod
    def configure(cls, script_path: Path) -> None:
        cls._script_path = script_path

    async def _ensure_proc(self) -> asyncio.subprocess.Process | None:
        """Inicia o processo Node se ainda não estiver rodando."""
        if HooksBridge._proc is not None and HooksBridge._proc.returncode is None:
            return HooksBridge._proc

        script = HooksBridge._script_path
        if not script or not script.exists():
            log.warning("hooks_bridge_script_missing", path=str(script))
            return None

        try:
            HooksBridge._proc = await asyncio.create_subprocess_exec(
                "node",
                str(script),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            log.info("hooks_bridge_started", pid=HooksBridge._proc.pid)
            return HooksBridge._proc
        except FileNotFoundError:
            log.warning("hooks_bridge_node_not_found")
            return None
        except Exception as exc:
            log.error("hooks_bridge_start_error", error=str(exc))
            return None

    async def _call(self, hook: str, ctx: dict[str, Any]) -> dict[str, Any]:
        """Envia uma chamada de hook e aguarda resposta."""
        lock = HooksBridge._lock
        assert lock is not None

        async with lock:
            proc = await self._ensure_proc()
            if proc is None or proc.stdin is None or proc.stdout is None:
                return _FALLBACK_ALLOW

            try:
                payload = json.dumps({"hook": hook, "ctx": ctx}, ensure_ascii=False) + "\n"
                proc.stdin.write(payload.encode())
                await proc.stdin.drain()

                line = await asyncio.wait_for(proc.stdout.readline(), timeout=5.0)
                result = json.loads(line.decode().strip())
                return result

            except asyncio.TimeoutError:
                log.warning("hooks_bridge_timeout", hook=hook)
                # Art. XII: se hook de custo falha → fail-closed (bloqueia)
                if hook == "checkCost":
                    return _FALLBACK_DENY
                return _FALLBACK_ALLOW

            except Exception as exc:
                log.error("hooks_bridge_error", hook=hook, error=str(exc))
                # Reset processo morto
                HooksBridge._proc = None
                return _FALLBACK_ALLOW

    # ── API pública ───────────────────────────────────────────────────────────

    async def pre_tool_use(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """
        Hook PreToolUse — Arts. II, III, XII, XIV, XVIII, XIX, XX.
        Pode retornar {"decision": "block", "reason": "...", "requires_approval": bool}
        """
        result = await self._call("preToolUse", ctx)
        if result.get("decision") == "block":
            log.info(
                "hook_blocked",
                tool=ctx.get("tool_name"),
                reason=result.get("reason"),
                agent=ctx.get("agent_id"),
            )
        return result

    async def post_tool_use(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """
        Hook PostToolUse — Arts. IV, VIII, IX.
        Não bloqueia; grava audit log.
        """
        return await self._call("postToolUse", ctx)

    async def session_end(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """
        Hook SessionEnd — Art. XXII (aprendizado é infraestrutura).
        Extrai padrões e injeta em memória.
        """
        return await self._call("sessionEnd", ctx)

    async def close(self) -> None:
        """Encerra o processo Node (chamado no shutdown do FastAPI)."""
        if HooksBridge._proc and HooksBridge._proc.returncode is None:
            HooksBridge._proc.terminate()
            try:
                await asyncio.wait_for(HooksBridge._proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                HooksBridge._proc.kill()
            HooksBridge._proc = None
            log.info("hooks_bridge_closed")
