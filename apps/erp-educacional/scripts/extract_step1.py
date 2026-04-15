#!/usr/bin/env python3
"""Step 1: Apenas listar conteudo dos ZIPs e classificar (sem extrair nada)"""
import zipfile, os, sys

UPLOADS = "/sessions/serene-ecstatic-hawking/mnt/uploads"
zips = [
    "DIPLOMADIGITAL_Diploma Digital_1-308a8e31.zip",
    "DIPLOMADIGITAL_Diploma Digital_2-78f1e420.zip",
    "DIPLOMADIGITAL_Diploma Digital_3-17d33881.zip",
]

for zname in zips:
    zp = os.path.join(UPLOADS, zname)
    sys.stdout.write(f"\n=== {zname} ===\n")
    sys.stdout.flush()
    try:
        with zipfile.ZipFile(zp, 'r') as zf:
            xmls = 0
            pdfs = 0
            csvs = 0
            for info in zf.infolist():
                if info.is_dir() or '__MACOSX' in info.filename:
                    continue
                fn = os.path.basename(info.filename)
                ext = fn.lower().rsplit('.', 1)[-1] if '.' in fn else ''
                size_mb = info.file_size / (1024*1024)
                if ext == 'xml':
                    xmls += 1
                elif ext == 'pdf':
                    pdfs += 1
                elif ext == 'csv':
                    csvs += 1
            sys.stdout.write(f"  XMLs: {xmls}, PDFs: {pdfs}, CSVs: {csvs}\n")
    except Exception as e:
        sys.stdout.write(f"  ERRO: {e}\n")
    sys.stdout.flush()

sys.stdout.write("\nFIM\n")
sys.stdout.flush()
