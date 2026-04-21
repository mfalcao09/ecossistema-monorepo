#!/usr/bin/env python3
"""
YouTube Learn — CRM Benchmark (Pipedrive + playlists relacionadas)
Objetivo: Melhoria do CRM Intentus, Implementação CRM FIC e NEXVY
Pipeline: download yt-dlp → transcrição Gemini → timestamps → frames ffmpeg → README.
Idempotente: pula vídeos já com README.md.
"""

import os, sys, re, json, time, subprocess
from pathlib import Path

# Carrega env do arquivo persistente se GEMINI_API_KEY não estiver no ambiente
ENV_FILE = Path.home() / ".config" / "youtube-learn" / ".env"
if "GEMINI_API_KEY" not in os.environ and ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from google import genai
from google.genai import types

# ── Configuração ──────────────────────────────────────────────────────────────
API_KEY   = os.environ["GEMINI_API_KEY"]
BASE_DIR  = Path("/Users/marcelosilva/Projects/GitHub/ecossistema-monorepo/apps/erp-educacional/.claude/worktrees/compassionate-moore-94f890/docs/research/crm-pipedrive-benchmark")
VIDEOS_DIR = BASE_DIR / "_videos"
LOG_FILE  = BASE_DIR / "process.log"
MODEL     = "gemini-2.5-flash"
COOKIES_FILE = os.environ.get("YT_DLP_COOKIES", "")

# ── Universo de vídeos (deduplicado) ─────────────────────────────────────────
# Coletados das 7 playlists + 5 vídeos individuais fornecidos por Marcelo.
VIDEO_IDS = {
    # Playlist 1 - PL46lQdeTqOcoFTkO54baUqN3pmsatOHCY (Pipedrive core)
    "cU0FYEDRop8", "tR5_hCEg5_8", "17XI_zMpDHo", "KyGbOcHhy68", "bddYQqXyqoY",
    "ST5-NKXpsJM", "oSxO_k6qLyQ", "OsV-r45jxCM", "KSqq6Z43dTo", "Mp3xxzcoKag",
    "pXR-7FkIc-0", "k06RcwPAF44", "Plcn0T4MR1w", "Z4Rgme_VkkA", "cpVqQMiAukI",
    "m9E2ylL7wYM", "VNKImGfLmDg", "RRT7wVXzbkU", "jHNHBd4A5b4", "b9E3aMLPdb0",
    "1HDDMfmi0Mg", "RVKK2126lOI", "eCRafJp7FvA", "iaacYImIKBY", "08FQFOQMm18",
    "e8mR5pRjZgs", "0weUl8i6HDc", "G_uhmWkrmIg", "2wheCOgF4-8", "BCuAlPWbEig",
    "NsVWHeFdqQY", "sPUyUfYQUnM", "KLSnikdL-Bc", "Uwz63MPF7g8", "sS9mJg_zLlQ",
    "ytnN3l-DwMI", "Z6Xb_ZgVzlw", "y0r7wHw7ysE",
    # Playlist 2 - PLHFIJei8PpDF_p4ITkEqoisnaEa2s6UMG (Gestão + CRM diverse)
    "h5HIgs9H9kc", "0LO3GNp4nRk", "jvLrEmtBklg", "D8Ds5b4IKQg", "FsUBo7qYygY",
    "5hemr0AQWyU",
    # Playlist 3 - PL46lQdeTqOcoAOi3gQJJFC4IMrGhGDgAI (Integrações)
    "2NAK7lhrmKE", "TQe8RCKlCrQ", "SNnyt5xlUkM", "W5NuuMlr5kA", "-AE34L7rGjA",
    "nI7aBCgqSPw", "1LGOP5mTMUM", "I1DmgESMhW8", "U7grwXwrc_w", "he3muW7z7gA",
    "BRUL-neGnQ0", "U7UKPDQBpRY", "3lCc-fJeUsk", "Q4T8pFY076c",
    # Playlist 4 - PL46lQdeTqOcp8DFVQwXQgNV-KmkWqaNwD (Sales Pipeline Course EN)
    "3LN1pdDhYb4", "cQmAQ42ZeBo", "w_2H_BscbPU", "QuTU8r4dZ8g", "92KJy2j6qbM",
    "wHH7K7cE-2E", "h1jj2erVpCc", "DkIUfmyn2uk", "cVCoKYVJ7ZE", "TL1lHkHknQU",
    "Al4h_sNVlzo",
    # Playlist 5 - PL46lQdeTqOcoUr-vRb5DadfRdAnB-j9si (CRM + gestão PT/EN mix)
    "TZAIlRj_elw", "8D5SI3piVks", "LM1abgkKwK4", "0i26NrTyqd0", "OF_1ISsE-P8",
    "gz1qjWfjNt8", "BniX19hqIW0", "CWcCP2EW6fA", "kfhU5wbxy-Y", "0J7oTptHTQ8",
    "V-EezSqLtfM", "Fq8VV23FyFM", "1URmjzdrszM", "f9Mr_UtagRw", "EooxkXiujLI",
    # Playlist 6 - PL46lQdeTqOcquvcj-F-_ZmEGVyDI4-07g (Curso Funil Vendas PT)
    "zMx0lXy5xHM", "ARh23HMhucE", "jYguu3zIT2Y", "I3N2Cwo7zII", "bUvvhJKqHk4",
    "LfnMWezrYW0", "HUfG-uQ_ayg", "xkPG4RS0vcE", "X7UL7_0NHiE", "yF_FxyllZPo",
    "pDCJF3U33Sw",
    # Playlist 7 - PL46lQdeTqOcoqle0DffsHX85afNlBi_gS (demo essentials)
    "iHZq78MUWms",
    # Individuais
    "P_r3pGkmYBM", "RRJb7SxGIUw", "MXf64dF4DlU",
}

