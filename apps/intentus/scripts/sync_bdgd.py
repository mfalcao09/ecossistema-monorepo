#!/usr/bin/env python3
"""
sync_bdgd.py — ETL streaming da BDGD (ANEEL) para Supabase PostGIS

Fluxo por distribuidora:
  1. lista DCAT-US do ArcGIS Hub ANEEL → 114 entries V11
  2. para cada (já não processada nesse ciclo):
     a. download .gdb.zip via /sharing/rest/content/items/{id}/data
     b. unzip
     c. ogr2ogr extrai UNSEGMT/UNSEGBT/SUB → CSV WKT simplificado a ~10m
     d. psql \\COPY pra staging table
     e. INSERT INTO bdgd_*_segments com cast/clean
     f. log + cleanup arquivos locais

Idempotente: bdgd_sync_log marca cada (cod_aneel, arcgis_item_id, ciclo) como
done — re-rodar só processa novos ou atualizados.

Uso:
  SUPABASE_DB_URL=postgresql://... python3 sync_bdgd.py [--filter REGEX]
                                                        [--only-mt]
                                                        [--simplify-deg 0.0001]
                                                        [--dry-run]

Streaming: nunca mantém >5 GB no disco. Pico = maior .gdb.zip + extração temporária.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from contextlib import contextmanager
from pathlib import Path

DCAT_URL = "https://dadosabertos-aneel.opendata.arcgis.com/api/feed/dcat-us/1.1.json"
ITEM_DATA_URL = "https://aneel.maps.arcgis.com/sharing/rest/content/items/{item_id}/data"

TITLE_PATTERN = re.compile(
    r"^(.+?)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+V11\s+(\d{8}-\d{4})\s*$"
)

# Mapa best-effort distribuidora → UF (pra coluna bdgd_distribuidoras.uf_principal).
# Não é canônico — alguns nomes cobrem múltiplos estados.
UF_HEURISTIC = {
    "energisa mt": "MT", "energisa ms": "MS", "energisa pb": "PB",
    "energisa se": "SE", "energisa to": "TO", "energisa ac": "AC",
    "energisa ro": "RO", "energisa minas rio": "MG",
    "energisa sul-sudeste": "SP", "energisa borborema": "PB",
    "energisa nova friburgo": "RJ",
    "enel sp": "SP", "enel rj": "RJ", "enel ce": "CE", "enel go": "GO",
    "equatorial go": "GO", "equatorial pa": "PA", "equatorial ma": "MA",
    "equatorial pi": "PI", "equatorial al": "AL", "cea equatorial": "AP",
    "ceee equatorial": "RS",
    "cpfl paulista": "SP", "cpfl piratininga": "SP", "cpfl santa cruz": "SP",
    "edp sp": "SP", "edp es": "ES",
    "neoenergia coelba": "BA", "neoenergia cosern": "RN",
    "neoenergia pernambuco": "PE", "neoenergia brasilia": "DF",
    "neoenergia elektro": "SP",
    "cemig-d": "MG", "celesc-dis": "SC", "copel-dis": "PR",
    "rge": "RS", "rge sul": "RS", "light": "RJ",
    "amazonas energia": "AM", "ame": "AM",
    "roraima energia": "RR", "boa vista": "RR",
    "elektro": "SP", "celpa": "PA", "celpe": "PE", "cepisa": "PI",
    "ceron": "RO", "eletroacre": "AC", "cea": "AP", "sulgipe": "SE",
    "dmed": "MG", "dcelt": "PR",
}

# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------

def log(msg: str, level: str = "INFO"):
    print(f"[{time.strftime('%H:%M:%S')}] [{level}] {msg}", flush=True)

def fmt_size(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"

def run(cmd, env=None, check=True, capture=False):
    """Roda comando e propaga exit code."""
    if capture:
        return subprocess.run(cmd, env=env, check=check, capture_output=True, text=True)
    return subprocess.run(cmd, env=env, check=check)

def guess_uf(nome: str) -> str | None:
    return UF_HEURISTIC.get(nome.lower().strip())

# ----------------------------------------------------------------------------
# DCAT discovery
# ----------------------------------------------------------------------------

def fetch_dcat() -> list[dict]:
    """Lista todas as distribuidoras V11 do feed DCAT da ANEEL."""
    log(f"Fetching DCAT feed: {DCAT_URL}")
    with urllib.request.urlopen(DCAT_URL, timeout=60) as resp:
        data = json.load(resp)

    entries = []
    seen = {}  # nome upper → entry mais recente
    for item in data.get("dataset", []):
        title = (item.get("title") or "").strip()
        if title.endswith("- Link") or title.endswith("-Link"):
            continue
        m = TITLE_PATTERN.match(title)
        if not m:
            continue
        nome, cod, ciclo, pub = m.group(1).strip(), m.group(2), m.group(3), m.group(4)
        ident = item.get("identifier", "")
        m2 = re.search(r"id=([a-f0-9]{32})", ident)
        if not m2:
            continue
        item_id = m2.group(1)
        key = nome.upper()
        cur = seen.get(key)
        if not cur or ciclo > cur["ciclo"]:
            seen[key] = {
                "nome": nome, "cod_aneel": cod, "ciclo": ciclo, "pub": pub,
                "item_id": item_id, "uf": guess_uf(nome),
            }
    entries = sorted(seen.values(), key=lambda r: r["nome"].lower())
    log(f"DCAT: {len(entries)} distribuidoras V11 encontradas")
    return entries

# ----------------------------------------------------------------------------
# Postgres helpers (psql via subprocess pra suportar \COPY)
# ----------------------------------------------------------------------------

def psql(db_url: str, sql: str, capture: bool = False):
    """Executa SQL via psql -c."""
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-c", sql]
    return run(cmd, capture=capture)


def check_db_connection(db_url: str) -> None:
    """Sanity check: connection + schema. Sai com diagnóstico claro se falhar."""
    log("Verificando conexão com Supabase...")
    try:
        out = subprocess.run(
            ["psql", db_url, "-At", "-X", "-c",
             "SELECT 1 FROM bdgd_distribuidoras LIMIT 1; SELECT version();"],
            capture_output=True, text=True, timeout=30,
        )
    except subprocess.TimeoutExpired:
        log("❌ TIMEOUT conectando no DB (>30s)", "ERROR")
        log("   Verifique se SUPABASE_DB_URL aponta pra Session pooler "
            "(porta 5432) e não pra Direct connection (IPv6)", "ERROR")
        sys.exit(3)

    if out.returncode != 0:
        stderr = (out.stderr or "").strip()
        log(f"❌ FALHA conexão Supabase (psql exit {out.returncode})", "ERROR")
        log(f"   stderr: {stderr[:600]}", "ERROR")
        log("", "ERROR")
        log("Causas comuns:", "ERROR")
        log("  1. SUPABASE_DB_URL não tem a senha real — substituiu [YOUR-PASSWORD]?", "ERROR")
        log("  2. Senha tem caracteres especiais sem URL-encode (use %40 pra @, etc.)", "ERROR")
        log("  3. Você copiou Direct connection (IPv6) em vez de Session pooler (IPv4)", "ERROR")
        log("  4. Tabela bdgd_distribuidoras não existe (migration não foi aplicada)", "ERROR")
        log("", "ERROR")
        log("Pra corrigir o secret:", "ERROR")
        log("  Supabase Dashboard → Project Settings → Database → Connect button", "ERROR")
        log("  → aba 'Session pooler' → copia URI completa com senha real", "ERROR")
        log("  → GitHub repo Settings → Secrets → atualiza SUPABASE_DB_URL", "ERROR")
        sys.exit(3)

    log(f"✅ Conexão OK — {out.stdout.strip().splitlines()[-1][:80]}")

def psql_file(db_url: str, sql_path: Path):
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-f", str(sql_path)]
    return run(cmd)

def already_synced(db_url: str, cod_aneel: str, item_id: str, ciclo: str) -> bool:
    """Checa se essa (cod, item, ciclo) já tem sync com status='success'."""
    cmd = [
        "psql", db_url, "-At", "-X", "-c",
        f"SELECT 1 FROM bdgd_sync_log WHERE cod_aneel='{cod_aneel}' "
        f"AND arcgis_item_id='{item_id}' AND ciclo='{ciclo}' "
        f"AND status='success' LIMIT 1;",
    ]
    out = run(cmd, capture=True)
    return out.stdout.strip() == "1"

def upsert_distribuidora(db_url: str, entry: dict, size_bytes: int) -> int:
    """INSERT ON CONFLICT — retorna id da distribuidora."""
    nome = entry["nome"].replace("'", "''")
    uf = f"'{entry['uf']}'" if entry.get("uf") else "NULL"
    sql = f"""
