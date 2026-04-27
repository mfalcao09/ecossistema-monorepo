#!/usr/bin/env python3
"""
load_bdgd_hd.py — carregamento Tier 2 (alta precisão) por projeto

Acionado via GHA workflow_dispatch a partir do EF development-bdgd-trigger-hd.

Fluxo:
  1. Lê developments(id) → bbox + geometry do projeto
  2. Identifica distribuidoras que intersectam bbox+buffer (consulta bdgd_distribuidoras)
  3. Pra cada distribuidora identificada:
     a. download .gdb.zip
     b. ogr2ogr extrai UNSEGMT/UNSEGBT/SUB filtrando por -spat (bbox+buffer)
        SEM simplify (precisão milimétrica original do PRODIST)
     c. INSERT INTO bdgd_segments_hd com development_id e expires_at NULL
     d. cleanup arquivos locais
  4. Marca developments.bdgd_hd_loaded_at = now()

Idempotência: deleta dados HD prévios desse projeto antes de re-carregar.

Uso:
  SUPABASE_DB_URL=... python3 load_bdgd_hd.py \\
      --development-id <uuid> --buffer-km 5
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

ITEM_DATA_URL = "https://aneel.maps.arcgis.com/sharing/rest/content/items/{item_id}/data"


def log(msg: str, level: str = "INFO"):
    print(f"[{time.strftime('%H:%M:%S')}] [{level}] {msg}", flush=True)


def fmt_size(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"


def run(cmd, capture=False, check=True):
    if capture:
        return subprocess.run(cmd, capture_output=True, text=True, check=check)
    return subprocess.run(cmd, check=check)


def psql_at(db_url: str, sql: str) -> str:
    out = run(["psql", db_url, "-At", "-X", "-v", "ON_ERROR_STOP=1", "-c", sql],
              capture=True)
    return out.stdout.strip()


def psql_exec(db_url: str, sql: str):
    run(["psql", db_url, "-q", "-X", "-v", "ON_ERROR_STOP=1", "-c", sql])


@contextmanager
def workdir():
    d = Path(tempfile.mkdtemp(prefix="bdgd-hd-"))
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ----------------------------------------------------------------------------
# Discovery — quais distribuidoras cobrem o projeto?
# ----------------------------------------------------------------------------

def get_project_extent(db_url: str, dev_id: str, buffer_km: float) -> tuple[
    list[dict], tuple[float, float, float, float]
]:
    """
    Retorna (lista de distribuidoras intersectando, bbox xmin,ymin,xmax,ymax do
    projeto + buffer).
    """
    # bbox do projeto + buffer (em geography → buffer em metros)
    sql_bbox = f"""
SELECT
  ST_XMin(box::geometry), ST_YMin(box::geometry),
  ST_XMax(box::geometry), ST_YMax(box::geometry)
FROM (
  SELECT ST_Buffer(geometry::geography, {buffer_km * 1000})::geometry AS box
  FROM developments WHERE id = '{dev_id}'
) t;
"""
    bbox_str = psql_at(db_url, sql_bbox)
    if not bbox_str:
        raise RuntimeError(f"Development {dev_id} não encontrado ou sem geometria")
    parts = bbox_str.split("|")
    xmin, ymin, xmax, ymax = [float(p) for p in parts]
    log(f"projeto bbox+buffer({buffer_km}km): ({xmin:.4f},{ymin:.4f}) → "
        f"({xmax:.4f},{ymax:.4f})")

    # distribuidoras com bbox conhecida E intersect — fallback: todas que tem
    # algum mt_segment dentro do raio
    sql_dist = f"""
WITH proj AS (
  SELECT ST_Buffer(geometry::geography, {buffer_km * 1000}) AS region
  FROM developments WHERE id = '{dev_id}'
)
SELECT DISTINCT d.id, d.cod_aneel, d.nome, d.arcgis_item_id, d.ciclo
FROM bdgd_distribuidoras d
WHERE
  -- caso 1: bbox conhecida cobre região
  (d.bbox IS NOT NULL AND ST_Intersects(d.bbox, (SELECT region FROM proj)))
  OR
  -- caso 2: já tem segmentos MT na região (heurística pós-Tier 1)
  EXISTS (
    SELECT 1 FROM bdgd_mt_segments s
    WHERE s.distribuidora_id = d.id
    AND ST_DWithin(s.geom, (SELECT region FROM proj), 0)
    LIMIT 1
  )
