#!/usr/bin/env python3
"""
Extrai os 3 ZIPs de diplomas legados.
- XMLs DiplomaDigital (~180KB) → diploma-digital/
- XMLs DocumentacaoAcademica (~16MB) → documentacao-academica/
- PDFs RVDD → rvdd/
- Outros (CSV, HistoricoEscolar) → outros/

OTIMIZAÇÃO: Classifica XMLs lendo apenas os primeiros 3KB (sem extrair todo o arquivo).
Para DocumentacaoAcademica (grandes), registra o nome mas NÃO extrai para economizar disco e tempo.
"""
import zipfile, os, sys, shutil

UPLOADS = "/sessions/serene-ecstatic-hawking/mnt/uploads"
DEST = "/sessions/serene-ecstatic-hawking/mnt/diploma-digital/reference/xmls-legado"

DIPLOMA_DIR = os.path.join(DEST, "diploma-digital")
DOCACAD_DIR = os.path.join(DEST, "documentacao-academica")
RVDD_DIR = os.path.join(DEST, "rvdd")
OUTROS_DIR = os.path.join(DEST, "outros")

for d in [DIPLOMA_DIR, DOCACAD_DIR, RVDD_DIR, OUTROS_DIR]:
    os.makedirs(d, exist_ok=True)

zips = [
    os.path.join(UPLOADS, "DIPLOMADIGITAL_Diploma Digital_1-308a8e31.zip"),
    os.path.join(UPLOADS, "DIPLOMADIGITAL_Diploma Digital_2-78f1e420.zip"),
    os.path.join(UPLOADS, "DIPLOMADIGITAL_Diploma Digital_3-17d33881.zip"),
]

stats = {"diploma": 0, "docacad": 0, "rvdd": 0, "hist": 0, "csv": 0, "dupes": 0}
docacad_names = []  # Apenas registrar nomes sem extrair

def classify(head):
    if "DiplomaDigital" in head or "diplomadigital" in head:
        return "diploma"
    if "DocumentacaoAcademicaRegistro" in head:
        return "docacad"
    if "HistoricoEscolar" in head:
        return "hist"
    return "outro"

sys.stdout.write("INICIO\n")
sys.stdout.flush()

for zp in zips:
    zname = os.path.basename(zp)
    sys.stdout.write(f"ZIP: {zname}\n")
    sys.stdout.flush()
    try:
        with zipfile.ZipFile(zp, 'r') as zf:
            for info in zf.infolist():
                if info.is_dir() or '__MACOSX' in info.filename or '.DS_Store' in info.filename:
                    continue
                fn = os.path.basename(info.filename)
                if not fn:
                    continue
                ext = fn.lower().rsplit('.', 1)[-1] if '.' in fn else ''

                if ext == 'xml':
                    with zf.open(info) as f:
                        head = f.read(3000).decode('utf-8', errors='ignore')
                    tipo = classify(head)

                    if tipo == "docacad":
                        # Apenas extrair - são grandes mas precisamos deles
                        dp = os.path.join(DOCACAD_DIR, fn)
                        if not os.path.exists(dp):
                            zf.extract(info, DOCACAD_DIR)
                            # Mover do subpath para a raiz da pasta
                            extracted = os.path.join(DOCACAD_DIR, info.filename)
                            if os.path.exists(extracted) and extracted != dp:
                                shutil.move(extracted, dp)
                            stats["docacad"] += 1
                        else:
                            stats["dupes"] += 1
                        docacad_names.append(fn)
                    elif tipo == "diploma":
                        dp = os.path.join(DIPLOMA_DIR, fn)
                        if not os.path.exists(dp):
                            with zf.open(info) as f:
                                with open(dp, 'wb') as out:
                                    out.write(f.read())
                            stats["diploma"] += 1
                        else:
                            stats["dupes"] += 1
                    elif tipo == "hist":
                        dp = os.path.join(OUTROS_DIR, fn)
                        if not os.path.exists(dp):
                            with zf.open(info) as f:
                                with open(dp, 'wb') as out:
                                    out.write(f.read())
                            stats["hist"] += 1
                        else:
                            stats["dupes"] += 1

                elif ext == 'pdf':
                    dp = os.path.join(RVDD_DIR, fn)
                    if not os.path.exists(dp):
                        with zf.open(info) as f:
                            with open(dp, 'wb') as out:
                                out.write(f.read())
                        stats["rvdd"] += 1
                    else:
                        stats["dupes"] += 1

                elif ext == 'csv':
                    dp = os.path.join(OUTROS_DIR, fn)
                    if not os.path.exists(dp):
                        with zf.open(info) as f:
                            with open(dp, 'wb') as out:
                                out.write(f.read())
                        stats["csv"] += 1

    except Exception as e:
        sys.stdout.write(f"ERRO: {e}\n")
        sys.stdout.flush()

    sys.stdout.write(f"  Parcial: {stats}\n")
    sys.stdout.flush()

# Mover arquivos da raiz para subpastas
sys.stdout.write("Movendo raiz...\n")
sys.stdout.flush()
moved = 0
for fn in os.listdir(DEST):
    fp = os.path.join(DEST, fn)
    if os.path.isdir(fp):
        continue
    ext = fn.lower().rsplit('.', 1)[-1] if '.' in fn else ''
    try:
        if ext == 'xml':
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                head = f.read(3000)
            tipo = classify(head)
            dd = {"diploma": DIPLOMA_DIR, "docacad": DOCACAD_DIR, "hist": OUTROS_DIR}.get(tipo, OUTROS_DIR)
            dp = os.path.join(dd, fn)
            if not os.path.exists(dp):
                shutil.move(fp, dp)
            else:
                os.remove(fp)
            moved += 1
        elif ext == 'pdf':
            dp = os.path.join(RVDD_DIR, fn)
            if not os.path.exists(dp):
                shutil.move(fp, dp)
            else:
                os.remove(fp)
            moved += 1
        elif ext == 'csv':
            dp = os.path.join(OUTROS_DIR, fn)
            if not os.path.exists(dp):
                shutil.move(fp, dp)
            else:
                os.remove(fp)
            moved += 1
    except:
        pass

# Limpar subpastas vazias criadas pela extração
for root, dirs, files in os.walk(DOCACAD_DIR, topdown=False):
    for d in dirs:
        try:
            os.rmdir(os.path.join(root, d))
        except:
            pass

# Contar totais finais
sys.stdout.write("\nRESULTADO FINAL\n")
for name in ["diploma-digital", "documentacao-academica", "rvdd", "outros"]:
    path = os.path.join(DEST, name)
    if os.path.isdir(path):
        c = len([f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))])
        sys.stdout.write(f"  {name}/ = {c} arquivos\n")
sys.stdout.write(f"Stats: {stats}\n")
sys.stdout.write(f"Movidos raiz: {moved}\n")
sys.stdout.write(f"Caminho: {DEST}\n")
sys.stdout.write("FIM\n")
sys.stdout.flush()
