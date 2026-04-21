#!/usr/bin/env python3
"""
Fallback para vídeos bloqueados por bot detection do yt-dlp.
Usa Gemini direto (sem download) → transcrição + timestamps + README (sem frames).
"""
import os, sys, time
from pathlib import Path
# reaproveita tudo do process_videos principal
sys.path.insert(0, str(Path(__file__).parent))
from process_videos import (
    video_id, client, MODEL, gemini_with_retry, parse_timestamps,
    BASE_DIR,
)
from google.genai import types

# Vídeos que falharam no yt-dlp (bot detection)
BLOCKED = [
    "https://www.youtube.com/watch?v=VCsSLNj7vzE",
    "https://www.youtube.com/watch?v=XdikJZkmY7Q",
    "https://www.youtube.com/watch?v=db54n8_3_Sg",
    "https://www.youtube.com/watch?v=-X2jMXU_zos",
    "https://www.youtube.com/watch?v=jbgM0hgvTPc",
    "https://www.youtube.com/watch?v=0I1UH-wIA2s",
    "https://www.youtube.com/watch?v=t1aj8gLs9cI",
    "https://www.youtube.com/watch?v=G0XsZWjQV8c",
    "https://www.youtube.com/watch?v=bvpz84EThEU",
    "https://www.youtube.com/watch?v=qrRvyH0k6l8",
    "https://www.youtube.com/watch?v=-W1Gvw7_QzM",
    "https://www.youtube.com/watch?v=S1liAttRAtw",
    "https://www.youtube.com/watch?v=Lus6OhCWhrg",
]

PROMPT_TRANSCRIBE = (
    "Transcreva INTEGRALMENTE e na íntegra tudo que é falado neste vídeo.\n"
    "- Transcrição palavra por palavra, sem omitir nada\n"
    "- Inclua timestamps no formato [MM:SS] a cada trecho de ~30 segundos\n"
    "- Mantenha exatamente as palavras ditas, inclusive hesitações\n"
    "- Não resuma, não parafraseie — transcreva literalmente\n"
    "- Idioma: preserve o idioma original do vídeo"
)

PROMPT_TIMESTAMPS = (
    "Analise este vídeo completamente e retorne um mapeamento EXAUSTIVO de todos os momentos importantes.\n"
    "Para CADA mudança de tela, nova funcionalidade, passo importante, clique relevante ou informação "
    "em destaque, retorne uma linha no formato:\n"
    "[MM:SS] Descrição breve do que está sendo mostrado na tela\n"
    "Seja o mais detalhado possível. Retorne SOMENTE as linhas [MM:SS], sem texto adicional."
)


def gemini_call(url: str, prompt: str) -> str:
    def _call():
        resp = client.models.generate_content(
            model=MODEL,
            contents=types.Content(parts=[
                types.Part(file_data=types.FileData(file_uri=url, mime_type="video/*")),
                types.Part(text=prompt)
            ]),
            config=types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_budget=0))
        )
        return resp.text
    return gemini_with_retry(_call)


def write_readme_no_frames(out_dir: Path, url: str, vid: str, timestamps):
    lines = [
        f"# {vid} (sem frames — yt-dlp bot detection)",
        "",
        f"**URL:** {url}  ",
        f"**Canal:** ?  ",
        f"**Data:** ?  ",
        f"**Objetivo:** Levantamento Nexvy/DKW whitelabel  ",
        f"**Total de timestamps:** {len(timestamps)}",
        "",
        "> **Aviso:** download via yt-dlp bloqueado ('Sign in to confirm you're not a bot').",
        "> Transcrição e timestamps obtidos diretamente via Gemini 2.5 Flash (sem frames locais).",
        "> Para ver o vídeo, abrir a URL no YouTube.",
        "",
        "---",
        "",
        "## Timestamps",
        "",
    ]
    for ts, desc in timestamps:
        lines.append(f"- `{ts}` — {desc}")
    (out_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def process(url: str, idx: int, total: int):
    vid = video_id(url)
    out_dir = BASE_DIR / vid
    out_dir.mkdir(exist_ok=True)
    print(f"\n[{idx}/{total}] {vid} {url}")

    # Transcrição
    tx_file = out_dir / "transcricao.txt"
    if tx_file.exists():
        print("  [skip] transcrição já existe")
    else:
        print("  [gemini] transcrevendo...")
        try:
            text = gemini_call(url, PROMPT_TRANSCRIBE)
            tx_file.write_text(text, encoding="utf-8")
            print(f"  [ok] transcrição {len(text)} chars")
        except Exception as e:
            print(f"  [ERRO transcribe] {e}")
            return {"vid": vid, "ok": False, "error": str(e)}

    time.sleep(3)

    # Timestamps
    ts_file = out_dir / "timestamps.txt"
    if ts_file.exists():
        print("  [skip] timestamps já existem")
        raw = ts_file.read_text()
    else:
        print("  [gemini] extraindo timestamps...")
        try:
            raw = gemini_call(url, PROMPT_TIMESTAMPS)
            ts_file.write_text(raw, encoding="utf-8")
        except Exception as e:
            print(f"  [ERRO timestamps] {e}")
            return {"vid": vid, "ok": False, "error": str(e)}

    timestamps = parse_timestamps(raw)
    print(f"  [ok] {len(timestamps)} timestamps")

    write_readme_no_frames(out_dir, url, vid, timestamps)
    print(f"  [ok] README.md (sem frames)")
    return {"vid": vid, "ok": True, "timestamps": len(timestamps)}


def main():
    total = len(BLOCKED)
    results = []
    for i, url in enumerate(BLOCKED, 1):
        try:
            r = process(url, i, total)
            results.append(r)
            if i < total:
                time.sleep(5)
        except Exception as e:
            print(f"  [ERRO geral] {e}")
            results.append({"vid": video_id(url), "ok": False, "error": str(e)})

    print(f"\n{'='*60}")
    ok = sum(1 for r in results if r["ok"])
    print(f"CONCLUÍDO: {ok}/{total} ok")
    for r in results:
        status = "✅" if r["ok"] else "❌"
        extra = f"{r.get('timestamps', '?')} ts" if r["ok"] else r.get("error", "?")[:80]
        print(f"  {status} {r['vid']}  {extra}")


if __name__ == "__main__":
    main()