ORDER BY d.cod_aneel;
"""
    out = run(["psql", db_url, "-At", "-F", "|", "-X",
               "-v", "ON_ERROR_STOP=1", "-c", sql_dist], capture=True)
    dists = []
    for line in out.stdout.strip().splitlines():
        if not line:
            continue
        parts = line.split("|")
        dists.append({
            "id": int(parts[0]),
            "cod_aneel": parts[1],
            "nome": parts[2],
            "arcgis_item_id": parts[3],
            "ciclo": parts[4],
        })
    log(f"distribuidoras intersectando: {len(dists)}")
    for d in dists:
        log(f"  - {d['nome']} (cod {d['cod_aneel']})")
    return dists, (xmin, ymin, xmax, ymax)


# ----------------------------------------------------------------------------
# Download + extract por bbox (sem simplify)
# ----------------------------------------------------------------------------

def download_streaming(item_id: str, dest: Path):
    url = ITEM_DATA_URL.format(item_id=item_id)
    log(f"  download {dest.name}")
    t0 = time.time()
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    log(f"  download OK em {time.time() - t0:.0f}s ({fmt_size(dest.stat().st_size)})")


def find_gdb(d: Path) -> Path:
    for p in d.rglob("*.gdb"):
        if p.is_dir():
            return p
    raise RuntimeError("nenhum .gdb encontrado")


def list_layers(gdb: Path) -> set[str]:
    out = run(["ogrinfo", "-q", "-ro", str(gdb)], capture=True)
    layers = set()
    for line in out.stdout.splitlines():
        m = re.match(r"^\s*\d+:\s+(\S+)", line)
        if m:
            layers.add(m.group(1).upper())
    return layers


def extract_layer_filtered(gdb: Path, layer: str, dest_csv: Path,
                           bbox: tuple[float, float, float, float],
                           fields: list[str]):
    """ogr2ogr -spat filtra por bbox; sem simplify (precisão original)."""
    xmin, ymin, xmax, ymax = bbox
    select = ",".join(fields)
    cmd = [
        "ogr2ogr",
        "-f", "CSV",
        str(dest_csv),
        str(gdb),
        layer,
        "-t_srs", "EPSG:4326",
        "-spat", str(xmin), str(ymin), str(xmax), str(ymax),
        "-spat_srs", "EPSG:4326",
        "-select", select,
        "-lco", "GEOMETRY=AS_WKT",
        "-lco", "SEPARATOR=COMMA",
        "-skipfailures",
    ]
    run(cmd)


def load_hd_csv(db_url: str, csv: Path, dev_id: str, distribuidora_id: int,
                tipo: str, fields_def: dict) -> int:
    """
    Carrega CSV em bdgd_segments_hd.
    `tipo` = 'mt' | 'bt' | 'sub'
    `fields_def` indica o mapeamento dos campos do CSV pras colunas.
    """
    if not csv.exists() or csv.stat().st_size == 0:
        return 0
    staging = f"_staging_hd_{tipo}_{distribuidora_id}"

    if tipo == "mt":
        cols_csv = "wkt TEXT, COD_ID TEXT, CTMT TEXT, TEN_OPE TEXT, FAS_CON TEXT, COMP TEXT, MUN TEXT"
        select_cols = """
  '{dev}'::uuid, {dist}, 'mt', COD_ID, CTMT,
  NULLIF(TEN_OPE,'')::NUMERIC, NULL::SMALLINT, FAS_CON,
  NULLIF(COMP,'')::NUMERIC, MUN, ST_GeomFromText(wkt, 4326)::geography, NULL
"""
    elif tipo == "bt":
        cols_csv = "wkt TEXT, COD_ID TEXT, CTMT TEXT, TEN_OPE TEXT, FAS_CON TEXT, COMP TEXT, MUN TEXT"
        select_cols = """
  '{dev}'::uuid, {dist}, 'bt', COD_ID, CTMT,
  NULL::NUMERIC, NULLIF(TEN_OPE,'')::NUMERIC::SMALLINT, FAS_CON,
  NULLIF(COMP,'')::NUMERIC, MUN, ST_GeomFromText(wkt, 4326)::geography, NULL
"""
    else:  # sub
        cols_csv = "wkt TEXT, COD_ID TEXT, NOME TEXT, TEN_PRI TEXT, TEN_SEC TEXT, MUN TEXT"
        select_cols = """
  '{dev}'::uuid, {dist}, 'sub', COD_ID, NOME,
  NULLIF(TEN_PRI,'')::NUMERIC, NULL::SMALLINT, NULL,
  NULL::NUMERIC, MUN, ST_GeomFromText(wkt, 4326)::geography, NULL
"""

    psql_exec(db_url, f"DROP TABLE IF EXISTS {staging}; "
                      f"CREATE UNLOGGED TABLE {staging} ({cols_csv});")

    copy_sql = f"\\COPY {staging} FROM '{csv}' WITH (FORMAT csv, HEADER true)"
    run(["psql", db_url, "-q", "-X", "-v", "ON_ERROR_STOP=1", "-c", copy_sql])

    insert = f"""
INSERT INTO bdgd_segments_hd
  (development_id, distribuidora_id, tipo, cod_id, ctmt,
   tensao_kv, tensao_v, fases, comprimento_m, cod_municipio, geom, expires_at)
