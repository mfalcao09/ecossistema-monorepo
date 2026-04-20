#!/usr/bin/env python3
"""
YouTube Learn — Nexvy/DKW Whitelabel
Processa 5 vídeos: download, transcrição Gemini, frames ffmpeg, README por vídeo.
"""

import os, sys, re, json, time, subprocess, textwrap
from pathlib import Path
from google import genai
from google.genai import types

# ── Configuração ──────────────────────────────────────────────────────────────
API_KEY   = os.environ["GEMINI_API_KEY"]
BASE_DIR  = Path("/Users/marcelosilva/Projects/GitHub/ecossistema-monorepo/docs/research/nexvy-whitelabel")
VIDEOS_DIR = BASE_DIR / "_videos"
MODEL     = "gemini-2.5-flash"

URLS = [
    # Lote 1 — original (console.nexvy.tech, já processados)
    "https://www.youtube.com/watch?v=O-T-9NAK9tU",
    "https://www.youtube.com/watch?v=E3fpTjW5kQE",
    "https://www.youtube.com/watch?v=y3CFR97J2Bo",
    "https://www.youtube.com/watch?v=N8n8LaxuZLc",
    "https://www.youtube.com/watch?v=StCaGpA1fmA",
    # Lote 2 — helenaCRM playlist (PLAvjoRyIXgEvXBTHoPoUHVlkRU8y7vpcM)
    "https://www.youtube.com/watch?v=q8-nq80aNxY",
    "https://www.youtube.com/watch?v=_L92FINjcUI",
    "https://www.youtube.com/watch?v=oVifwnIL7jo",
    "https://www.youtube.com/watch?v=580FqSbP0vY",
    "https://www.youtube.com/watch?v=HYKeZWyBCwY",
    "https://www.youtube.com/watch?v=wgsaW6I9KIM",
    "https://www.youtube.com/watch?v=XeemWygayPo",
    # Lote 3 — Conceitos/Usuários/Permissões (PLAvjoRyIXgEvCsyeKq_8IkTBTnU5Y0tw6)
    "https://www.youtube.com/watch?v=GTX_QLA1zeg",
    "https://www.youtube.com/watch?v=XWd-0Gj6R6E",
    "https://www.youtube.com/watch?v=oGs_ByuGDWc",
    "https://www.youtube.com/watch?v=Olr6prKExSo",
    "https://www.youtube.com/watch?v=-LctSvm1Mzo",
    "https://www.youtube.com/watch?v=LsdXRmS7Agk",
    "https://www.youtube.com/watch?v=_KeeL_5wG5k",
    "https://www.youtube.com/watch?v=1lrBXAnV31I",
    "https://www.youtube.com/watch?v=QlGUrIGjc44",
    # Lote 4 — Relatórios/Indicadores (PLAvjoRyIXgEvkLv19P46IeJno-moRJJL7)
    "https://www.youtube.com/watch?v=dNaKezWr_LY",
    "https://www.youtube.com/watch?v=0_0i72W2s68",
    "https://www.youtube.com/watch?v=t2bF8-5uui8",
    "https://www.youtube.com/watch?v=olMQTujz724",
    "https://www.youtube.com/watch?v=iTuVYvn347I",
    "https://www.youtube.com/watch?v=B8E5ab6SATs",
    # Lote 5 — CRM/Contatos/Cards (PLAvjoRyIXgEurgovB9aSOnCZ6cSWvOdNW)
    "https://www.youtube.com/watch?v=TBl14qCjbcM",
    "https://www.youtube.com/watch?v=PvfppQNxQZs",
    "https://www.youtube.com/watch?v=oOq8AVnwx7g",
    "https://www.youtube.com/watch?v=hu38xgDc-l8",
    "https://www.youtube.com/watch?v=ssG53BDi1K0",
    "https://www.youtube.com/watch?v=VAa4tqrsFqI",
    "https://www.youtube.com/watch?v=g0_lGAnSzdY",
    # Lote 6 — Chatbot/Campanhas/Mensagens Agendadas (PLAvjoRyIXgEuAnYB1aEPHls1KEDYYz3SK)
    "https://www.youtube.com/watch?v=RFn_fw6wYOw",
    "https://www.youtube.com/watch?v=Xf6tFnM4va4",
    "https://www.youtube.com/watch?v=6RFcmRoD4E0",
    "https://www.youtube.com/watch?v=AMDg3hbrui0",
    "https://www.youtube.com/watch?v=CDOdwqe_-KE",
    "https://www.youtube.com/watch?v=SHTF1dwAtuc",
    "https://www.youtube.com/watch?v=YpFcjGiMw2I",
    "https://www.youtube.com/watch?v=JHONOag6fEo",
    "https://www.youtube.com/watch?v=yH5ysNLTAXE",
    "https://www.youtube.com/watch?v=X115LzVAliA",
    "https://www.youtube.com/watch?v=Bm9r57cOqMM",
    "https://www.youtube.com/watch?v=VCsSLNj7vzE",
    # Lote 7 — Parceiros/White Label (PLAvjoRyIXgEtbo6wgn46QAtdC6x5VsFFQ)
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
    # Lote 8 — Individual
    "https://www.youtube.com/watch?v=Lus6OhCWhrg",
]

