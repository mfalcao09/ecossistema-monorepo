#!/usr/bin/env python3
"""Worker de plataforma única.
Uso: python3 process_platform.py <platform>
Onde <platform> ∈ {digisac, zaapy, chatwoot, whaticket, pressticket}
"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from process_videos import PLATFORMS, process_video, write_platform_index, video_id


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in PLATFORMS:
        print(f"Uso: {sys.argv[0]} <platform>\nOpções: {list(PLATFORMS.keys())}")
        sys.exit(1)

    platform = sys.argv[1]
    videos = PLATFORMS[platform]
    total = len(videos)
    metas = []

    for idx, (url, title_hint) in enumerate(videos, 1):
        try:
            meta = process_video(platform, url, title_hint, idx, total)
            metas.append(meta)
        except Exception as e:
            vid = video_id(url)
            print(f"  [ERRO] {platform}/{vid}: {e}", flush=True)
            metas.append({"vid": vid, "url": url, "title": f"ERRO: {title_hint}", "frames": 0, "platform": platform})
        time.sleep(3)
        write_platform_index(platform, metas)

    ok = len([m for m in metas if not m['title'].startswith('ERRO')])
    frames = sum(m['frames'] for m in metas)
    print(f"\n[{platform.upper()}] CONCLUÍDO — {ok}/{total} ok, {frames} frames", flush=True)


if __name__ == "__main__":
    main()
