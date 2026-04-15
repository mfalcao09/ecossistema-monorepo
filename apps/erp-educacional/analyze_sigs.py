#!/usr/bin/env python3
"""Quick signature extraction from diploma XMLs"""
import os
import re
import sys
from pathlib import Path
from collections import Counter, defaultdict

XMLS_DIR = Path("/sessions/serene-ecstatic-hawking/mnt/diploma-digital/reference/xmls-legado/diploma-digital")

def extract_sigs(filepath):
    """Extract signatures from one XML file"""
    try:
        with open(filepath, 'rb') as f:
            # Read in chunks to avoid memory issues
            content = f.read(1000000)  # First 1MB
            try:
                content = content.decode('utf-8', errors='replace')
            except:
                return None

        # Count signature blocks
        sig_count = content.count('<ds:Signature')

        # Extract CNs
        cn_pattern = r'CN=([^,>]+)'
        cns = re.findall(cn_pattern, content)

        # Extract signing times
        time_pattern = r'<xades:SigningTime>([^<]+)</xades:SigningTime>'
        times = re.findall(time_pattern, content, re.IGNORECASE)

        return {
            'file': filepath.name,
            'sig_count': sig_count,
            'cns': cns,
            'times': times
        }
    except Exception as e:
        print(f"Error processing {filepath.name}: {e}", file=sys.stderr)
        return None

# Process all files
files = sorted(XMLS_DIR.glob('*.xml'))
print(f"Found {len(files)} XML files", file=sys.stderr)

all_data = []
pattern_map = defaultdict(list)
cn_counter = Counter()

for i, fpath in enumerate(files, 1):
    result = extract_sigs(fpath)
    if result:
        all_data.append(result)
        # Map CN pattern to file
        pattern = tuple(result['cns'][:5])  # First 5 CNs
        pattern_map[pattern].append(result['file'])
        # Count all CNs
        for cn in result['cns']:
            cn_counter[cn] += 1

    if i % 30 == 0:
        print(f"Processed {i}/{len(files)}", file=sys.stderr)

# Print results
print("\n=== SUMMARY ===")
print(f"Total XMLs: {len(all_data)}")
print(f"Unique signers: {len(cn_counter)}")
print(f"Total signatures: {sum(r['sig_count'] for r in all_data)}")

print("\n=== TOP SIGNERS ===")
for cn, count in cn_counter.most_common(10):
    print(f"{cn}: {count}")

print("\n=== TOP PATTERNS ===")
sorted_patterns = sorted(pattern_map.items(), key=lambda x: len(x[1]), reverse=True)
for pattern, files in sorted_patterns[:5]:
    print(f"Pattern {pattern}: {len(files)} files")
    for f in files[:3]:
        print(f"  - {f}")

print("\n=== SAMPLES ===")
for i, data in enumerate(all_data[:3]):
    print(f"\nFile {i+1}: {data['file']}")
    print(f"  Signatures: {data['sig_count']}")
    print(f"  CNs: {data['cns'][:3]}")
    print(f"  Times: {data['times'][:3] if data['times'] else 'None'}")
