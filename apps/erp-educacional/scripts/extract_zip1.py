#!/usr/bin/env python3
import zipfile, os, sys
zp = "/sessions/serene-ecstatic-hawking/mnt/uploads/DIPLOMADIGITAL_Diploma Digital_1-308a8e31.zip"
sys.stdout.write(f"Abrindo {os.path.getsize(zp)/(1024*1024):.1f} MB\n")
sys.stdout.flush()
with zipfile.ZipFile(zp, 'r') as zf:
    names = zf.namelist()
    sys.stdout.write(f"Total entries: {len(names)}\n")
    for n in names[:5]:
        sys.stdout.write(f"  {n}\n")
sys.stdout.write("FIM\n")
sys.stdout.flush()