URLS = [f"https://www.youtube.com/watch?v={vid}" for vid in sorted(VIDEO_IDS)]

client = genai.Client(api_key=API_KEY)

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg: str):
    print(msg, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def video_id(url: str) -> str:
    m = re.search(r"v=([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else url.split("/")[-1]

def ts_to_seconds(ts: str) -> int:
    parts = [int(p) for p in ts.split(":")]
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
                log(f"  [retry] {type(e).__name__} — aguardando {wait}s (tentativa {attempt+1}/{max_retries})")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Falhou após {max_retries} tentativas")

# ── Download ──────────────────────────────────────────────────────────────────

def download_video(url: str, vid: str) -> Path:
    mp4_path = VIDEOS_DIR / f"{vid}.mp4"
    if mp4_path.exists():
        log(f"  [skip] vídeo já baixado: {mp4_path.name}")
        return mp4_path
    log(f"  [download] {url}")
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", str(VIDEOS_DIR / "%(id)s.%(ext)s"),
        "--write-info-json",
        "--no-playlist",
    ]
    if COOKIES_FILE:
        cmd.extend(["--cookies", COOKIES_FILE])
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"  [download-error] {result.stderr[-300:]}")
        return None
    return mp4_path if mp4_path.exists() else None

# ── Gemini ────────────────────────────────────────────────────────────────────

def gemini_upload_file(mp4: Path):
    log(f"  [gemini-upload] {mp4.name} ({mp4.stat().st_size // (1024*1024)}MB)...")
    uploaded = client.files.upload(file=str(mp4))
    while uploaded.state and uploaded.state.name == "PROCESSING":
        time.sleep(5)
        uploaded = client.files.get(name=uploaded.name)
    if not uploaded.state or uploaded.state.name != "ACTIVE":
        raise RuntimeError(f"Upload Gemini falhou: state={uploaded.state}")
    log(f"  [gemini-upload] ok ({uploaded.name})")
    return uploaded


def gemini_generate(source, prompt: str, is_upload: bool = False) -> str:
    if is_upload:
        part = types.Part(file_data=types.FileData(file_uri=source.uri, mime_type=source.mime_type))
    else:
        part = types.Part(file_data=types.FileData(file_uri=source, mime_type="video/*"))
    def _call():
        resp = client.models.generate_content(
            model=MODEL,
            contents=types.Content(parts=[part, types.Part(text=prompt)]),
            config=types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_budget=0))
        )
        return resp.text
    return gemini_with_retry(_call)


