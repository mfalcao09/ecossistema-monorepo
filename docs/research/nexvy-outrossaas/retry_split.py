#!/usr/bin/env python3
"""Retry para vídeos que falharam por token-limit (400 INVALID_ARGUMENT).
Estratégia: baixar MP4 completo → split em 2 metades via ffmpeg → upload Gemini
local de cada parte → concatenar transcrições e timestamps (offset parte B) →
extrair frames com offset correto → gerar README único por vídeo.

Uso: python3 retry_split.py
"""
import os, re, json, time, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from process_videos import (
    BASE_DIR, MODEL, OBJETIVO, client, types,
    gemini_with_retry, ts_to_seconds, parse_timestamps, download_video,
    gemini_upload_file, gemini_generate,
    TRANSCRIBE_PROMPT, TIMESTAMPS_PROMPT
)

# Lista de vídeos que falharam com 400 INVALID_ARGUMENT (token-limit)
TOKEN_LIMIT_FAILURES = [
    ("digisac", "Swtnf_rwy5I", "https://youtu.be/Swtnf_rwy5I", "IMPLANTAÇÃO"),
    ("digisac", "XH4-eqZhz0A", "https://youtu.be/XH4-eqZhz0A", "FERRAMENTAS AUXILIARES"),
    ("digisac", "CkOCBEhlBj4", "https://youtu.be/CkOCBEhlBj4", "Novidades de Fevereiro"),
    ("digisac", "Qh51819F_ms", "https://youtu.be/Qh51819F_ms", "Funcionalidades mais Utilizadas"),
    ("digisac", "kXVQNo06li4", "https://youtu.be/kXVQNo06li4", "Feedback em campanhas"),
    ("digisac", "RaQgXSZicls", "https://youtu.be/RaQgXSZicls", "Caixa de Entrada #8 IA"),
]


def ffprobe_duration(mp4: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(mp4)],
        capture_output=True, text=True, check=True
    )
    return float(r.stdout.strip())


def split_mp4(mp4: Path, out_dir: Path, duration: float) -> tuple[Path, Path]:
    """Split em 2 metades. Retorna (parte_a, parte_b)."""
    half = duration / 2
    part_a = out_dir / f"{mp4.stem}_partA.mp4"
    part_b = out_dir / f"{mp4.stem}_partB.mp4"

    if not part_a.exists():
        print(f"  [split] parte A (0..{half:.0f}s)", flush=True)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp4), "-ss", "0", "-t", str(half),
             "-c", "copy", str(part_a)],
            check=True, capture_output=True
        )
    if not part_b.exists():
        print(f"  [split] parte B ({half:.0f}..{duration:.0f}s)", flush=True)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp4), "-ss", str(half),
             "-c", "copy", str(part_b)],
            check=True, capture_output=True
        )
    return part_a, part_b


def shift_timestamps(text: str, offset_seconds: float) -> str:
    """Adiciona offset aos timestamps [MM:SS] do texto."""
    out_lines = []
    pat = re.compile(r'\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]')
    for line in text.splitlines():
        def rep(m):
            h = int(m.group(3) or 0) if m.group(3) else 0
            if m.group(3):  # HH:MM:SS
                h = int(m.group(1))
                mn = int(m.group(2))
                s = int(m.group(3))
            else:  # MM:SS
                mn = int(m.group(1))
                s = int(m.group(2))
                h = 0
            total = h*3600 + mn*60 + s + int(offset_seconds)
            nh = total // 3600
            nm = (total % 3600) // 60
            ns = total % 60
            if nh > 0:
                return f"[{nh:02d}:{nm:02d}:{ns:02d}]"
            return f"[{nm:02d}:{ns:02d}]"
        out_lines.append(pat.sub(rep, line))
    return "\n".join(out_lines)


def process_part(part_mp4: Path, prompt: str) -> str:
    uploaded = gemini_upload_file(part_mp4)
    return gemini_generate(uploaded, prompt, is_upload=True)


def extract_frames_with_offset(full_mp4: Path, timestamps: list, out_dir: Path) -> list:
    """Extrai frames usando o MP4 COMPLETO (timestamps já com offset aplicado)."""
    frames = []
    for i, (ts, desc) in enumerate(timestamps):
        slug = ts.replace(":", "-")
        fname = f"frame_{i:03d}_{slug}.jpg"
        fpath = out_dir / fname
        if fpath.exists():
            frames.append((ts, desc, fname))
            continue
        secs = ts_to_seconds(ts)
        r = subprocess.run(
            ["ffmpeg", "-y", "-ss", str(secs), "-i", str(full_mp4),
             "-frames:v", "1", "-q:v", "2", "-vf", "scale=1280:-2", str(fpath)],
            capture_output=True
        )
        if r.returncode == 0:
            frames.append((ts, desc, fname))
    return frames


