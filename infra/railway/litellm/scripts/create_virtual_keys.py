"""
create_virtual_keys.py — gera as 6 virtual keys no LiteLLM proxy.

Pré-requisitos:
  - Proxy já deployado e acessível em LITELLM_URL
  - LITELLM_MASTER_KEY válida exportada
  - Arquivos YAML em config/virtual_keys/ prontos

Pós-execução:
  - Cada key gerada DEVE ser imediatamente salva em ecosystem_credentials
    via SC-29 Modo B (quando Fase 1 subir).
  - Enquanto SC-29 não está ativo, salvar cada key em env var do serviço
    que vai consumi-la (ex.: LITELLM_KEY_FIC em Railway do ERP-educacional).

Uso:
  export LITELLM_URL=https://litellm.ecossistema.internal
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
            # IMPORTANTE: em produção, não printar a key completa.
            # Aqui mostramos prefixo só para conferência manual.
            full = data.get("key", "")
            redacted = (full[:12] + "…" + full[-4:]) if len(full) > 16 else full
            print(f"  ✅ {alias}: {redacted}  (salvar em Vault/env)")


if __name__ == "__main__":
    asyncio.run(create_keys())