client = genai.Client(api_key=API_KEY)

# ── Helpers ───────────────────────────────────────────────────────────────────

def video_id(url: str) -> str:
    m = re.search(r"v=([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else url.split("/")[-1]

def ts_to_seconds(ts: str) -> int:
    parts = ts.split(":")
    parts = [int(p) for p in parts]
    if len(parts) == 2:
        return parts[0]*60 + parts[1]
    return parts[0]*3600 + parts[1]*60 + parts[2]

def parse_timestamps(text: str):
    pattern = re.compile(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)')
    results = []
    for line in text.strip().splitlines():
        m = pattern.search(line)
        if m:
            results.append((m.group(1), m.group(2).strip()))
    return results

def gemini_with_retry(fn, max_retries=6):
    delays = [15, 30, 60, 90, 120, 180]
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            msg = str(e)
            retryable = (
                "429" in msg or "RESOURCE_EXHAUSTED" in msg
                or "503" in msg or "UNAVAILABLE" in msg
                or "500" in msg or "INTERNAL" in msg
                or "504" in msg or "DEADLINE_EXCEEDED" in msg
            )
            if retryable and attempt < max_retries - 1:
                wait = delays[min(attempt, len(delays)-1)]
                kind = "503" if "503" in msg or "UNAVAILABLE" in msg else "rate-limit"
                print(f"  [{kind}] aguardando {wait}s... (tentativa {attempt+1}/{max_retries})")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Falhou após {max_retries} tentativas")

# ── Etapa 1: Download ─────────────────────────────────────────────────────────

def download_video(url: str, vid: str) -> Path:
    out_tmpl = str(VIDEOS_DIR / "%(id)s.%(ext)s")
    mp4_path = VIDEOS_DIR / f"{vid}.mp4"
    if mp4_path.exists():
        print(f"  [skip] vídeo já baixado: {mp4_path.name}")
        return mp4_path
    print(f"  [download] {url}")
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", out_tmpl,
        "--write-info-json",
        "--no-playlist",
        url
    ]
    subprocess.run(cmd, check=True)
    return mp4_path

# ── Etapa 2: Transcrição ──────────────────────────────────────────────────────

def transcribe(url: str, out_file: Path) -> str:
    if out_file.exists():
        print(f"  [skip] transcrição já existe")
        return out_file.read_text()
    print(f"  [gemini] transcrevendo...")
    prompt = (
        "Transcreva INTEGRALMENTE e na íntegra tudo que é falado neste vídeo.\n"
        "- Transcrição palavra por palavra, sem omitir nada\n"
        "- Inclua timestamps no formato [MM:SS] a cada trecho de ~30 segundos\n"
        "- Mantenha exatamente as palavras ditas, inclusive hesitações e marcadores de discurso\n"
        "- Não resuma, não parafraseie — transcreva literalmente\n"
        "- Idioma: preserve o idioma original do vídeo"
    )
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
    text = gemini_with_retry(_call)
    out_file.write_text(text, encoding="utf-8")
    print(f"  [ok] transcrição: {len(text)} chars → {out_file.name}")
    return text

# ── Etapa 3: Timestamps ───────────────────────────────────────────────────────

def get_timestamps(url: str, out_file: Path):
    if out_file.exists():
        print(f"  [skip] timestamps já existem")
        raw = out_file.read_text()
        return parse_timestamps(raw)
    print(f"  [gemini] extraindo timestamps...")
    prompt = (
        "Analise este vídeo completamente e retorne um mapeamento EXAUSTIVO de todos os momentos importantes.\n"
        "Para CADA mudança de tela, nova funcionalidade, passo importante, clique relevante ou informação "
        "em destaque, retorne uma linha no formato:\n"
        "[MM:SS] Descrição breve do que está sendo mostrado na tela\n"
        "Seja o mais detalhado possível. Retorne SOMENTE as linhas [MM:SS], sem texto adicional."
    )
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
    raw = gemini_with_retry(_call)
    out_file.write_text(raw, encoding="utf-8")
    timestamps = parse_timestamps(raw)
    print(f"  [ok] {len(timestamps)} timestamps → {out_file.name}")
    return timestamps

# ── Etapa 4: Extração de frames ───────────────────────────────────────────────