def write_readme(out_dir: Path, url: str, vid: str, title_hint: str, frames: list, info: dict):
    title   = info.get("title", title_hint or vid)
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
        f"**Objetivo:** {OBJETIVO}  ",
        f"**Total de frames:** {len(frames)}  ",
        f"**Processamento:** split em 2 partes (token-limit)",
        "",
        "---",
        "",
    ]
    for ts, desc, fname in frames:
        lines += [f"## `{ts}` — {desc}", "", f"![{desc}]({fname})", ""]
    (out_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def process_video_split(platform: str, vid: str, url: str, title_hint: str):
    print(f"\n{'='*60}\n[{platform}/{vid}] {title_hint}\n{'='*60}", flush=True)

    platform_dir = BASE_DIR / platform
    videos_dir = platform_dir / "_videos"
    out_dir = platform_dir / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)

    # 1. Download MP4 completo
    mp4 = download_video(url, vid, videos_dir)

    # 2. Duração + split
    duration = ffprobe_duration(mp4)
    print(f"  [duration] {duration:.0f}s ({duration/60:.1f}min)", flush=True)
    half = duration / 2
    part_a, part_b = split_mp4(mp4, videos_dir, duration)

    # 3. Gemini em cada parte
    transc_a = out_dir / "transcricao_partA.txt"
    transc_b = out_dir / "transcricao_partB.txt"
    ts_a = out_dir / "timestamps_partA.txt"
    ts_b = out_dir / "timestamps_partB.txt"

    if not transc_a.exists():
        print(f"  [gemini] transcrevendo parte A...", flush=True)
        transc_a.write_text(process_part(part_a, TRANSCRIBE_PROMPT), encoding="utf-8")
    time.sleep(5)
    if not ts_a.exists():
        print(f"  [gemini] timestamps parte A...", flush=True)
        ts_a.write_text(process_part(part_a, TIMESTAMPS_PROMPT), encoding="utf-8")
    time.sleep(5)
    if not transc_b.exists():
        print(f"  [gemini] transcrevendo parte B...", flush=True)
        transc_b.write_text(process_part(part_b, TRANSCRIBE_PROMPT), encoding="utf-8")
    time.sleep(5)
    if not ts_b.exists():
        print(f"  [gemini] timestamps parte B...", flush=True)
        ts_b.write_text(process_part(part_b, TIMESTAMPS_PROMPT), encoding="utf-8")

    # 4. Concatenar transcrições com marcadores
    combined_transc = (
        f"[PARTE A — 0s a {half:.0f}s]\n\n"
        + transc_a.read_text() + "\n\n"
        + f"[PARTE B — {half:.0f}s a {duration:.0f}s (timestamps com offset aplicado)]\n\n"
        + shift_timestamps(transc_b.read_text(), half)
    )
    (out_dir / "transcricao.txt").write_text(combined_transc, encoding="utf-8")

    # 5. Timestamps combinados (parte B com offset)
    ts_b_shifted = shift_timestamps(ts_b.read_text(), half)
    combined_ts = ts_a.read_text().strip() + "\n" + ts_b_shifted.strip()
    (out_dir / "timestamps.txt").write_text(combined_ts, encoding="utf-8")

    timestamps = parse_timestamps(combined_ts)
    print(f"  [ok] {len(timestamps)} timestamps combinados", flush=True)

    # 6. Extrair frames usando MP4 completo (timestamps já ajustados)
    frames = extract_frames_with_offset(mp4, timestamps, out_dir)
    print(f"  [ok] {len(frames)} frames extraídos", flush=True)

    # 7. README
    info_file = videos_dir / f"{vid}.info.json"
    info = {}
    if info_file.exists():
        try:
            info = json.loads(info_file.read_text())
        except Exception:
            pass
    write_readme(out_dir, url, vid, title_hint, frames, info)

    # 8. Cleanup MP4s
    for f in [mp4, part_a, part_b]:
        if f.exists():
            f.unlink()
    print(f"  [cleanup] MP4s removidos", flush=True)

    return {"vid": vid, "platform": platform, "frames": len(frames), "title": info.get("title", title_hint)}


def main():
    results = []
    for platform, vid, url, title_hint in TOKEN_LIMIT_FAILURES:
        try:
            r = process_video_split(platform, vid, url, title_hint)
            results.append(r)
        except Exception as e:
            print(f"  [ERRO-SPLIT] {platform}/{vid}: {e}", flush=True)
            results.append({"vid": vid, "platform": platform, "frames": 0, "title": f"ERRO: {title_hint}"})
        time.sleep(10)

    print(f"\n{'='*60}", flush=True)
    print(f"RETRY-SPLIT CONCLUÍDO", flush=True)
    print(f"  Sucessos: {len([r for r in results if r['frames'] > 0])}/{len(TOKEN_LIMIT_FAILURES)}", flush=True)
    print(f"  Frames totais: {sum(r['frames'] for r in results)}", flush=True)
    for r in results:
        print(f"    {r['platform']}/{r['vid']}: {r['frames']} frames — {r['title']}", flush=True)


if __name__ == "__main__":
    main()
