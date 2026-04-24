#!/usr/bin/env python3
"""Worker paralelo: processa zaapy, chatwoot, whaticket, pressticket.
Não escreve INDEX.md global (worker principal cuida disso).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from process_videos import (
    PLATFORMS, process_video, write_platform_index, video_id
)
import time

SUBSET = ["zaapy", "chatwoot", "whaticket", "pressticket"]


def main():
    all_metas = []
    subset_videos = [(p, url, t) for p in SUBSET for url, t in PLATFORMS[p]]
    total = len(subset_videos)
    idx = 0

    platform_buckets: dict = {p: [] for p in SUBSET}

    for platform, url, title_hint in subset_videos:
        idx += 1
        try:
            meta = process_video(platform, url, title_hint, idx, total)
            platform_buckets[platform].append(meta)
            all_metas.append(meta)
        except Exception as e:
            vid = video_id(url)
            print(f"  [ERRO-W2] {platform}/{vid}: {e}", flush=True)
            meta = {"vid": vid, "url": url, "title": f"ERRO: {title_hint}", "frames": 0, "platform": platform}
            platform_buckets[platform].append(meta)
            all_metas.append(meta)
        time.sleep(3)
        write_platform_index(platform, platform_buckets[platform])

    print(f"\n[W2] CONCLUÍDO — {len(all_metas)} vídeos, {sum(m['frames'] for m in all_metas)} frames", flush=True)


if __name__ == "__main__":
    main()