INSERT INTO bdgd_distribuidoras
  (cod_aneel, nome, uf_principal, arcgis_item_id, ciclo, versao_prodist, size_bytes, last_synced_at)
VALUES
  ('{entry['cod_aneel']}', '{nome}', {uf}, '{entry['item_id']}',
   '{entry['ciclo']}', 'V11', {size_bytes}, NULL)
ON CONFLICT (cod_aneel) DO UPDATE SET
  nome = EXCLUDED.nome,
  uf_principal = EXCLUDED.uf_principal,
  arcgis_item_id = EXCLUDED.arcgis_item_id,
  ciclo = EXCLUDED.ciclo,
  size_bytes = EXCLUDED.size_bytes,
  updated_at = now()
RETURNING id;
"""
    cmd = ["psql", db_url, "-At", "-X", "-c", sql]
    out = run(cmd, capture=True)
    return int(out.stdout.strip().split("\n")[0])

def log_sync_start(db_url: str, entry: dict, size_bytes: int) -> int:
    sql = f"""
INSERT INTO bdgd_sync_log
  (cod_aneel, arcgis_item_id, ciclo, versao_prodist, status, size_bytes)
VALUES
  ('{entry['cod_aneel']}', '{entry['item_id']}', '{entry['ciclo']}', 'V11',
   'started', {size_bytes})
