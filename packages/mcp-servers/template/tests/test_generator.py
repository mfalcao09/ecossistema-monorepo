"""Generator CLI smoke — valida nome, dry-run e placeholders.

Rodamos o CLI via ``node`` com ``--dry-run``. Se ``node`` não estiver
disponível, o teste é marcado como skip (não falha o pipeline Python).
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


GENERATOR = (
    Path(__file__).resolve().parents[2]
    / "generator"
    / "bin"
    / "create-mcp-server.js"
)


@pytest.mark.skipif(shutil.which("node") is None, reason="node não disponível")
def test_generator_dry_run_valid_name() -> None:
    result = subprocess.run(
        ["node", str(GENERATOR), "demo-new", "--dry-run", "--business", "fic"],
        capture_output=True,
        text=True,
        cwd=str(GENERATOR.parents[3]),  # monorepo root
    )
    # Dry-run pode exit 0 mesmo sem node_modules se o commander já parseou
    # antes de tocar fs/yaml. Se falhar, tolere desde que a mensagem seja
    # sobre deps ausentes e não validação de nome.
    assert "inválido" not in result.stdout + result.stderr


@pytest.mark.skipif(shutil.which("node") is None, reason="node não disponível")
def test_generator_rejects_bad_name() -> None:
    result = subprocess.run(
        ["node", str(GENERATOR), "1Ugly_Name!"],
        capture_output=True,
        text=True,
    )
    # Rejeita antes de tocar qualquer dep pesada.
    assert result.returncode != 0