def _gemini_with_upload_fallback(url: str, prompt: str, mp4_path: Path = None, uploaded_cache: dict = None):
    vid = mp4_path.stem if mp4_path else None
    if uploaded_cache is not None and vid and vid in uploaded_cache:
        return gemini_generate(uploaded_cache[vid], prompt, is_upload=True)
    try:
        return gemini_generate(url, prompt, is_upload=False)
    except Exception as e:
        msg = str(e)
        if ("403" in msg or "PERMISSION_DENIED" in msg) and mp4_path and mp4_path.exists():
            log(f"  [403 fallback] upload local do MP4...")
            uploaded = gemini_upload_file(mp4_path)
            if uploaded_cache is not None and vid:
                uploaded_cache[vid] = uploaded
            return gemini_generate(uploaded, prompt, is_upload=True)
        raise

# ── Prompts ───────────────────────────────────────────────────────────────────

TRANSCRIBE_PROMPT = (
    "Transcreva INTEGRALMENTE e na íntegra tudo que é falado neste vídeo.\n"
    "- Transcrição palavra por palavra, sem omitir nada\n"
    "- Inclua timestamps no formato [MM:SS] a cada trecho de ~30 segundos\n"
    "- Mantenha exatamente as palavras ditas, inclusive hesitações e marcadores de discurso\n"
    "- Não resuma, não parafraseie — transcreva literalmente\n"
    "- Idioma: preserve o idioma original do vídeo"
)

TIMESTAMPS_PROMPT = (
    "Analise este vídeo completamente e retorne um mapeamento EXAUSTIVO de todos os momentos importantes.\n"
    "Para CADA mudança de tela, nova funcionalidade, passo importante, clique relevante ou informação "
    "em destaque, retorne uma linha no formato:\n"
    "[MM:SS] Descrição breve do que está sendo mostrado na tela\n"
    "Seja o mais detalhado possível. Retorne SOMENTE as linhas [MM:SS], sem texto adicional."
)


def transcribe(url: str, out_file: Path, mp4_path: Path = None, uploaded_cache: dict = None) -> str:
    if out_file.exists() and out_file.stat().st_size > 100:
        log(f"  [skip] transcrição já existe")
        return out_file.read_text()
    log(f"  [gemini] transcrevendo...")
    text = _gemini_with_upload_fallback(url, TRANSCRIBE_PROMPT, mp4_path, uploaded_cache)
    out_file.write_text(text, encoding="utf-8")
    log(f"  [ok] transcrição: {len(text)} chars")
    return text


def get_timestamps(url: str, out_file: Path, mp4_path: Path = None, uploaded_cache: dict = None):
    if out_file.exists() and out_file.stat().st_size > 10:
        log(f"  [skip] timestamps já existem")
        return parse_timestamps(out_file.read_text())
    log(f"  [gemini] extraindo timestamps...")
    raw = _gemini_with_upload_fallback(url, TIMESTAMPS_PROMPT, mp4_path, uploaded_cache)
    out_file.write_text(raw, encoding="utf-8")
    timestamps = parse_timestamps(raw)
    log(f"  [ok] {len(timestamps)} timestamps")
    return timestamps

# ── Frames ────────────────────────────────────────────────────────────────────

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
            "ffmpeg", "-y", "-ss", str(secs), "-i", str(mp4),
            "-frames:v", "1", "-q:v", "2", "-vf", "scale=1280:-2",
            str(fpath)
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0:
            frames.append((ts, desc, fname))
    log(f"  [ok] {len(frames)} frames extraídos")
    return frames

# ── READMEs ───────────────────────────────────────────────────────────────────