RETURNING id;
"""
    cmd = ["psql", db_url, "-At", "-X", "-c", sql]
    out = run(cmd, capture=True)
    return int(out.stdout.strip().split("\n")[0])

def log_sync_finish(db_url, log_id, status, mt, bt, sub, secs, err=None):
    err_sql = f"'{err.replace(chr(39), chr(39)+chr(39))[:500]}'" if err else "NULL"
    sql = f"""
UPDATE bdgd_sync_log SET
  status='{status}',
  features_mt={mt or 'NULL'},
  features_bt={bt or 'NULL'},
  features_sub={sub or 'NULL'},
  duration_seconds={secs},
  error_message={err_sql},
  finished_at=now()
WHERE id={log_id};
"""
    psql(db_url, sql)

# ----------------------------------------------------------------------------
# Download streaming
# ----------------------------------------------------------------------------

def head_size(item_id: str) -> int:
    url = ITEM_DATA_URL.format(item_id=item_id)
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return int(resp.headers.get("Content-Length", "0"))

def download_streaming(item_id: str, dest: Path, expected_size: int):
    url = ITEM_DATA_URL.format(item_id=item_id)
    log(f"  download → {dest.name} ({fmt_size(expected_size)})")
    t0 = time.time()
    downloaded = 0
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)  # 1 MB
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if expected_size and downloaded % (50 << 20) == 0:
                pct = 100 * downloaded / expected_size
                log(f"    {fmt_size(downloaded)} / {fmt_size(expected_size)} ({pct:.0f}%)")
    elapsed = time.time() - t0
    rate = downloaded / max(1, elapsed) / (1 << 20)
    log(f"  download OK em {elapsed:.0f}s ({rate:.1f} MB/s)")

# ----------------------------------------------------------------------------
# ogr2ogr extraction
# ----------------------------------------------------------------------------

def find_gdb(extracted_dir: Path) -> Path:
    """Localiza o .gdb dentro do diretório extraído."""
    for p in extracted_dir.rglob("*.gdb"):
        if p.is_dir():
            return p
    raise RuntimeError(f"Nenhum .gdb encontrado em {extracted_dir}")

def list_layers(gdb: Path) -> set[str]:
    """
    Lista layers de um .gdb. Tenta múltiplos approaches porque ogrinfo varia
    de output entre versões GDAL.

    Formatos observados:
      "1: UNSEGMT (Multi Line String)"      ← GDAL >=3.5 com -q
      "Layer: UNSEMT (Point)"                ← GDAL >=3.4 sem -q
      "Layer name: UNSEGMT"                  ← GDAL antigos
    """
    layers: set[str] = set()
    # Approach 1: ogrinfo SEM -q (verbose, mais confiável em GDAL >=3.4)
    try:
        out = subprocess.run(
            ["ogrinfo", "-ro", "-so", str(gdb)],
            capture_output=True, text=True, check=False, timeout=60,
        )
        text = out.stdout + "\n" + out.stderr
        for line in text.splitlines():
            # formato 1: "1: NAME (TYPE)"
            m = re.match(r"^\s*\d+:\s+(\S+)", line)
            if m:
                layers.add(m.group(1).upper())
                continue
            # formato 2: "Layer: NAME (TYPE)"  (GDAL 3.4+)
            m2 = re.match(r"^\s*Layer:\s+(\S+)", line)
            if m2:
                layers.add(m2.group(1).upper())
                continue
            # formato 3: "Layer name: NAME"  (GDAL antigo)
            m3 = re.match(r"^\s*Layer name:\s*(\S+)", line)
            if m3:
                layers.add(m3.group(1).upper())
    except Exception as e:
        log(f"  ogrinfo verbose falhou: {e}", "WARN")

    # Approach 2: --formats listing (fallback) — só se nada veio
    if not layers:
        try:
            out2 = subprocess.run(
                ["ogrinfo", "-ro", "-q", str(gdb)],
                capture_output=True, text=True, check=False, timeout=60,
            )
            for line in out2.stdout.splitlines():
                m = re.match(r"^\s*\d+:\s+(\S+)", line)
                if m:
                    layers.add(m.group(1).upper())
        except Exception:
            pass

    # Log defensivo se ainda vazio
    if not layers:
        try:
            raw = subprocess.run(
                ["ogrinfo", "-ro", str(gdb)],
                capture_output=True, text=True, check=False, timeout=60,
            )
            log(f"  ogrinfo raw stdout (truncado): {raw.stdout[:500]}", "WARN")
            log(f"  ogrinfo raw stderr (truncado): {raw.stderr[:300]}", "WARN")
        except Exception:
            pass

    return layers

def extract_layer_to_csv(
    gdb: Path, layer: str, dest_csv: Path, simplify_deg: float, fields: list[str],
):
    """
    ogr2ogr GDB → CSV com geometria WKT em EPSG:4326, simplify aplicado.
    -simplify usa unidade do SRS de saída (graus em 4326).
    """
    select = ",".join(fields)
    cmd = [
        "ogr2ogr",
        "-f", "CSV",
        str(dest_csv),
        str(gdb),
        layer,
        "-t_srs", "EPSG:4326",
        "-simplify", str(simplify_deg),
        "-select", select,
        "-lco", "GEOMETRY=AS_WKT",
        "-lco", "SEPARATOR=COMMA",
        "-skipfailures",
    ]
    run(cmd)

# ----------------------------------------------------------------------------
# CSV → Postgres via staging + INSERT ... SELECT
# ----------------------------------------------------------------------------

def load_mt_csv(db_url: str, csv: Path, distribuidora_id: int) -> int:
    if not csv.exists() or csv.stat().st_size == 0:
        return 0
    staging = f"_staging_mt_{distribuidora_id}"
    setup = f"""
