#!/usr/bin/env python3
"""
YouTube Learn — Nexvy x Outros SaaS de atendimento (Digisac, Zaapy, Chatwoot, Whaticket, Press Ticket).
Processa ~125 vídeos: download, transcrição Gemini, frames ffmpeg, README por vídeo, INDEX por plataforma.
Reutiliza padrão do benchmark Nexvy (fallback upload 403, retry com backoff, idempotente).
"""

import os, sys, re, json, time, subprocess
from pathlib import Path
from google import genai
from google.genai import types

# ── Configuração ──────────────────────────────────────────────────────────────
API_KEY   = os.environ["GEMINI_API_KEY"]
BASE_DIR  = Path("/Users/marcelosilva/Projects/GitHub/ecossistema-monorepo/docs/research/nexvy-outrossaas")
MODEL     = "gemini-2.5-flash"
COOKIES_FILE = os.environ.get("YT_DLP_COOKIES", "")

# URLs organizadas por plataforma (slug → [(url, title)])
PLATFORMS: dict[str, list[tuple[str, str]]] = {
    "digisac": [
        ("https://youtu.be/eEKE5DtHOOU", "Motivos para usar a Plataforma Digisac"),
        ("https://youtu.be/NV1RYl2c4XU", "WhatsApp/Telegram/Web Chat com vários agentes"),
        ("https://youtu.be/xZOAHRYjHYw", "Permissões dos usuários"),
        ("https://youtu.be/80CO3QDLTFQ", "Cadastrar usuários"),
        ("https://youtu.be/URVF8D3tg4w", "Departamentos"),
        ("https://youtu.be/fbveo8QJJgM", "Transferir chamados"),
        ("https://youtu.be/9ujFaEDF2SE", "WhatsApp Business API (WABA)"),
        ("https://youtu.be/kj0HoyWmH-8", "Como Funciona a Plataforma Multicanal"),
        ("https://youtu.be/E0nklIJIhCg", "Mensagens de diversos apps"),
        ("https://youtu.be/8BKKDNm99A0", "Como funciona o CHAT"),
        ("https://youtu.be/JjKqTsV7UWc", "Funcionalidades complementares"),
        ("https://youtu.be/oUgR5aJkvJM", "Porque adquirir a Plataforma"),
        ("https://youtu.be/JSu_P-GB58w", "Integrações DigiSac"),
        ("https://youtu.be/QNKgnk5w92c", "Chat de atendimento"),
        ("https://youtu.be/Swtnf_rwy5I", "IMPLANTAÇÃO"),
        ("https://youtu.be/zC2vEv1DYQM", "TREINAMENTO SETUP ADMINISTRADOR"),
        ("https://youtu.be/2gvfUbRpYqo", "TREINAMENTO PARA OPERADORES"),
        ("https://youtu.be/XH4-eqZhz0A", "FERRAMENTAS AUXILIARES"),
        ("https://youtu.be/Qt7QG5uPoRo", "RELATÓRIOS E ESTATÍSTICAS"),
        ("https://youtu.be/YU6InArSpcs", "CARGOS"),
        ("https://youtu.be/Ub6nAV7UhOo", "CONFIGURACIÓN ADMINISTRADOR (ES)"),
        ("https://youtu.be/WKmBQVxb0CU", "ADMINISTRATOR SETUP (EN)"),
        ("https://youtu.be/ZAbFn5WykUc", "WABA"),
        ("https://youtu.be/5xXSOHH50B4", "Instagram e Facebook"),
        ("https://youtu.be/MysOCMPRWcA", "Novidades de Abril"),
        ("https://youtu.be/La0xiiFT524", "Integrações"),
        ("https://youtu.be/HGZfv4rbRNM", "Novidades da Digisac"),
        ("https://youtu.be/uX5QjqFHe08", "Gestão de Grupos"),
        ("https://youtu.be/_bmYvlDwne8", "Bot: Grupos, Avaliação e Tags Automáticas"),
        ("https://youtu.be/juP0wV4DxX4", "Crie um bot do zero"),
        ("https://youtu.be/cf2JpthwdXA", "Personalizar contatos"),
        ("https://youtu.be/FVmGAakfXRM", "Avaliação de atendimento"),
        ("https://youtu.be/D_S0Z7n0LHE", "Distribuição Automática de Chamados"),
        ("https://youtu.be/CkOCBEhlBj4", "Novidades de Fevereiro"),
        ("https://youtu.be/VvkFa1VoVuA", "Mensagens Interativas e Saúde WABA"),
        ("https://youtu.be/Qh51819F_ms", "Funcionalidades mais Utilizadas"),
        ("https://youtu.be/SD-7PsgDnrw", "IA da Digisac"),
        ("https://youtu.be/XExnwiWqt6Y", "Novidades (produtividade)"),
        ("https://youtu.be/_6wgXKXQ6dg", "IA da Digisac (2)"),
        ("https://youtu.be/kMgFnCcYnQY", "Funil de Vendas: Retrospectiva"),
        ("https://youtu.be/WAUoUwQUsbo", "Respostas Rápidas com Mídias"),
        ("https://youtu.be/XcjmgAWFuLo", "Mensagens Automáticas de Fim de Ano"),
        ("https://youtu.be/ccz1hLM-H_Y", "Campanhas no WABA"),
        ("https://youtu.be/Af_APOgSIsk", "WABA da Digisac"),
        ("https://youtu.be/eh_gY8ov7yA", "Menu Meu Plano"),
        ("https://youtu.be/6xDjbdVBgaU", "Funil de Vendas (feature)"),
        ("https://youtu.be/1friKYWQT5U", "Histórico de chamados"),
        ("https://youtu.be/J6QtEvdaNm4", "Chat Interno"),
        ("https://youtu.be/w07OLhksiY8", "Distribuição de Chamados"),
        ("https://youtu.be/v3bYlGnNIWI", "Funcionalidades Auxiliares: Empresas"),
        ("https://youtu.be/GVrJIhaB0Xs", "Cargos: permissões"),
        ("https://youtu.be/gxgmsVG6opo", "Modelo padrão de robô"),
        ("https://youtu.be/ksMm49vf73o", "Protocolos de atendimento"),
        ("https://youtu.be/OOO9EA7PYR4", "Tags"),
        ("https://youtu.be/EQrd8YRD8iA", "Respostas rápidas"),
        ("https://youtu.be/pAI0VIFW8SI", "Agendamento de mensagens"),
        ("https://youtu.be/9PjfF0PEUng", "Classificar chamados por assuntos"),
        ("https://youtu.be/kXVQNo06li4", "Feedback em campanhas"),
        ("https://youtu.be/-36PlXWXTlU", "NPS e CSAT"),
        ("https://youtu.be/LQS7Vs8k7dw", "Imersão: Canais"),
        ("https://youtu.be/wDMMqAYdo_I", "Imersão: Funcionalidades"),
        ("https://youtu.be/RaQgXSZicls", "Caixa de Entrada #8 IA"),
        ("https://youtu.be/lp6a6bkTbdc", "Caixa de Entrada #7 Black Friday"),
        ("https://youtu.be/jA8NuQtwL5s", "Caixa de Entrada #6 CX digital"),
        ("https://youtu.be/pvGe3EJvw5o", "Caixa de Entrada #5 Jurídico"),
        ("https://youtu.be/0IHSdW0sOs0", "Caixa de Entrada #4 WhatsApp Mktg"),
        ("https://youtu.be/bvwV6P--m9U", "Caixa de Entrada #3 Pequeno negócio"),
        ("https://youtu.be/Ts5LJUbWNTA", "Caixa de Entrada #2 Customer Success"),
        ("https://youtu.be/nhxI-8oUzeY", "Caixa de Entrada #1 Análise de Dados"),
        ("https://youtu.be/USwNQSVfeqc", "Habilitar Número WABA em 5 passos"),
    ],
    "zaapy": [
        ("https://youtu.be/XGfvI5mCiLg", "Black Friday Ativação White Label"),
        ("https://youtu.be/RoV0eXJwkVs", "Kanban Multi Atendimento"),
        ("https://youtu.be/k1wEL0iyt_Q", "Multi Atendimento Omnichannel"),
        ("https://youtu.be/9i9-NBZHuaw", "Dashboard"),
        ("https://youtu.be/5J2Uw5wlkKg", "Gerenciamento de Contatos"),
        ("https://youtu.be/1f7hjZ9zgEg", "Regras de Acesso"),
        ("https://youtu.be/qaXTl7tDPNI", "Respostas Rápidas"),
        ("https://youtu.be/4ZX8VQRuX-M", "Etiquetas"),
        ("https://youtu.be/w35qxiYuHXs", "Usuários"),
        ("https://youtu.be/IXKVDXVEKGQ", "Conexões"),
        ("https://youtu.be/Hs1lNBbXX2k", "Assistente de IA"),
        ("https://youtu.be/SZqXgqfIDdw", "Fluxograma 1"),
        ("https://youtu.be/1INOIkn2yJ0", "Fluxograma 2"),
        ("https://youtu.be/HgdKt_f2Twk", "Fluxograma 3"),
        ("https://youtu.be/DoYw8muE66Y", "Chat de Atendimento"),
        ("https://youtu.be/hb7nyUoPB88", "Grupos de WhatsApp"),
        ("https://youtu.be/Rq3TWCcL3d0", "Disparo de Mensagens"),
        ("https://youtu.be/EwfLh4stjC4", "Relatório Completo"),
        ("https://youtu.be/FhCheLrwgvQ", "Disparo em Massa (Mulberry)"),
        ("https://youtu.be/A7gdTIPAxWY", "Fluxos com IA"),
        ("https://youtu.be/TOt1Kwgjw98", "Etiquetas White Label"),
        ("https://youtu.be/sOBl6F6a-mI", "Agentes de IA GPT"),
        ("https://youtu.be/rWTmGJ-YMSc", "Opinião honesta"),
        ("https://youtu.be/BNDxEAIiLCY", "Zaapy 5.0 Regras de Acesso"),
        ("https://youtu.be/fnewPV_ctKo", "Respostas Rápidas"),
        ("https://youtu.be/M7L-K6WWF-A", "White Label Revenda"),
        ("https://youtu.be/Cr21k6MGoIQ", "Usuários e funções"),
        ("https://youtu.be/Fcg4_Pu2FlQ", "Gerenciamento grupo WhatsApp"),
        ("https://youtu.be/EkgmraUZI2g", "Dashboards"),
    ],
    "chatwoot": [
        ("https://youtu.be/sx-pDFsLQ5M", "Plataforma multicanal"),
        ("https://youtu.be/HFOFBdAuWjU", "Configurações iniciais"),
        ("https://youtu.be/LWhHxVI1Gvw", "Regras de automação"),
        ("https://youtu.be/5XmbQfAHsBY", "Integrando com Site"),
        ("https://youtu.be/ZsZ01S-9nkc", "Integrating with Dashboards"),
        ("https://youtu.be/s6q-cf1wquI", "Integrando com Dialogflow"),
    ],
    "whaticket": [
        ("https://youtu.be/jHORKJKH_Es", "0 Apresentação"),
        ("https://youtu.be/p8f1d9kA0Ig", "1 Filas e Chatbot"),
        ("https://youtu.be/349QlZCA80Q", "2 Conexões"),
        ("https://youtu.be/AcenJ0NS6_M", "3 Usuários"),
        ("https://youtu.be/X5oXDpgV3wE", "4 Atendimentos"),
        ("https://youtu.be/dFaX1QRG_g4", "5 Respostas Rápidas"),
        ("https://youtu.be/0J0VLpe90s8", "6 Kanban"),
        ("https://youtu.be/8UqyBRmvV1s", "7 Contato"),
        ("https://youtu.be/QNG9A3gXNrg", "8 Agendamento"),
        ("https://youtu.be/1lD0HQ_Tokg", "9 Respostas Rápidas Parte 2"),
    ],
    "pressticket": [
        ("https://youtu.be/6t1ljh3b39Q", "Apresentação WhatsApp"),
        ("https://youtu.be/3_baFxN-0Ks", "01 Conectar WhatsApp"),
        ("https://youtu.be/4_I7-Qczyg4", "02 Atendimento"),
        ("https://youtu.be/AUpfJEDNevM", "03 Agendamento"),
        ("https://youtu.be/ql90obWUpU4", "04 Respostas Rápidas"),
        ("https://youtu.be/M3m-46Kbleg", "05 TAG e Kanban"),
        ("https://youtu.be/LWuW1sJgDNg", "06 Filas e Departamentos"),
        ("https://youtu.be/WoPaaVFjhR0", "07 Fluxo Menu Atendimento"),
        ("https://youtu.be/GXjP8szPOzU", "08 Transferência de fluxo"),
        ("https://youtu.be/jR0x1g7GiNQ", "09 Palavra Chave"),
        ("https://youtu.be/yjz15WGxHXA", "10 Fluxo Variável IF Else"),
        ("https://youtu.be/bcCx82ekFBg", "11 Eleven Labs Integração"),
        ("https://youtu.be/Ca0JQgUqX-Y", "12 Gestão de Horários"),
        ("https://youtu.be/q7UqPS2ZLfM", "13 Inteligência artificial"),
        ("https://youtu.be/7RblwKisJm4", "14 2a Via Boleto / Faturas"),
        ("https://youtu.be/MrQsFoiuNzI", "15 Remarketing"),
        ("https://youtu.be/vTeNur7wFzk", "16 Campanhas"),
        ("https://youtu.be/4BgG0emPBVE", "17 CRM ATUALIZADO"),
    ],
}

