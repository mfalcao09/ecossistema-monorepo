import os, sys
zp = "/sessions/serene-ecstatic-hawking/mnt/uploads/DIPLOMADIGITAL_Diploma Digital_1-308a8e31.zip"
sz = os.path.getsize(zp)
print(f"Size: {sz} bytes = {sz/(1024*1024):.1f} MB")