DROP TABLE IF EXISTS {staging};
CREATE UNLOGGED TABLE {staging} (
  wkt TEXT, COD_ID TEXT, CTMT TEXT, TEN_OPE TEXT,
  FAS_CON TEXT, COMP TEXT, TIP_CND TEXT, POS_CAB TEXT, MUN TEXT
);
"""
    psql(db_url, setup)
    # \COPY via psql -c não funciona com arquivo path absoluto direto, usar -f
    copy_sql = (
        f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    )
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", copy_sql]
    run(cmd)
    insert = f"""
INSERT INTO bdgd_mt_segments
  (distribuidora_id, cod_id, ctmt, tensao_kv, fases, comprimento_m,
   tipo_cabo, posicao, cod_municipio, geom)
SELECT
  {distribuidora_id},
  COD_ID,
  CTMT,
  NULLIF(TEN_OPE,'')::NUMERIC,
  FAS_CON,
  NULLIF(COMP,'')::NUMERIC,
  TIP_CND,
  POS_CAB,
  MUN,
  ST_GeomFromText(wkt, 4326)::geography
FROM {staging}
WHERE wkt IS NOT NULL AND wkt <> '';
"""
    psql(db_url, insert)
    out = run(["psql", db_url, "-At", "-X", "-c",
               f"SELECT COUNT(*) FROM {staging};"], capture=True)
    n = int(out.stdout.strip() or "0")
    psql(db_url, f"DROP TABLE IF EXISTS {staging};")
    return n

def load_bt_csv(db_url: str, csv: Path, distribuidora_id: int) -> int:
    if not csv.exists() or csv.stat().st_size == 0:
        return 0
    staging = f"_staging_bt_{distribuidora_id}"
    setup = f"""