SELECT
  {select_cols.format(dev=dev_id, dist=distribuidora_id)}
FROM {staging}
WHERE wkt IS NOT NULL AND wkt <> '';
"""
    psql_exec(db_url, insert)
    n = int(psql_at(db_url, f"SELECT COUNT(*) FROM {staging};") or "0")
    psql_exec(db_url, f"DROP TABLE IF EXISTS {staging};")
    return n


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--development-id", required=True)
    ap.add_argument("--buffer-km", type=float, default=5.0)
    args = ap.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("ERROR: SUPABASE_DB_URL não definida", file=sys.stderr)
        sys.exit(1)

    for tool in ["psql", "ogr2ogr", "ogrinfo", "unzip"]:
        if not shutil.which(tool):
            print(f"ERROR: {tool} ausente", file=sys.stderr)
            sys.exit(1)

    # Sanity check de conexão antes de processar
    log("Verificando conexão Supabase...")
    out = subprocess.run(
        ["psql", db_url, "-At", "-X", "-c", "SELECT 1;"],
        capture_output=True, text=True, timeout=30,
    )
    if out.returncode != 0:
        log(f"❌ Conexão falhou (exit {out.returncode}): {out.stderr[:400]}", "ERROR")
        log("Verifique secret SUPABASE_DB_URL no GitHub: Session pooler "
            "+ senha real (sem [YOUR-PASSWORD] placeholder)", "ERROR")
        sys.exit(3)
    log("✅ Conexão OK")

    dev_id = args.development_id
    if not re.match(r"^[0-9a-f-]{36}$", dev_id, re.IGNORECASE):
        print(f"ERROR: development_id inválido: {dev_id}", file=sys.stderr)
        sys.exit(1)

    log(f"=== Tier 2 HD load para projeto {dev_id} (buffer {args.buffer_km}km) ===")

    # Limpa carga anterior
    psql_exec(db_url,
              f"DELETE FROM bdgd_segments_hd WHERE development_id='{dev_id}';")
    log("dados HD anteriores deste projeto removidos")

    dists, bbox = get_project_extent(db_url, dev_id, args.buffer_km)
    if not dists:
        log("nenhuma distribuidora encontrada na região — abortando", "WARN")
        sys.exit(0)

    total = {"mt": 0, "bt": 0, "sub": 0}
    failed = []

    for d in dists:
        log(f"\n--- {d['nome']} ---")
        try:
            with workdir() as wd:
                zip_path = wd / "bdgd.gdb.zip"
                download_streaming(d["arcgis_item_id"], zip_path)

                with zipfile.ZipFile(zip_path) as zf:
                    zf.extractall(wd)
                zip_path.unlink()

                gdb = find_gdb(wd)
                layers = list_layers(gdb)

                if "UNSEGMT" in layers:
                    csv = wd / "mt.csv"
                    extract_layer_filtered(
                        gdb, "UNSEGMT", csv, bbox,
                        ["COD_ID", "CTMT", "TEN_OPE", "FAS_CON", "COMP", "MUN"],
                    )
                    n = load_hd_csv(db_url, csv, dev_id, d["id"], "mt", {})
                    log(f"  MT HD: {n:,}")
                    total["mt"] += n
                    csv.unlink(missing_ok=True)

                if "UNSEGBT" in layers:
                    csv = wd / "bt.csv"
                    extract_layer_filtered(
                        gdb, "UNSEGBT", csv, bbox,
                        ["COD_ID", "CTMT", "TEN_OPE", "FAS_CON", "COMP", "MUN"],
                    )
                    n = load_hd_csv(db_url, csv, dev_id, d["id"], "bt", {})
                    log(f"  BT HD: {n:,}")
                    total["bt"] += n
                    csv.unlink(missing_ok=True)

                if "SUB" in layers:
                    csv = wd / "sub.csv"
                    extract_layer_filtered(
                        gdb, "SUB", csv, bbox,
                        ["COD_ID", "NOME", "TEN_PRI", "TEN_SEC", "MUN"],
                    )
                    n = load_hd_csv(db_url, csv, dev_id, d["id"], "sub", {})
                    log(f"  SUB HD: {n:,}")
                    total["sub"] += n
                    csv.unlink(missing_ok=True)

        except Exception as e:
            log(f"  ❌ {d['nome']} falhou: {e}", "ERROR")
            failed.append(d["nome"])

    # Marca developments.bdgd_hd_loaded_at
    psql_exec(db_url, f"""
UPDATE developments
SET bdgd_hd_loaded_at = now(),
    bdgd_hd_buffer_km = {args.buffer_km}
WHERE id = '{dev_id}';
""")

    log(f"\n=== TOTAL HD: MT={total['mt']:,} BT={total['bt']:,} SUB={total['sub']:,} ===")
    if failed:
        log(f"distribuidoras com falha: {failed}", "WARN")
        sys.exit(2)


if __name__ == "__main__":
    main()