def extract_frames(mp4: Path, timestamps, out_dir: Path):
    frames = []
    for i, (ts, desc) in enumerate(timestamps):
        slug = ts.replace(":", "-")
        fname = f"frame_{i:03d}_{slug}.jpg"
        fpath = out_dir / fname
        if fpath.exists():
            frames.append((ts, desc, fname))
            continue
        secs = ts_to_seconds(ts)
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(secs),
            "-i", str(mp4),
            "-frames:v", "1",
            "-q:v", "2",
            "-vf", "scale=1280:-2",
            str(fpath)
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0:
            frames.append((ts, desc, fname))
        else:
            print(f"    [warn] falha frame {ts}: {result.stderr[-100:]}")
    print(f"  [ok] {len(frames)} frames extraídos")
    return frames

# ── Etapa 5: README.md ────────────────────────────────────────────────────────

def write_readme(out_dir: Path, url: str, vid: str, frames, info: dict):
    title   = info.get("title", vid)
    channel = info.get("channel", info.get("uploader", "?"))
    date    = info.get("upload_date", "?")
    if len(date) == 8:
        date = f"{date[:4]}-{date[4:6]}-{date[6:]}"

    lines = [
        f"# {title}",
        "",
        f"**URL:** {url}  ",
        f"**Canal:** {channel}  ",
        f"**Data:** {date}  ",
        f"**Objetivo:** Levantamento da plataforma Nexvy/DKW whitelabel para replicação de UI  ",
        f"**Total de frames:** {len(frames)}",
        "",
        "---",
        "",
    ]
    for ts, desc, fname in frames:
        lines += [
            f"## `{ts}` — {desc}",
            "",
            f"![{desc}]({fname})",
            "",
        ]
    readme = "\n".join(lines)
    (out_dir / "README.md").write_text(readme, encoding="utf-8")
    print(f"  [ok] README.md gerado ({len(frames)} frames)")

# ── Etapa 6: INDEX.md ─────────────────────────────────────────────────────────

def write_index(video_meta: list):
    lines = [
        "# Nexvy/DKW Whitelabel — Estudo de Vídeos",
        "",
        "**Plataforma:** console.nexvy.tech (whitelabel DKW)",
        "**Objetivo:** Levantamento visual e funcional para replicação da UI",
        f"**Data de extração:** 2026-04-18",
        "",
        "---",
        "",
        "## Vídeos Processados",
        "",
        "| # | Título | ID | Frames | Pasta |",
        "|---|--------|----|--------|-------|",
    ]
    for i, m in enumerate(video_meta, 1):
        lines.append(f"| {i} | {m['title']} | [{m['vid']}]({m['url']}) | {m['frames']} | [{m['vid']}/]({m['vid']}/README.md) |")

    lines += [
        "",
        "---",
        "",
        "## Screenshots da Sessão de Mapeamento",
        "",
        "Salvos em: `screenshots/`  ",
        "Último lote: telas de gestão de tenants (Painel Parceiro)",
        "",
        "---",
        "",
        "*Gerado automaticamente pelo skill youtube-learn — S089*",
    ]
    (BASE_DIR / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"[ok] INDEX.md gerado")

# ── Main ──────────────────────────────────────────────────────────────────────

def process_video(url: str, idx: int, total: int):
    vid = video_id(url)
    out_dir = BASE_DIR / vid
    out_dir.mkdir(exist_ok=True)

    print(f"\n{'='*60}")
    print(f"[{idx}/{total}] {vid}  {url}")
    print(f"{'='*60}")

    # Download
    mp4 = download_video(url, vid)

    # Metadados
    info_file = VIDEOS_DIR / f"{vid}.info.json"
    info = {}
    if info_file.exists():
        with open(info_file) as f:
            info = json.load(f)

    # Transcrição
    transcribe(url, out_dir / "transcricao.txt")

    # Timestamps
    time.sleep(3)  # respeita rate limit entre chamadas
    timestamps = get_timestamps(url, out_dir / "timestamps.txt")

    if not timestamps:
        print(f"  [warn] nenhum timestamp encontrado — pulando frames")
        return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": 0}

    # Frames
    frames = extract_frames(mp4, timestamps, out_dir)

    # README
    write_readme(out_dir, url, vid, frames, info)

    return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": len(frames)}


def main():
    VIDEOS_DIR.mkdir(exist_ok=True)
    video_meta = []
    total = len(URLS)

    for i, url in enumerate(URLS, 1):
        try:
            meta = process_video(url, i, total)
            video_meta.append(meta)
            if i < total:
                print(f"\n  [delay] aguardando 5s antes do próximo vídeo...")
                time.sleep(5)
        except Exception as e:
            vid = video_id(url)
            print(f"\n  [ERRO] {vid}: {e}")
            video_meta.append({"vid": vid, "url": url, "title": f"ERRO: {vid}", "frames": 0})

    write_index(video_meta)

    print(f"\n{'='*60}")
    print(f"CONCLUÍDO")
    print(f"  Vídeos processados: {len([m for m in video_meta if 'ERRO' not in m['title']])}/{total}")
    print(f"  Total de frames: {sum(m['frames'] for m in video_meta)}")
    print(f"  Pasta: {BASE_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