OBJETIVO = "Benchmark de plataformas SaaS de atendimento para aprimorar o módulo Atendimento (Nexvy/FIC)"

client = genai.Client(api_key=API_KEY)

# ── Helpers ───────────────────────────────────────────────────────────────────

def video_id(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]+)", url)
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
                kind = "503" if "503" in msg or "UNAVAILABLE" in msg else "rate-limit"
                print(f"  [{kind}] aguardando {wait}s... (tentativa {attempt+1}/{max_retries})", flush=True)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Falhou após {max_retries} tentativas")

# ── Download ──────────────────────────────────────────────────────────────────

def download_video(url: str, vid: str, videos_dir: Path) -> Path:
    out_tmpl = str(videos_dir / "%(id)s.%(ext)s")
    mp4_path = videos_dir / f"{vid}.mp4"
    if mp4_path.exists():
        print(f"  [skip] vídeo já baixado: {mp4_path.name}", flush=True)
        return mp4_path
    print(f"  [download] {url}", flush=True)
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", out_tmpl,
        "--write-info-json",
        "--no-playlist",
    ]
    if COOKIES_FILE:
        cmd.extend(["--cookies", COOKIES_FILE])
    cmd.append(url)
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    except subprocess.CalledProcessError as e:
        print(f"  [yt-dlp-error] {e.stderr.decode()[-500:] if e.stderr else e}", flush=True)
        raise
    return mp4_path