DROP TABLE IF EXISTS {staging};
CREATE UNLOGGED TABLE {staging} (
  wkt TEXT, COD_ID TEXT, CTMT TEXT, TEN_OPE TEXT,
  FAS_CON TEXT, COMP TEXT, TIP_CND TEXT, MUN TEXT
);
"""
    psql(db_url, setup)
    copy_sql = f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    run(["psql", db_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", copy_sql])
    insert = f"""
INSERT INTO bdgd_bt_segments
  (distribuidora_id, cod_id, ctmt, tensao_v, fases, comprimento_m,
   tipo_cabo, cod_municipio, geom)
SELECT
  {distribuidora_id},
  COD_ID,
  CTMT,
  NULLIF(TEN_OPE,'')::NUMERIC::SMALLINT,
  FAS_CON,
  NULLIF(COMP,'')::NUMERIC,
  TIP_CND,
  MUN,
  ST_GeomFromText(wkt, 4326)::geography
FROM {staging}
WHERE wkt IS NOT NULL AND wkt <> '';
"""
    psql(db_url, insert)
    out = run(["psql", db_url, "-At", "-X", "-c",
               f"SELECT COUNT(*) FROM {staging};"], capture=True)
    n = int(out.stdout.strip() or "0")
    psql(db_url, f"DROP TABLE IF EXISTS {staging};")
    return n

def load_sub_csv(db_url: str, csv: Path, distribuidora_id: int) -> int:
    if not csv.exists() or csv.stat().st_size == 0:
        return 0
    staging = f"_staging_sub_{distribuidora_id}"
    setup = f"""
DROP TABLE IF EXISTS {staging};
CREATE UNLOGGED TABLE {staging} (
  wkt TEXT, COD_ID TEXT, NOME TEXT, TEN_PRI TEXT, TEN_SEC TEXT, MUN TEXT
);
"""
    psql(db_url, setup)
    copy_sql = f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    run(["psql", db_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", copy_sql])
    insert = f"""
INSERT INTO bdgd_substations
  (distribuidora_id, cod_id, nome, tensao_pri_kv, tensao_sec_kv, cod_municipio, geom)
SELECT
  {distribuidora_id},
  COD_ID, NOME,
  NULLIF(TEN_PRI,'')::NUMERIC,
  NULLIF(TEN_SEC,'')::NUMERIC,
  MUN,
  ST_GeomFromText(wkt, 4326)::geography
