#!/usr/bin/env python3
"""
Regenera INDEX.md baseado no estado real de cada pasta de vídeo.
- Vídeo com frames → "Completo"
- Vídeo sem frames (só transcrição) → "Parcial"
- Vídeo ausente → "Bloqueado"
"""
import json
from pathlib import Path

BASE = Path(__file__).parent
VIDEOS_DIR = BASE / "_videos"

# Ordem canônica das URLs (idêntica ao process_videos.py)
URLS = [
    # Lote 1
    "O-T-9NAK9tU", "E3fpTjW5kQE", "y3CFR97J2Bo", "N8n8LaxuZLc", "StCaGpA1fmA",
    # Lote 2 — helenaCRM playlist 1
    "q8-nq80aNxY", "_L92FINjcUI", "oVifwnIL7jo", "580FqSbP0vY",
    "HYKeZWyBCwY", "wgsaW6I9KIM", "XeemWygayPo",
    # Lote 3 — Conceitos/Usuários/Permissões
    "GTX_QLA1zeg", "XWd-0Gj6R6E", "oGs_ByuGDWc", "Olr6prKExSo",
    "-LctSvm1Mzo", "LsdXRmS7Agk", "_KeeL_5wG5k", "1lrBXAnV31I", "QlGUrIGjc44",
    # Lote 4 — Relatórios/Indicadores
    "dNaKezWr_LY", "0_0i72W2s68", "t2bF8-5uui8", "olMQTujz724",
    "iTuVYvn347I", "B8E5ab6SATs",
    # Lote 5 — CRM/Contatos
    "TBl14qCjbcM", "PvfppQNxQZs", "oOq8AVnwx7g", "hu38xgDc-l8",
    "ssG53BDi1K0", "VAa4tqrsFqI", "g0_lGAnSzdY",
    # Lote 6 — Chatbot/Campanhas
    "RFn_fw6wYOw", "Xf6tFnM4va4", "6RFcmRoD4E0", "AMDg3hbrui0", "CDOdwqe_-KE",
    "SHTF1dwAtuc", "YpFcjGiMw2I", "JHONOag6fEo", "yH5ysNLTAXE", "X115LzVAliA",
    "Bm9r57cOqMM", "VCsSLNj7vzE",
    # Lote 7 — Parceiros/White Label
    "XdikJZkmY7Q", "db54n8_3_Sg", "-X2jMXU_zos", "jbgM0hgvTPc", "0I1UH-wIA2s",
    "t1aj8gLs9cI", "G0XsZWjQV8c", "bvpz84EThEU", "qrRvyH0k6l8",
    "-W1Gvw7_QzM", "S1liAttRAtw",
    # Lote 8 — solto
    "Lus6OhCWhrg",
]


def status_of(vid: str):
    folder = BASE / vid
    if not folder.exists():
        return "bloqueado", 0, 0, ""
    readme = folder / "README.md"
    if not readme.exists():
        return "bloqueado", 0, 0, ""
    frames = list(folder.glob("frame_*.jpg"))
    ts_file = folder / "timestamps.txt"
    nts = 0
    if ts_file.exists():
        nts = sum(1 for l in ts_file.read_text().splitlines() if l.strip().startswith("["))
    info = VIDEOS_DIR / f"{vid}.info.json"
    title = ""
    if info.exists():
        try:
            d = json.loads(info.read_text())
            title = d.get("title", "")
        except Exception:
            pass
    if not title:
        # Try reading from README first line
        first = readme.read_text().splitlines()[0]
        title = first.lstrip("# ").strip()
    if frames:
        return "completo", len(frames), nts, title
    else:
        return "parcial", 0, nts, title