def gemini_upload_file(mp4: Path):
    print(f"  [gemini-upload] {mp4.name} ({mp4.stat().st_size // (1024*1024)}MB)...", flush=True)
    uploaded = client.files.upload(file=str(mp4))
    while uploaded.state and uploaded.state.name == "PROCESSING":
        time.sleep(5)
        uploaded = client.files.get(name=uploaded.name)
    if not uploaded.state or uploaded.state.name != "ACTIVE":
        raise RuntimeError(f"Upload Gemini falhou: state={uploaded.state}")
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
            print(f"  [403 fallback] upload local do MP4", flush=True)
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


def transcribe(url, out_file, mp4_path=None, uploaded_cache=None):
    if out_file.exists() and out_file.stat().st_size > 100:
        print(f"  [skip] transcrição existe", flush=True)
        return out_file.read_text()
    print(f"  [gemini] transcrevendo...", flush=True)
    text = _gemini_with_upload_fallback(url, TRANSCRIBE_PROMPT, mp4_path, uploaded_cache)
    out_file.write_text(text, encoding="utf-8")
    print(f"  [ok] transcrição: {len(text)} chars", flush=True)
    return text


def get_timestamps(url, out_file, mp4_path=None, uploaded_cache=None):
    if out_file.exists() and out_file.stat().st_size > 10:
        print(f"  [skip] timestamps existem", flush=True)
        return parse_timestamps(out_file.read_text())
    print(f"  [gemini] extraindo timestamps...", flush=True)
    raw = _gemini_with_upload_fallback(url, TIMESTAMPS_PROMPT, mp4_path, uploaded_cache)
    out_file.write_text(raw, encoding="utf-8")
    timestamps = parse_timestamps(raw)
    print(f"  [ok] {len(timestamps)} timestamps", flush=True)
    return timestamps


