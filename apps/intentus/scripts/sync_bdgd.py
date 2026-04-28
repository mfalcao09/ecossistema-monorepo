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

# Tabela oficial das 116 distribuidoras (Manual BDGD Rev 3, Anexo III,
# vigência 2/01/2024). Indexada por cod_aneel = DIST(SARI), que é o número que
# aparece no título do dataset DCAT. Valor: (sigla_oficial, dist_sig_r, uf).
#
# DIST(SIG-R) é a numeração canônica 1-116 (pula 71). DIST(SARI) é o
# código ANEEL Cadastro Institucional, esse é o que vem como cod_aneel.
DISTRIBUIDORAS_OFICIAIS: dict[str, tuple[str, int, str]] = {
    "396":   ("RGE (RGE SUL)",                 1, "RS"),
    "7019":  ("AmE",                           2, "AM"),
    "383":   ("ENEL RJ",                       3, "RJ"),
    "391":   ("EDP SP",                        4, "SP"),
    "370":   ("Roraima Energia",               5, "RR"),
    "5216":  ("ESS",                           6, "SP"),
    "31":    ("CEA",                           7, "AP"),
    "44":    ("Equatorial AL (CEAL)",          8, "AL"),
    "5160":  ("Neoenergia Brasília (CEB-DIS)", 9, "DF"),
    "5707":  ("CEEE-D",                       10, "RS"),
    "5697":  ("CELESC-DIS",                   11, "SC"),
    "6072":  ("ENEL GO (CELG-D)",             12, "GO"),
    "371":   ("Equatorial PA (CELPA)",        13, "PA"),
    "43":    ("CELPE",                        14, "PE"),
    "32":    ("ETO",                          15, "TO"),
    "37":    ("Equatorial MA (CEMAR)",        16, "MA"),
    "405":   ("EMT",                          17, "MT"),
    "4950":  ("CEMIG-D",                      18, "MG"),
    "38":    ("Equatorial PI (CEPISA)",       19, "PI"),
    "369":   ("ERO (CERON)",                  20, "RO"),
    "28":    ("CERR",                         21, "RR"),
    "84":    ("CFLO",                         22, "PR"),
    "103":   ("CHESP",                        23, "GO"),
    "69":    ("CPFL Santa Cruz (Jaguari)",    24, "SP"),
    "70":    ("CPFL Mococa",                  25, "SP"),
    "75":    ("CNEE",                         26, "SP"),
    "82":    ("COCEL",                        27, "PR"),
    "47":    ("COELBA",                       28, "BA"),
    "39":    ("ENEL CE",                      29, "CE"),
    "2904":  ("COOPERALIANÇA",                30, "SC"),
    "2866":  ("COPEL-DIS",                    31, "PR"),
    "40":    ("COSERN",                       32, "RN"),
    "71":    ("CPFL Leste Paulista",          33, "SP"),
    "72":    ("CPFL Santa Cruz",              34, "SP"),
    "63":    ("CPFL Paulista",                35, "SP"),
    "2937":  ("CPFL Piratininga",             36, "SP"),
    "73":    ("CPFL Sul Paulista",            37, "SP"),
    "95":    ("DEMEI",                        38, "RS"),
    "51":    ("DMED",                         39, "MG"),
    "6611":  ("EBO",                          40, "PB"),
    "386":   ("EEB",                          41, "SP"),
    "5217":  ("EDEVP",                        42, "SP"),
    "88":    ("EFLJC",                        43, "SC"),
    "86":    ("EFLUL",                        44, "SC"),
    "385":   ("ELEKTRO",                      45, "SP"),
    "26":    ("EAC (ELETROACRE)",             46, "AC"),
    "398":   ("ELETROCAR",                    47, "RS"),
    "390":   ("ENEL SP (ELETROPAULO)",        48, "SP"),
    "381":   ("ELFSM",                        49, "ES"),
    "6585":  ("EMG",                          50, "MG"),
    "404":   ("EMS",                          51, "MS"),
    "6612":  ("ENF",                          52, "RJ"),
    "6600":  ("EPB",                          53, "PB"),
    "380":   ("EDP ES",                       54, "ES"),
    "6587":  ("ESE",                          55, "SE"),
    "83":    ("FORCEL",                       56, "PR"),
    "399":   ("HIDROPAN",                     57, "RS"),
    "87":    ("DCELT (IENERGIA)",             58, "SC"),
    "382":   ("LIGHT",                        59, "RJ"),
    "401":   ("MUXENERGIA",                   60, "RS"),
    "397":   ("RGE",                          61, "RS"),
    "46":    ("SULGIPE",                      62, "SE"),
    "400":   ("UHENPAL",                      63, "RS"),
    "5352":  ("CEREJ",                        64, "SC"),
    "5351":  ("CERAL",                        65, "SC"),
    "7016":  ("COORSEL",                      66, "SC"),
    "6898":  ("CERBRANORTE",                  67, "SC"),
    "6897":  ("CERAÇÁ",                       68, "SC"),
    "5365":  ("CERPALO",                      69, "SC"),
    "5363":  ("CERGRAL",                      70, "SC"),
    # 71 não existe no Anexo III (numeração pula)
    "5368":  ("CERSUL",                       72, "SC"),
    "5370":  ("COOPERA",                      73, "SC"),
    "5373":  ("COOPERMILA",                   74, "SC"),
    "5353":  ("CERGAL",                       75, "SC"),
    "3223":  ("CERTAJA",                      76, "RS"),
    "4248":  ("CERAL DIS",                    77, "PR"),
    "5385":  ("CERRP",                        78, "SP"),
    "6609":  ("CERNHE",                       79, "RJ"),
    "5274":  ("CERES",                        80, "RJ"),
    "5377":  ("CERCOS",                       81, "SE"),
    "5379":  ("CETRIL",                       82, "SP"),
    "5384":  ("CERPRO",                       83, "SP"),
    "6610":  ("CERMC",                        84, "SP"),
    "5382":  ("CERIS",                        85, "SP"),
    "5378":  ("CERIPA",                       86, "SP"),
    "5386":  ("CERIM",                        87, "SP"),
    "5366":  ("CEDRI",                        88, "SP"),
    "5381":  ("CEDRAP",                       89, "SP"),
    "5367":  ("CEPRAG",                       90, "SC"),
    "5355":  ("CERGAPA",                      91, "SC"),
    "2763":  ("CERILUZ",                      92, "RS"),
    "2381":  ("CERMISSÕES",                   93, "RS"),
    "5364":  ("CERMOFUL",                     94, "SC"),
    "7371":  ("CERTEL",                       95, "RS"),
    "5369":  ("CERTREL",                      96, "SC"),
    "5371":  ("COOPERCOCAL",                  97, "SC"),
    "3627":  ("COOPERLUZ",                    98, "RS"),
    "2351":  ("COPREL",                       99, "RS"),
    "598":   ("CRELUZ-D",                    100, "RS"),
    "2783":  ("CRERAL",                      101, "RS"),
    "5372":  ("CEJAMA",                      102, "SC"),
    "11825": ("CASTRO-DIS",                  103, "PR"),
    "5356":  ("CEGERO",                      104, "SC"),
    "5343":  ("CELETRO",                     105, "RS"),
    "7467":  ("CEMIRIM",                     106, "RJ"),
    "9160":  ("CERAL ARARUAMA",               107, "RJ"),
    "5279":  ("CERCI",                        108, "SP"),
    "504":   ("CERFOX",                       109, "RS"),
    "7883":  ("CERSAD",                       110, "SC"),
    "527":   ("CERTHIL",                      111, "RS"),
    "5375":  ("CERVAM",                       112, "SP"),
    "11763": ("CODESAM",                      113, "SC"),
    "5345":  ("COOPERNORTE",                  114, "RS"),
    "5346":  ("COOPERSUL",                    115, "RS"),
    "5374":  ("COOPERZEM",                    116, "SC"),
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

def lookup_oficial(cod_aneel: str) -> tuple[str, int, str] | None:
    """Retorna (sigla_oficial, dist_sig_r, uf) do Anexo III pelo cod_aneel (SARI)."""
    return DISTRIBUIDORAS_OFICIAIS.get(str(cod_aneel))

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
            oficial = lookup_oficial(cod)
            seen[key] = {
                "nome": nome, "cod_aneel": cod, "ciclo": ciclo, "pub": pub,
                "item_id": item_id,
                "sigla_oficial": oficial[0] if oficial else None,
                "dist_sig_r":    oficial[1] if oficial else None,
                "uf":            oficial[2] if oficial else None,
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
    dist_sig_r = entry.get("dist_sig_r")
    dist_sig_r_sql = str(dist_sig_r) if dist_sig_r is not None else "NULL"
    sigla = entry.get("sigla_oficial")
    sigla_sql = f"'{sigla.replace(chr(39), chr(39)*2)}'" if sigla else "NULL"
    sql = f"""
INSERT INTO bdgd_distribuidoras
  (cod_aneel, nome, uf_principal, dist_sig_r, sigla_oficial,
   arcgis_item_id, ciclo, versao_prodist, size_bytes, last_synced_at)
VALUES
  ('{entry['cod_aneel']}', '{nome}', {uf}, {dist_sig_r_sql}, {sigla_sql},
   '{entry['item_id']}', '{entry['ciclo']}', 'V11', {size_bytes}, NULL)
ON CONFLICT (cod_aneel) DO UPDATE SET
  nome = EXCLUDED.nome,
  uf_principal = EXCLUDED.uf_principal,
  dist_sig_r = EXCLUDED.dist_sig_r,
  sigla_oficial = EXCLUDED.sigla_oficial,
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

def list_fields(gdb: Path, layer: str) -> set[str]:
    """
    Lista atributos/campos de uma layer via ogrinfo -al -so.

    O output do ogrinfo varia entre versões GDAL. Formatos comuns:
      "COD_ID: String (32.0)"        ← com precisão entre parênteses
      "COD_ID: String"                ← sem precisão
      "COD_ID: String (32) NOT NULL"  ← com modificadores
    """
    fields: set[str] = set()
    try:
        out = subprocess.run(
            ["ogrinfo", "-ro", "-al", "-so", str(gdb), layer],
            capture_output=True, text=True, check=False, timeout=60,
        )
        text = out.stdout
        # Tipos OGR conhecidos
        types_re = (
            r"String|Real|Integer|Integer64|Date|DateTime|Time|Binary|"
            r"StringList|IntegerList|RealList|String\s*\(?[\d:.]*\)?"
        )
        for line in text.splitlines():
            # Pula linhas de header (Layer name, Geometry, Extent, etc.)
            if re.match(r"^\s*(Layer|Geometry|Feature Count|Extent|FID|"
                        r"Schema|Spatial|INFO|GEOGCS|PROJCS|UNIT|AXIS|"
                        r"DATUM|SPHEROID|PRIMEM|AUTHORITY|PARAMETER):", line):
                continue
            # Pula linhas vazias e indentadas demais (parte de WKT)
            if not line.strip() or line.startswith("    "):
                continue
            # Match flexível: NOME: TIPO[opcional resto]
            m = re.match(
                r"^\s*([A-Z_][A-Z0-9_]*)\s*:\s*(" + types_re + r")\b",
                line, re.IGNORECASE,
            )
            if m:
                fields.add(m.group(1).upper())

        # Log defensivo se ainda vazio: mostra primeiras linhas do raw
        if not fields:
            preview = "\n".join(text.splitlines()[:30])
            log(f"  ogrinfo -al raw preview ({layer}):\n{preview[:1000]}", "WARN")
    except Exception as e:
        log(f"  ogrinfo -al falhou pra {layer}: {e}", "WARN")
    return fields


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
    gdb: Path, layer: str, dest_csv: Path, simplify_deg: float,
    field_map: dict[str, list[str]],
):
    """
    Exporta layer pra CSV com nomes de coluna canônicos.

    field_map: {canonical_name: [real_name_variants]}
      Pra cada canonical, detecta a primeira variante que existe na layer
      e usa "real_name AS canonical_name" no SELECT. Se nenhuma variante
      existir, usa NULL pra preservar schema do CSV consistente.
    """
    available = list_fields(gdb, layer)
    av_upper = {f.upper() for f in available}

    # Log dos campos REAIS encontrados na layer — útil pra descobrir variantes
    log(f"    layer '{layer}' fields disponíveis ({len(available)}): {sorted(available)[:20]}")

    select_parts = []
    used_fields = []
    for canon, variants in field_map.items():
        chosen = next((v for v in variants if v.upper() in av_upper), None)
        if chosen:
            select_parts.append(f'"{chosen}" AS "{canon}"')
            used_fields.append(f"{canon}={chosen}")
        else:
            select_parts.append(f'CAST(NULL AS character) AS "{canon}"')
            used_fields.append(f"{canon}=NULL")

    log(f"    fields mapeados: {used_fields}")

    sql = f'SELECT {", ".join(select_parts)} FROM "{layer}"'
    cmd = [
        "ogr2ogr",
        "-f", "CSV",
        str(dest_csv),
        str(gdb),
        "-t_srs", "EPSG:4326",
        "-simplify", str(simplify_deg),
        "-sql", sql,
        "-dialect", "OGRSQL",
        "-lco", "GEOMETRY=AS_WKT",
        "-lco", "SEPARATOR=COMMA",
        "-skipfailures",
    ]
    run(cmd)

# ----------------------------------------------------------------------------
# CSV → Postgres via staging + INSERT ... SELECT
# ----------------------------------------------------------------------------

CHUNK_ROWS = 50_000  # ~100MB de geom em uma transação — seguro pro Supabase


def _chunked_insert(
    db_url: str, staging: str, total: int, insert_sql_template: str,
) -> None:
    """
    Executa INSERT em chunks de CHUNK_ROWS pra evitar statement_timeout +
    OOM no Supabase. Cada chunk roda em sua própria transação curta com
    statement_timeout=15min.

    `insert_sql_template` deve ter `{where}` no lugar do filtro de chunk.
    """
    if total <= 0:
        return
    chunks = (total + CHUNK_ROWS - 1) // CHUNK_ROWS
    log(f"    INSERT em {chunks} chunks de até {CHUNK_ROWS:,} rows")
    for i in range(chunks):
        offset = i * CHUNK_ROWS
        # ctid é o row id físico do staging UNLOGGED — equivalente a OFFSET sem ORDER BY
        # mas usamos um trick com ROW_NUMBER() OVER () pra batch determinístico
        where_clause = (
            f"WHERE wkt IS NOT NULL AND wkt <> '' "
            f"AND _chunk_row >= {offset} AND _chunk_row < {offset + CHUNK_ROWS}"
        )
        sql = insert_sql_template.format(where=where_clause)
        # SET LOCAL statement_timeout válido só dentro de transação BEGIN/COMMIT
        wrapped = f"BEGIN; SET LOCAL statement_timeout = '900s'; {sql} COMMIT;"
        psql(db_url, wrapped)
        log(f"    chunk {i+1}/{chunks} OK ({offset:,}–{min(offset + CHUNK_ROWS, total):,})")


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
    copy_sql = (
        f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    )
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", copy_sql]
    run(cmd)

    # Adiciona row_number determinístico pra chunking
    psql(db_url, f"""
ALTER TABLE {staging} ADD COLUMN _chunk_row BIGSERIAL;
CREATE INDEX ON {staging}(_chunk_row);
""")

    out = run(["psql", db_url, "-At", "-X", "-c",
               f"SELECT COUNT(*) FROM {staging} WHERE wkt IS NOT NULL AND wkt <> '';"],
              capture=True)
    total = int(out.stdout.strip() or "0")

    insert_template = f"""
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
{{where}};
"""
    _chunked_insert(db_url, staging, total, insert_template)
    psql(db_url, f"DROP TABLE IF EXISTS {staging};")
    return total


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

    psql(db_url, f"""
ALTER TABLE {staging} ADD COLUMN _chunk_row BIGSERIAL;
CREATE INDEX ON {staging}(_chunk_row);
""")

    out = run(["psql", db_url, "-At", "-X", "-c",
               f"SELECT COUNT(*) FROM {staging} WHERE wkt IS NOT NULL AND wkt <> '';"],
              capture=True)
    total = int(out.stdout.strip() or "0")

    insert_template = f"""
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
{{where}};
"""
    _chunked_insert(db_url, staging, total, insert_template)
    psql(db_url, f"DROP TABLE IF EXISTS {staging};")
    return total

def extract_ctmt_to_csv(gdb: Path, dest_csv: Path) -> bool:
    """
    Extrai a tabela não-geográfica CTMT (Circuito MT) do .gdb pra CSV.

    Manual BDGD Rev 3 §3.4 — 58 fields. Pegamos só os essenciais pro Intentus:
    COD_ID, NOME, TEN_NOM (FK TTEN), TEN_OPE (p.u.), SUB, ENE_01..ENE_12 (energia
    mensal — soma vira anual em kWh, P-195).

    Retorna True se o CSV foi gerado, False se layer CTMT não existe no .gdb.
    """
    layers = list_layers(gdb)
    if "CTMT" not in layers:
        return False

    # Lista de fields ENE_01..ENE_12 (energia mensal kWh)
    ene_fields = [f"COALESCE(ENE_{m:02d}, 0)" for m in range(1, 13)]
    ene_sum = " + ".join(ene_fields)

    sql = (
        f'SELECT COD_ID, NOME, TEN_NOM, TEN_OPE, SUB, '
        f'({ene_sum}) AS ENE_ANUAL '
        f'FROM CTMT'
    )
    cmd = [
        "ogr2ogr",
        "-f", "CSV",
        str(dest_csv),
        str(gdb),
        "-sql", sql,
        "-dialect", "OGRSQL",
        "-lco", "SEPARATOR=COMMA",
        "-skipfailures",
    ]
    run(cmd)
    return dest_csv.exists() and dest_csv.stat().st_size > 0


def load_ctmt_csv(db_url: str, csv: Path, distribuidora_id: int) -> int:
    """
    Carrega CTMT csv → bdgd_circuitos_mt. Idempotente via ON CONFLICT.
    """
    if not csv.exists() or csv.stat().st_size == 0:
        return 0
    staging = f"_staging_ctmt_{distribuidora_id}"
    setup = f"""
DROP TABLE IF EXISTS {staging};
CREATE UNLOGGED TABLE {staging} (
  COD_ID TEXT, NOME TEXT, TEN_NOM TEXT, TEN_OPE TEXT, SUB TEXT, ENE_ANUAL TEXT
);
"""
    psql(db_url, setup)
    copy_sql = f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    run(["psql", db_url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", copy_sql])
    insert = f"""
INSERT INTO bdgd_circuitos_mt
  (distribuidora_id, cod_id, nome, ten_nom_cod, ten_ope_pu, sub_cod_id,
   energia_anual_kwh)
SELECT
  {distribuidora_id},
  COD_ID,
  NULLIF(NOME, ''),
  NULLIF(TEN_NOM, ''),
  NULLIF(TEN_OPE, '')::NUMERIC,
  NULLIF(SUB, ''),
  NULLIF(ENE_ANUAL, '')::NUMERIC
FROM {staging}
WHERE COD_ID IS NOT NULL AND COD_ID <> ''
ON CONFLICT (distribuidora_id, cod_id) DO UPDATE SET
  nome = EXCLUDED.nome,
  ten_nom_cod = EXCLUDED.ten_nom_cod,
  ten_ope_pu = EXCLUDED.ten_ope_pu,
  sub_cod_id = EXCLUDED.sub_cod_id,
  energia_anual_kwh = EXCLUDED.energia_anual_kwh;
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
    if entry.get("dist_sig_r"):
        log(f"  Anexo III: SIGLA={entry['sigla_oficial']!r} "
            f"DIST(SIG-R)={entry['dist_sig_r']} UF={entry['uf']}")
    else:
        log(f"  ⚠️ cod_aneel {entry['cod_aneel']!r} não está no Anexo III "
            f"(uf={entry.get('uf')})", "WARN")
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

            # PRODIST V11 (Manual oficial ANEEL):
            #   SSDMT/SSDBT/SSDAT = Segmento do Sistema de Distribuição (LINHA)
            #     ← cabos reais da rede, traçado entre estruturas de suporte
            #   UNSEMT/UNSEBT/UNSEAT = Unidade de Segmento (PONTO)
            #     ← equipamentos, transformadores — NÃO são fios
            # Priorizar SSD* (linhas reais), UNSE* como fallback de cooperativas.
            mt_layer = find_layer([
                "SSDMT",                                           # V11 oficial — Linha
                "UNSEGMT", "UNSEMT", "UNSE_MT", "REDE_MT",        # legacy/cooperativas (Point)
                "MT_LIN", "SEGMT",
            ])
            bt_layer = find_layer([
                "SSDBT",                                           # V11 oficial — Linha
                "UNSEGBT", "UNSEBT", "UNSE_BT", "REDE_BT",        # legacy
                "BT_LIN", "SEGBT",
            ])
            sub_layer = find_layer([
                "SUB", "SUBSTATION", "SUBESTACAO", "SUB_DIST",
            ])

            # CTMT (não-geográfica) — extrair primeiro pra resolver tensão real
            # via JOIN futuro de SSDMT.CTMT → bdgd_circuitos_mt.cod_id (P-193).
            ctmt_csv = wd / "ctmt.csv"
            ctmt_count = 0
            try:
                if extract_ctmt_to_csv(gdb, ctmt_csv):
                    ctmt_count = load_ctmt_csv(db_url, ctmt_csv, distribuidora_id)
                    log(f"  CTMT (alimentadores) inseridos: {ctmt_count:,}")
                    ctmt_csv.unlink(missing_ok=True)
                else:
                    log("  ⚠️ Layer CTMT não encontrada no .gdb", "WARN")
            except Exception as e:
                log(f"  ❌ CTMT falhou (continuando): {e}", "ERROR")

            # MT — try local pra não derrubar BT/SUB se MT falhar
            #
            # SSDMT V11 (canônico): COD_ID, PN_CON_1, PN_CON_2, CTMT, CT_COD_OP,
            #   UNI_TR_AT, SUB, CONJ, ARE_LOC, DIST, FAS_CON, TIP_INST, TIP_CND,
            #   POS, COMP. TEN_OPE não existe em SSDMT — vem via JOIN com CTMT.
            #   MUN também só existe em UCMT (consumidores), não em SSDMT.
            mt_csv = wd / "mt.csv"
            mt_count = 0
            if mt_layer:
                try:
                    log(f"  ogr2ogr {mt_layer} → CSV (simplify)")
                    extract_layer_to_csv(
                        gdb, mt_layer, mt_csv, simplify_deg,
                        {
                            "COD_ID":  ["COD_ID", "CODID", "ID"],
                            "CTMT":    ["CTMT", "ALIM", "ALIMENTADOR"],
                            "TEN_OPE": ["TEN_OPE", "TEN", "TENSAO", "V_OPE", "TENS_OPE"],
                            "FAS_CON": ["FAS_CON", "FASES", "FASE"],
                            "COMP":    ["COMP", "COMPR", "COMPRIMENTO", "SHAPE_LENGTH", "LENGTH"],
                            "TIP_CND": ["TIP_CND", "TIPO_CABO", "CABO", "TIP_UNID"],
                            "POS_CAB": ["POS_CAB", "POSICAO", "TIP_INST", "TIPO_INST", "POS"],
                            "MUN":     ["MUN", "CD_MUN", "MUN_ID", "CODIBGE", "COD_MUN"],
                        },
                    )
                    if mt_csv.exists():
                        sz = mt_csv.stat().st_size
                        log(f"    CSV MT: {fmt_size(sz)}")
                    mt_count = load_mt_csv(db_url, mt_csv, distribuidora_id)
                    log(f"    MT inseridas: {mt_count:,}")
                    mt_csv.unlink(missing_ok=True)
                except Exception as e:
                    log(f"  ❌ MT falhou (continuando): {e}", "ERROR")
            else:
                log("  ⚠️ Nenhuma layer MT encontrada (esperado: UNSEGMT/UNSE_MT/REDE_MT)", "WARN")

            # BT (try local + skipável)
            #
            # SSDBT V11 (canônico): mesmos campos de SSDMT mas vinculados a CTBT
            # via CTMT. TEN_OPE não existe em SSDBT — só em UNSEBT (equipamentos).
            bt_count = 0
            if not only_mt and bt_layer:
                try:
                    bt_csv = wd / "bt.csv"
                    log(f"  ogr2ogr {bt_layer} → CSV (simplify)")
                    extract_layer_to_csv(
                        gdb, bt_layer, bt_csv, simplify_deg,
                        {
                            "COD_ID":  ["COD_ID", "CODID", "ID"],
                            "CTMT":    ["CTMT", "ALIM", "ALIMENTADOR"],
                            "TEN_OPE": ["TEN_OPE", "TEN", "TENSAO", "V_OPE", "TENS_OPE"],
                            "FAS_CON": ["FAS_CON", "FASES", "FASE"],
                            "COMP":    ["COMP", "COMPR", "COMPRIMENTO", "SHAPE_LENGTH", "LENGTH"],
                            "TIP_CND": ["TIP_CND", "TIPO_CABO", "CABO", "TIP_UNID"],
                            "MUN":     ["MUN", "CD_MUN", "MUN_ID", "CODIBGE", "COD_MUN"],
                        },
                    )
                    if bt_csv.exists():
                        sz = bt_csv.stat().st_size
                        log(f"    CSV BT: {fmt_size(sz)}")
                    bt_count = load_bt_csv(db_url, bt_csv, distribuidora_id)
                    log(f"    BT inseridas: {bt_count:,}")
                    bt_csv.unlink(missing_ok=True)
                except Exception as e:
                    log(f"  ❌ BT falhou (continuando): {e}", "ERROR")

            # SUB (try local — algumas distribuidoras dão Polygon, outras Point)
            sub_count = 0
            if sub_layer:
                sub_csv = wd / "sub.csv"
                try:
                    log(f"  ogr2ogr {sub_layer} → CSV")
                    extract_layer_to_csv(
                        gdb, sub_layer, sub_csv, simplify_deg,
                        {
                            "COD_ID":  ["COD_ID", "CODID", "ID"],
                            "NOME":    ["NOME", "NAME", "DESCR"],
                            "TEN_PRI": ["TEN_PRI", "TENSAO_PRI", "V_PRI"],
                            "TEN_SEC": ["TEN_SEC", "TENSAO_SEC", "V_SEC"],
                            "MUN":     ["MUN", "CD_MUN", "MUN_ID", "CODIBGE", "COD_MUN"],
                        },
                    )
                    if sub_csv.exists():
                        sub_count = load_sub_csv(db_url, sub_csv, distribuidora_id)
                        log(f"    SUB inseridas: {sub_count:,}")
                    sub_csv.unlink(missing_ok=True)
                except Exception as e:
                    log(f"  ❌ SUB falhou (continuando): {e}", "ERROR")

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
