"""
create_virtual_keys.py — gera as 6 virtual keys no LiteLLM proxy.

LiteLLM guarda apenas o HASH das keys no Postgres. O valor completo só
é retornado UMA VEZ, no momento do /key/generate. Este script salva
cada key recém-criada em /tmp/.virtual_keys/<alias>.txt (perms 600)
para uso imediato pelos consumidores.

Pré-requisitos:
  - Proxy já deployado e acessível em LITELLM_URL
  - LITELLM_MASTER_KEY válida exportada
  - Arquivos YAML em config/virtual_keys/ prontos

Fluxo Fase 1 (quando SC-29 Modo B estiver up):
  - Cada key gerada entra em ecosystem_credentials via SC-29 Modo B
  - Este script pode ser aposentado ou rodado 1x para bootstrap

Uso:
  export LITELLM_URL=https://litellm-production-3fb3.up.railway.app
  export LITELLM_MASTER_KEY=sk-litellm-master-xxxx
  python scripts/create_virtual_keys.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import httpx
import yaml


CONFIG_DIR = Path(__file__).parent.parent / "config" / "virtual_keys"
KEY_OUTPUT_DIR = Path("/tmp/.virtual_keys")


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"ERRO: variável {name} não definida", file=sys.stderr)
        sys.exit(1)
    return value


async def create_keys() -> None:
    litellm_url = _require_env("LITELLM_URL").rstrip("/")
    master_key = _require_env("LITELLM_MASTER_KEY")

    configs = sorted(CONFIG_DIR.glob("*.yaml"))
    if not configs:
        print(f"ERRO: nenhum YAML em {CONFIG_DIR}", file=sys.stderr)
        sys.exit(1)

    KEY_OUTPUT_DIR.mkdir(mode=0o700, exist_ok=True)

    async with httpx.AsyncClient(timeout=30.0) as client:
        for path in configs:
            payload = yaml.safe_load(path.read_text())
            alias = payload.get("key_alias", path.stem)
            print(f"→ criando key {alias!r}...")

            response = await client.post(
                f"{litellm_url}/key/generate",
                headers={"Authorization": f"Bearer {master_key}"},
                json=payload,
            )

            if response.status_code >= 400:
                print(
                    f"  FALHOU {response.status_code}: {response.text}",
                    file=sys.stderr,
                )
                continue

            data = response.json()
            full = data.get("key", "")

            # Salva o valor completo num arquivo com perms restritas
            out_file = KEY_OUTPUT_DIR / f"{alias}.txt"
            out_file.write_text(full)
            out_file.chmod(0o600)

            # Log apenas prefixo+sufixo (valor completo só no arquivo)
            redacted = (full[:12] + "…" + full[-4:]) if len(full) > 16 else full
            print(f"  ✅ {alias}: {redacted}  (valor completo em {out_file})")


if __name__ == "__main__":
    asyncio.run(create_keys())