def extract_frames(mp4, timestamps, out_dir):
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
    print(f"  [ok] {len(frames)} frames extraídos", flush=True)
    return frames


def write_readme(out_dir, url, vid, title_hint, frames, info):
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
        f"**Total de frames:** {len(frames)}",
        "",
        "---",
        "",
    ]
    for ts, desc, fname in frames:
        lines += [f"## `{ts}` — {desc}", "", f"![{desc}]({fname})", ""]
    (out_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


# ── Processing ────────────────────────────────────────────────────────────────

def process_video(platform: str, url: str, title_hint: str, idx: int, total: int):
    platform_dir = BASE_DIR / platform
    videos_dir = platform_dir / "_videos"
    videos_dir.mkdir(parents=True, exist_ok=True)

    vid = video_id(url)
    out_dir = platform_dir / vid
    out_dir.mkdir(exist_ok=True)

    readme = out_dir / "README.md"
    if readme.exists() and readme.stat().st_size > 300:
        print(f"[{idx}/{total}] [{platform}] {vid} — já processado", flush=True)
        # ler contagem de frames do README para INDEX
        content = readme.read_text()
        frames_count = content.count("![")
        info_file = videos_dir / f"{vid}.info.json"
        info = {}
        if info_file.exists():
            try:
                info = json.loads(info_file.read_text())
            except Exception:
                pass
        return {"vid": vid, "url": url, "title": info.get("title", title_hint), "frames": frames_count, "platform": platform}

    print(f"\n[{idx}/{total}] [{platform}] {vid}  {url}", flush=True)

    mp4 = download_video(url, vid, videos_dir)

    info_file = videos_dir / f"{vid}.info.json"
    info = {}
    if info_file.exists():
        try:
            info = json.loads(info_file.read_text())
        except Exception:
            pass

    uploaded_cache: dict = {}

    transcribe(url, out_dir / "transcricao.txt", mp4_path=mp4, uploaded_cache=uploaded_cache)
    time.sleep(3)
    timestamps = get_timestamps(url, out_dir / "timestamps.txt", mp4_path=mp4, uploaded_cache=uploaded_cache)

    if not timestamps:
        print(f"  [warn] sem timestamps — pulando frames", flush=True)
        return {"vid": vid, "url": url, "title": info.get("title", title_hint), "frames": 0, "platform": platform}

    frames = extract_frames(mp4, timestamps, out_dir)
    write_readme(out_dir, url, vid, title_hint, frames, info)

    # Libera espaço: remove MP4 após frames extraídos (mantém info.json + frames + txt)
    if frames and mp4.exists():
        try:
            mp4.unlink()
            print(f"  [cleanup] MP4 removido ({mp4.name})", flush=True)
        except Exception as e:
            print(f"  [warn] falha ao remover MP4: {e}", flush=True)

    return {"vid": vid, "url": url, "title": info.get("title", title_hint), "frames": len(frames), "platform": platform}


def write_platform_index(platform: str, metas: list):
    platform_dir = BASE_DIR / platform
    lines = [
        f"# {platform.upper()} — Vídeos processados",
        "",
        f"**Plataforma:** {platform}",
        f"**Objetivo:** {OBJETIVO}",
        f"**Total:** {len(metas)} vídeos",
        "",
        "| # | Título | ID | Frames | Pasta |",
        "|---|--------|----|--------|-------|",
    ]
    for i, m in enumerate(metas, 1):
        lines.append(f"| {i} | {m['title']} | [{m['vid']}]({m['url']}) | {m['frames']} | [{m['vid']}/]({m['vid']}/README.md) |")
    (platform_dir / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")


def write_global_index(all_metas: list):
    lines = [
        "# Nexvy x Outros SaaS — Benchmark de Atendimento",
        "",
        f"**Objetivo:** {OBJETIVO}",
        f"**Total de vídeos:** {len(all_metas)}",
        f"**Total de frames:** {sum(m['frames'] for m in all_metas)}",
        "",
        "## Plataformas",
        "",
    ]
    by_plat: dict = {}
    for m in all_metas:
        by_plat.setdefault(m["platform"], []).append(m)
    for plat, metas in by_plat.items():
        total_frames = sum(m["frames"] for m in metas)
        lines.append(f"- **[{plat}]({plat}/INDEX.md)** — {len(metas)} vídeos, {total_frames} frames")
    lines += [
        "",
        "## Estrutura",
        "",
        "```",
        "nexvy-outrossaas/",
        "├── 00-video-list.md",
        "├── INDEX.md (este)",
        "├── process_videos.py",
        "├── <plataforma>/",
        "│   ├── INDEX.md",
        "│   ├── _videos/          ← .mp4 + .info.json",
        "│   └── <video-id>/",
        "│       ├── README.md      ← frames com timestamps",
        "│       ├── transcricao.txt",
        "│       ├── timestamps.txt",
        "│       └── frame_XXX_MM-SS.jpg",
        "```",
        "",
        "*Gerado pelo skill youtube-learn — 2026-04-22*",
    ]
    (BASE_DIR / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    all_metas = []
    total = sum(len(v) for v in PLATFORMS.values())
    idx = 0

    for platform, videos in PLATFORMS.items():
        platform_metas = []
        for url, title_hint in videos:
            idx += 1
            try:
                meta = process_video(platform, url, title_hint, idx, total)
                platform_metas.append(meta)
                all_metas.append(meta)
            except Exception as e:
                vid = video_id(url)
                print(f"  [ERRO] {platform}/{vid}: {e}", flush=True)
                platform_metas.append({"vid": vid, "url": url, "title": f"ERRO: {title_hint}", "frames": 0, "platform": platform})
                all_metas.append(platform_metas[-1])
            time.sleep(3)
            # salva indexes incrementais após cada vídeo
            write_platform_index(platform, platform_metas)
            write_global_index(all_metas)

    print(f"\n{'='*60}", flush=True)
    print(f"CONCLUÍDO", flush=True)
    print(f"  Vídeos processados: {len([m for m in all_metas if not m['title'].startswith('ERRO')])}/{total}", flush=True)
    print(f"  Total de frames: {sum(m['frames'] for m in all_metas)}", flush=True)
    print(f"  Pasta: {BASE_DIR}", flush=True)


if __name__ == "__main__":
    main()