def write_readme(out_dir: Path, url: str, vid: str, frames, info: dict):
    title   = info.get("title", vid)
    channel = info.get("channel", info.get("uploader", "?"))
    date    = info.get("upload_date", "?")
    if len(date) == 8:
        date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
    lines = [
        f"# {title}", "",
        f"**URL:** {url}  ",
        f"**Canal:** {channel}  ",
        f"**Data:** {date}  ",
        f"**Objetivo:** Benchmark CRM — Melhoria Intentus, Implementação FIC e NEXVY  ",
        f"**Total de frames:** {len(frames)}", "", "---", "",
    ]
    for ts, desc, fname in frames:
        lines += [f"## `{ts}` — {desc}", "", f"![{desc}]({fname})", ""]
    (out_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def write_index(video_meta: list):
    ok = [m for m in video_meta if m.get("frames", 0) > 0]
    err = [m for m in video_meta if m.get("frames", 0) == 0]
    total_frames = sum(m["frames"] for m in video_meta)
    lines = [
        "# CRM Benchmark — Estudo de Vídeos",
        "",
        "**Fontes:** 7 playlists YouTube (Pipedrive + cursos de funil de vendas + integrações) + 3 vídeos individuais",
        "**Objetivo:** Melhoria do CRM Intentus, Implementação do CRM FIC e NEXVY",
        f"**Data de extração:** 2026-04-20",
        f"**Total de vídeos:** {len(video_meta)} ({len(ok)} com frames · {len(err)} sem frames/erro)",
        f"**Total de frames:** {total_frames}",
        "", "---", "",
        "## Vídeos Processados",
        "",
        "| # | Título | ID | Frames | Pasta |",
        "|---|--------|----|--------|-------|",
    ]
    for i, m in enumerate(video_meta, 1):
        status = m["frames"] if m["frames"] > 0 else "❌"
        lines.append(
            f"| {i} | {m['title'][:80]} | [{m['vid']}]({m['url']}) | {status} | [{m['vid']}/]({m['vid']}/README.md) |"
        )
    lines += ["", "---", "", "*Gerado pelo skill youtube-learn.*"]
    (BASE_DIR / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")

# ── Main loop ─────────────────────────────────────────────────────────────────

def process_video(url: str, idx: int, total: int):
    vid = video_id(url)
    out_dir = BASE_DIR / vid
    out_dir.mkdir(exist_ok=True)

    log(f"\n{'='*60}")
    log(f"[{idx}/{total}] {vid}  {url}")
    log(f"{'='*60}")

    # Idempotência: se já tem README.md, pula
    readme = out_dir / "README.md"
    if readme.exists() and readme.stat().st_size > 200:
        log(f"  [skip-all] README.md já existe, pulando vídeo")
        info_file = VIDEOS_DIR / f"{vid}.info.json"
        info = json.load(open(info_file)) if info_file.exists() else {}
        # conta frames existentes
        frames_count = len(list(out_dir.glob("frame_*.jpg")))
        return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": frames_count}

    mp4 = download_video(url, vid)
    if mp4 is None:
        log(f"  [ERRO] download falhou")
        return {"vid": vid, "url": url, "title": f"[download-fail] {vid}", "frames": 0}

    info_file = VIDEOS_DIR / f"{vid}.info.json"
    info = json.load(open(info_file)) if info_file.exists() else {}

    uploaded_cache: dict = {}

    try:
        transcribe(url, out_dir / "transcricao.txt", mp4_path=mp4, uploaded_cache=uploaded_cache)
        time.sleep(3)
        timestamps = get_timestamps(url, out_dir / "timestamps.txt", mp4_path=mp4, uploaded_cache=uploaded_cache)
    except Exception as e:
        log(f"  [ERRO gemini] {e}")
        return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": 0}

    if not timestamps:
        log(f"  [warn] nenhum timestamp")
        return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": 0}

    frames = extract_frames(mp4, timestamps, out_dir)
    write_readme(out_dir, url, vid, frames, info)
    return {"vid": vid, "url": url, "title": info.get("title", vid), "frames": len(frames)}


def main():
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    video_meta = []
    total = len(URLS)
    log(f"\n### Início: {total} vídeos a processar ###\n")

    for i, url in enumerate(URLS, 1):
        try:
            meta = process_video(url, i, total)
            video_meta.append(meta)
        except Exception as e:
            vid = video_id(url)
            log(f"\n[ERRO FATAL] {vid}: {e}")
            video_meta.append({"vid": vid, "url": url, "title": f"[ERRO] {vid}", "frames": 0})

        # Regenera INDEX.md a cada vídeo (para visibilidade de progresso)
        if i % 5 == 0 or i == total:
            write_index(video_meta)

        if i < total:
            time.sleep(5)

    write_index(video_meta)
    total_frames = sum(m["frames"] for m in video_meta)
    ok = sum(1 for m in video_meta if m["frames"] > 0)
    log(f"\n{'='*60}\nCONCLUÍDO\n  Vídeos OK: {ok}/{total}\n  Total de frames: {total_frames}\n  Pasta: {BASE_DIR}\n{'='*60}")


if __name__ == "__main__":
    main()