def main():
    completos = []
    parciais = []
    bloqueados = []
    for vid in URLS:
        st, nf, nts, title = status_of(vid)
        row = {"vid": vid, "frames": nf, "timestamps": nts, "title": title or vid}
        if st == "completo":
            completos.append(row)
        elif st == "parcial":
            parciais.append(row)
        else:
            bloqueados.append(row)

    lines = [
        "# Nexvy/DKW Whitelabel — Estudo de Vídeos",
        "",
        "**Plataforma:** console.nexvy.tech (whitelabel DKW) · helenaCRM (mesma plataforma)",
        "**Objetivo:** Levantamento visual e funcional para replicação da UI",
        "**Data de extração:** 2026-04-20",
        "",
        "---",
        "",
        f"## Resumo",
        "",
        f"- **Total de vídeos na fila:** {len(URLS)}",
        f"- **Processados completos (frames + transcrição + timestamps):** {len(completos)}",
        f"- **Processados parciais (transcrição + timestamps, sem frames — yt-dlp bot-blocked):** {len(parciais)}",
        f"- **Bloqueados (Gemini 403 PERMISSION_DENIED — vídeos unlisted):** {len(bloqueados)}",
        f"- **Total de frames extraídos:** {sum(r['frames'] for r in completos)}",
        f"- **Total de timestamps catalogados:** {sum(r['timestamps'] for r in completos + parciais)}",
        "",
        "---",
        "",
        f"## Vídeos Processados — Completos ({len(completos)})",
        "",
        "| # | Título | ID | Frames | Timestamps | Pasta |",
        "|---|--------|----|--------|------------|-------|",
    ]
    for i, r in enumerate(completos, 1):
        lines.append(
            f"| {i} | {r['title']} | [{r['vid']}](https://www.youtube.com/watch?v={r['vid']}) | "
            f"{r['frames']} | {r['timestamps']} | [{r['vid']}/]({r['vid']}/README.md) |"
        )

    if parciais:
        lines += ["", "---", "", f"## Processados Parciais — sem frames ({len(parciais)})", ""]
        lines += ["| # | Título | ID | Timestamps | Pasta |",
                  "|---|--------|----|------------|-------|"]
        for i, r in enumerate(parciais, 1):
            lines.append(
                f"| {i} | {r['title']} | [{r['vid']}](https://www.youtube.com/watch?v={r['vid']}) | "
                f"{r['timestamps']} | [{r['vid']}/]({r['vid']}/README.md) |"
            )
        lines += ["",
                  "> **Por que só parciais:** yt-dlp foi bloqueado pelo YouTube com _\"Sign in to confirm you're not a bot\"_ para esses vídeos.",
                  "> Gemini 2.5 Flash conseguiu transcrever diretamente via URL, mas sem MP4 local, não foi possível cortar frames.",
                  ""]

    if bloqueados:
        lines += ["", "---", "", f"## Bloqueados ({len(bloqueados)})", ""]
        lines += ["| # | ID | URL |", "|---|----|----|"]
        for i, r in enumerate(bloqueados, 1):
            lines.append(
                f"| {i} | {r['vid']} | https://www.youtube.com/watch?v={r['vid']} |"
            )
        lines += ["",
                  "> **Por que bloqueados:** Gemini retornou 403 PERMISSION_DENIED ao tentar acessar estes vídeos.",
                  "> Todos da playlist \"Parceiros\" (PLAvjoRyIXgEtbo6wgn46QAtdC6x5VsFFQ) — provavelmente unlisted/restritos.",
                  "> Para desbloquear: rodar yt-dlp com `--cookies-from-browser` numa conta que tenha acesso, depois reprocessar.",
                  ""]

    lines += [
        "---",
        "",
        "## Screenshots da Sessão de Mapeamento",
        "",
        "Salvos em `screenshots/` — 225 PNGs da navegação guiada pelo console.nexvy.tech.",
        "Inclui: gestão de tenants (Painel Parceiro), dashboards, configurações, chatbot builder, CRM.",
        "",
        "---",
        "",
        "## Plano de Levantamento",
        "",
        "Ver `PLANO-LEVANTAMENTO-NEXVY.md` — 24 seções da UI mapeadas com design tokens (primary `#345EF3`, Roboto 14px, MUI v4).",
        "",
        "---",
        "",
        "*Gerado automaticamente pelo skill youtube-learn — S089*",
    ]

    (BASE / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"[ok] INDEX.md regenerado: {len(completos)} completos, {len(parciais)} parciais, {len(bloqueados)} bloqueados")


if __name__ == "__main__":
    main()