FROM {staging}
WHERE wkt IS NOT NULL AND wkt <> '';
"""
    psql(db_url, insert)
    out = run(["psql", db_url, "-At", "-X", "-c",
               f"SELECT COUNT(*) FROM {staging};"], capture=True)
    n = int(out.stdout.strip() or "0")
    psql(db_url, f"DROP TABLE IF EXISTS {staging};")
    return n

# ----------------------------------------------------------------------------
# Pipeline por distribuidora
# ----------------------------------------------------------------------------

@contextmanager
def workdir():
    d = Path(tempfile.mkdtemp(prefix="bdgd-"))
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)

def process_one(entry: dict, db_url: str, simplify_deg: float, only_mt: bool,
                dry_run: bool, force: bool = False) -> dict:
    log(f"\n=== {entry['nome']} (cod {entry['cod_aneel']}, ciclo {entry['ciclo']}) ===")
    item_id = entry["item_id"]
    try:
        size = head_size(item_id)
    except Exception as e:
        log(f"  HEAD falhou: {e}", "WARN")
        size = 0
    log(f"  tamanho .gdb.zip: {fmt_size(size)}")

    if dry_run:
        log("  (dry-run) skipping download/load")
        return {"status": "dry_run", "mt": 0, "bt": 0, "sub": 0}

    if not force and already_synced(db_url, entry["cod_aneel"], item_id, entry["ciclo"]):
        log("  já sincronizado nesse ciclo — skip")
        return {"status": "skipped", "mt": 0, "bt": 0, "sub": 0}

    distribuidora_id = upsert_distribuidora(db_url, entry, size)
    log_id = log_sync_start(db_url, entry, size)

    t0 = time.time()
    try:
        with workdir() as wd:
            zip_path = wd / "bdgd.gdb.zip"
            download_streaming(item_id, zip_path, size)

            log("  unzip...")
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(wd)
            zip_path.unlink()  # libera espaço imediatamente

            gdb = find_gdb(wd)
            log(f"  gdb encontrado: {gdb.name}")

            layers = list_layers(gdb)
            log(f"  layers no GDB ({len(layers)} total): {sorted(layers)[:15]}{'…' if len(layers)>15 else ''}")

            # Match flexível: BDGD V11 pode usar nomes diferentes por distribuidora.
            # UNSEGMT é o padrão, mas algumas usam UNSE_MT, MT_LIN, REDE_MT, etc.
            def find_layer(candidates: list[str]) -> str | None:
                for cand in candidates:
                    if cand in layers:
                        return cand
                # Fallback: substring match (UPPERCASE)
                for cand in candidates:
                    for layer in layers:
                        if cand in layer:
                            return layer
                return None

            # Variantes observadas:
            #   UNSEGMT  - V11 PRODIST canônico (CPFL, Energisa, Cemig-D...)
            #   UNSEMT   - V10/cooperativas (sem G no meio) - geometria pode ser Point
            #   UNSE_MT  - separador underscore
            #   REDE_MT  - distribuidoras antigas
            mt_layer = find_layer([
                "UNSEGMT", "UNSEMT", "UNSE_MT", "REDE_MT", "MT_LIN", "SEGMT",
            ])
            bt_layer = find_layer([
                "UNSEGBT", "UNSEBT", "UNSE_BT", "REDE_BT", "BT_LIN", "SEGBT",
            ])
            sub_layer = find_layer([
                "SUB", "SUBSTATION", "SUBESTACAO", "SUB_DIST", "UNSEAT",
            ])

            # MT
            mt_csv = wd / "mt.csv"
            mt_count = 0
            if mt_layer:
                log(f"  ogr2ogr {mt_layer} → CSV (simplify)")
                extract_layer_to_csv(
                    gdb, mt_layer, mt_csv, simplify_deg,
                    ["COD_ID", "CTMT", "TEN_OPE", "FAS_CON", "COMP",
                     "TIP_CND", "POS_CAB", "MUN"],
                )
                if mt_csv.exists():
                    sz = mt_csv.stat().st_size
                    log(f"    CSV MT: {fmt_size(sz)}")
                mt_count = load_mt_csv(db_url, mt_csv, distribuidora_id)
                log(f"    MT inseridas: {mt_count:,}")
                mt_csv.unlink(missing_ok=True)
            else:
                log("  ⚠️ Nenhuma layer MT encontrada (esperado: UNSEGMT/UNSE_MT/REDE_MT)", "WARN")

            # BT (skipável)
            bt_count = 0
            if not only_mt and bt_layer:
                bt_csv = wd / "bt.csv"
                log(f"  ogr2ogr {bt_layer} → CSV (simplify)")
                extract_layer_to_csv(
                    gdb, bt_layer, bt_csv, simplify_deg,
                    ["COD_ID", "CTMT", "TEN_OPE", "FAS_CON", "COMP",
                     "TIP_CND", "MUN"],
                )
                if bt_csv.exists():
                    sz = bt_csv.stat().st_size
                    log(f"    CSV BT: {fmt_size(sz)}")
                bt_count = load_bt_csv(db_url, bt_csv, distribuidora_id)
                log(f"    BT inseridas: {bt_count:,}")
                bt_csv.unlink(missing_ok=True)

            # SUB
            sub_count = 0
            if sub_layer:
                sub_csv = wd / "sub.csv"
                log(f"  ogr2ogr {sub_layer} → CSV")
                extract_layer_to_csv(
                    gdb, sub_layer, sub_csv, simplify_deg,
                    ["COD_ID", "NOME", "TEN_PRI", "TEN_SEC", "MUN"],
                )
                if sub_csv.exists():
                    sub_count = load_sub_csv(db_url, sub_csv, distribuidora_id)
                    log(f"    SUB inseridas: {sub_count:,}")
                sub_csv.unlink(missing_ok=True)

            # Atualiza last_synced_at
            psql(db_url,
                 f"UPDATE bdgd_distribuidoras SET last_synced_at=now() "
                 f"WHERE id={distribuidora_id};")

        elapsed = int(time.time() - t0)
        log_sync_finish(db_url, log_id, "success",
                        mt_count, bt_count, sub_count, elapsed)
        log(f"  ✅ {entry['nome']} OK em {elapsed}s "
            f"(MT={mt_count:,} BT={bt_count:,} SUB={sub_count:,})")
        return {"status": "success", "mt": mt_count, "bt": bt_count, "sub": sub_count}

    except Exception as e:
        elapsed = int(time.time() - t0)
        err = repr(e)
        log(f"  ❌ falhou: {err}", "ERROR")
        log_sync_finish(db_url, log_id, "failed", 0, 0, 0, elapsed, err)
        return {"status": "failed", "error": err}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter", default="", help="regex no nome da distribuidora")
    ap.add_argument("--only-mt", action="store_true",
                    help="pular UNSEGBT (apenas MT + SUB)")
    ap.add_argument("--simplify-deg", type=float, default=0.0001,
                    help="tolerância simplify em graus (~0.0001 ≈ 11m em 4326)")
    ap.add_argument("--dry-run", action="store_true",
                    help="lista entries, não baixa nada")
    ap.add_argument("--force", action="store_true",
                    help="reprocessa mesmo se já marcado como success no sync_log")
    args = ap.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("ERROR: SUPABASE_DB_URL env var não definida", file=sys.stderr)
        sys.exit(1)

    # Verifica binários
    for tool in ["psql", "ogr2ogr", "ogrinfo", "unzip"]:
        if not shutil.which(tool):
            print(f"ERROR: {tool} não encontrado no PATH", file=sys.stderr)
            sys.exit(1)

    # Sanity check da conexão antes de iterar 114 distribuidoras
    check_db_connection(db_url)

    entries = fetch_dcat()

    if args.filter:
        rx = re.compile(args.filter, re.IGNORECASE)
        before = len(entries)
        entries = [e for e in entries if rx.search(e["nome"])]
        log(f"filter '{args.filter}' (len={len(args.filter)}, "
            f"chars={[ord(c) for c in args.filter]}) "
            f"→ {len(entries)}/{before} entries")
        if len(entries) == 0:
            # Debug: mostra alguns nomes pra Marcelo identificar regex correto
            sample = [e["nome"] for e in [
                e for e in fetch_dcat() if e["nome"].lower().startswith(args.filter.replace('^','').replace('$','').replace('\\','').lower()[:3])
            ][:5]] if False else []  # noqa
            from_full = []  # workaround simples
            try:
                # re-fetch pra ver primeiros 10 nomes V11
                fresh = fetch_dcat()
                log(f"  Top 10 nomes V11 disponíveis: "
                    f"{[e['nome'] for e in fresh[:10]]}", "WARN")
            except Exception:
                pass

    log(f"\nVAI PROCESSAR {len(entries)} distribuidoras "
        f"(simplify={args.simplify_deg}°, only_mt={args.only_mt}, "
        f"dry_run={args.dry_run})")

    summary = {"success": 0, "skipped": 0, "failed": 0, "dry_run": 0,
               "mt": 0, "bt": 0, "sub": 0}
    for i, entry in enumerate(entries, 1):
        log(f"\n[{i}/{len(entries)}]")
        try:
            r = process_one(entry, db_url, args.simplify_deg,
                            args.only_mt, args.dry_run, args.force)
            summary[r["status"]] = summary.get(r["status"], 0) + 1
            for k in ("mt", "bt", "sub"):
                summary[k] += r.get(k, 0)
        except KeyboardInterrupt:
            log("interrupted by user", "WARN")
            sys.exit(130)
        except Exception as e:
            log(f"erro inesperado em {entry['nome']}: {e}", "ERROR")
            summary["failed"] = summary.get("failed", 0) + 1

    log("\n" + "=" * 60)
    log(f"RESUMO: success={summary['success']} skipped={summary['skipped']} "
        f"failed={summary['failed']} dry_run={summary['dry_run']}")
    log(f"Features: MT={summary['mt']:,} BT={summary['bt']:,} SUB={summary['sub']:,}")
    log("=" * 60)

    sys.exit(0 if summary["failed"] == 0 else 2)

if __name__ == "__main__":
    main()
