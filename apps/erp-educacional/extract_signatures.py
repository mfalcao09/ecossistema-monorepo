#!/usr/bin/env python3
"""
Extract digital signature information from legacy diploma XML files.
Analyzes signature patterns, signers, and timing across all 167 DiplomaDigital XMLs.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict, Counter
from typing import List, Dict, Tuple, Optional

# XML directory path
XMLS_DIR = Path("/sessions/serene-ecstatic-hawking/mnt/diploma-digital/reference/xmls-legado/diploma-digital")

def extract_signatures_from_file(file_path: Path) -> Dict:
    """
    Extract all signature blocks from an XML file.
    Returns a dict with file name and list of signatures.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {
            'file': file_path.name,
            'error': str(e),
            'signatures': []
        }

    signatures = []

    # Pattern to find all <ds:Signature> blocks
    # Since files may be single-line, we need flexible whitespace matching
    sig_pattern = r'<ds:Signature[^>]*>.*?</ds:Signature>'
    sig_blocks = re.findall(sig_pattern, content, re.DOTALL | re.IGNORECASE)

    for sig_block in sig_blocks:
        sig_data = {}

        # Extract X509SubjectName (get CN value)
        cn_match = re.search(r'<ds:X509SubjectName>([^<]+)</ds:X509SubjectName>', sig_block, re.IGNORECASE)
        if cn_match:
            subject_name = cn_match.group(1)
            # Extract CN= value
            cn_value = None
            cn_match_inner = re.search(r'CN=([^,]+)', subject_name)
            if cn_match_inner:
                cn_value = cn_match_inner.group(1).strip()

            # Check for organization indicators (O= or OU=)
            has_org = 'O=' in subject_name or 'OU=' in subject_name
            org_match = re.search(r'O=([^,]+)|OU=([^,]+)', subject_name)
            org_value = None
            if org_match:
                org_value = org_match.group(1) or org_match.group(2)

            sig_data['cn'] = cn_value
            sig_data['subject_name'] = subject_name
            sig_data['has_org'] = has_org
            sig_data['org'] = org_value

        # Extract SigningTime
        time_match = re.search(r'<xades:SigningTime>([^<]+)</xades:SigningTime>', sig_block, re.IGNORECASE)
        if time_match:
            sig_data['signing_time'] = time_match.group(1)
        else:
            sig_data['signing_time'] = None

        if sig_data:  # Only add if we found some data
            signatures.append(sig_data)

    return {
        'file': file_path.name,
        'path': str(file_path),
        'signature_count': len(signatures),
        'signatures': signatures,
        'error': None
    }

def analyze_signature_patterns(results: List[Dict]) -> Dict:
    """
    Analyze all results to find signature patterns.
    """
    patterns = defaultdict(list)  # Pattern -> List of files
    cn_order_patterns = defaultdict(int)  # (cn1, cn2, ...) -> count
    all_cns = Counter()

    for result in results:
        if result['error'] or result['signature_count'] == 0:
            continue

        # Get ordered list of CNs for this file
        cn_sequence = tuple(sig.get('cn', 'UNKNOWN') for sig in result['signatures'])
        cn_order_patterns[cn_sequence] += 1

        # Track all unique CNs
        for sig in result['signatures']:
            if sig.get('cn'):
                all_cns[sig['cn']] += 1

        # Store file in pattern bucket
        patterns[cn_sequence].append(result['file'])

    return {
        'patterns': patterns,
        'cn_order_patterns': cn_order_patterns,
        'all_cns': all_cns
    }

def check_ufms_pattern(results: List[Dict]) -> Dict:
    """
    Check if last signature is always from UFMS (registradora).
    """
    ufms_count = 0
    non_ufms_last = []

    for result in results:
        if result['error'] or result['signature_count'] == 0:
            continue

        last_sig = result['signatures'][-1]
        last_cn = last_sig.get('cn', '').upper()

        if 'UFMS' in last_cn or 'UNIVERSIDADE ESTADUAL DE MATO GROSSO DO SUL' in last_cn:
            ufms_count += 1
        else:
            non_ufms_last.append({
                'file': result['file'],
                'last_signer': last_cn
            })

    return {
        'ufms_last_count': ufms_count,
        'non_ufms_last_count': len(non_ufms_last),
        'non_ufms_examples': non_ufms_last[:10]
    }

def check_pj_vs_pf(results: List[Dict]) -> Dict:
    """
    Check for organization indicators (PJ vs PF signers).
    """
    pj_signers = defaultdict(int)  # Org names with count
    pf_signers = defaultdict(int)  # Individual names with count

    for result in results:
        if result['error'] or result['signature_count'] == 0:
            continue

        for sig in result['signatures']:
            cn = sig.get('cn', 'UNKNOWN')
            has_org = sig.get('has_org', False)

            if has_org:
                org = sig.get('org', 'UNKNOWN_ORG')
                pj_signers[f"{cn} (Org: {org})"] += 1
            else:
                pf_signers[cn] += 1

    return {
        'pj_signers': dict(sorted(pj_signers.items(), key=lambda x: x[1], reverse=True)[:20]),
        'pf_signers': dict(sorted(pf_signers.items(), key=lambda x: x[1], reverse=True)[:20]),
        'total_pj_signatures': sum(pj_signers.values()),
        'total_pf_signatures': sum(pf_signers.values())
    }

def find_outliers(results: List[Dict], cn_order_patterns: Dict) -> List[Dict]:
    """
    Find XMLs that don't match the most common patterns.
    """
    # Sort patterns by frequency
    sorted_patterns = sorted(cn_order_patterns.items(), key=lambda x: x[1], reverse=True)
    top_patterns = sorted_patterns[:5]  # Get top 5 patterns

    outliers = []
    for result in results:
        if result['error'] or result['signature_count'] == 0:
            continue

        cn_sequence = tuple(sig.get('cn', 'UNKNOWN') for sig in result['signatures'])

        # Check if this file's pattern is in top 5
        is_common = any(cn_sequence == pattern[0] for pattern in top_patterns)

        if not is_common:
            outliers.append({
                'file': result['file'],
                'signature_count': result['signature_count'],
                'signer_sequence': [sig.get('cn', 'UNKNOWN') for sig in result['signatures']],
                'signing_times': [sig.get('signing_time') for sig in result['signatures']]
            })

    return outliers

def main():
    """
    Main execution: extract and analyze all signature data.
    """
    print("=" * 80)
    print("DIPLOMA DIGITAL - LEGACY XML SIGNATURE ANALYSIS")
    print("=" * 80)
    print()

    # Find all DiplomaDigital XMLs
    xml_files = sorted(XMLS_DIR.glob("*.xml"))
    print(f"Found {len(xml_files)} XML files in {XMLS_DIR}")
    print()

    # Extract signatures from all files
    print("Extracting signatures from all XML files...")
    results = []
    errors = []

    for i, xml_file in enumerate(xml_files, 1):
        if i % 20 == 0:
            print(f"  Processed {i}/{len(xml_files)}...")

        result = extract_signatures_from_file(xml_file)
        results.append(result)

        if result['error']:
            errors.append(result)

    print(f"Completed extraction. {len(errors)} errors encountered.\n")

    # Analyze patterns
    print("Analyzing signature patterns...")
    analysis = analyze_signature_patterns(results)

    # Summary statistics
    valid_results = [r for r in results if not r['error']]
    sig_counts = [r['signature_count'] for r in valid_results]

    print(f"Total valid XMLs: {len(valid_results)}")
    print(f"XMLs with errors: {len(errors)}")
    print(f"Average signatures per XML: {sum(sig_counts) / len(valid_results):.2f}")
    print(f"Min signatures: {min(sig_counts)}")
    print(f"Max signatures: {max(sig_counts)}")
    print(f"Total signature count: {sum(sig_counts)}")
    print()

    # Print signature patterns
    print("=" * 80)
    print("SIGNATURE PATTERNS (by frequency)")
    print("=" * 80)

    sorted_patterns = sorted(
        analysis['cn_order_patterns'].items(),
        key=lambda x: x[1],
        reverse=True
    )

    for idx, (pattern, count) in enumerate(sorted_patterns[:10], 1):
        print(f"\nPattern #{idx}: {count} XMLs")
        for pos, cn in enumerate(pattern, 1):
            print(f"  Position {pos}: {cn}")

    print()
    print("=" * 80)
    print("UNIQUE SIGNERS (Top 20)")
    print("=" * 80)

    for cn, count in analysis['all_cns'].most_common(20):
        print(f"  {cn}: {count} signatures")

    # Check UFMS pattern
    print()
    print("=" * 80)
    print("UFMS (REGISTRADORA) VALIDATION")
    print("=" * 80)

    ufms_check = check_ufms_pattern(results)
    print(f"XMLs with UFMS as last signer: {ufms_check['ufms_last_count']}")
    print(f"XMLs with non-UFMS as last signer: {ufms_check['non_ufms_last_count']}")

    if ufms_check['non_ufms_examples']:
        print("\nExamples of non-UFMS last signers:")
        for example in ufms_check['non_ufms_examples']:
            print(f"  {example['file']}: {example['last_signer']}")

    # Check PJ vs PF
    print()
    print("=" * 80)
    print("PJ vs PF SIGNERS (Organization Detection)")
    print("=" * 80)

    pj_pf = check_pj_vs_pf(results)
    print(f"Total PJ (Organization) signatures: {pj_pf['total_pj_signatures']}")
    print(f"Total PF (Individual) signatures: {pj_pf['total_pf_signatures']}")

    if pj_pf['total_pj_signatures'] > 0:
        print("\nTop PJ Signers:")
        for signer, count in list(pj_pf['pj_signers'].items())[:5]:
            print(f"  {signer}: {count}")

    # Find outliers
    print()
    print("=" * 80)
    print("OUTLIER XMLs (patterns not in top 5)")
    print("=" * 80)

    outliers = find_outliers(results, analysis['cn_order_patterns'])
    print(f"Found {len(outliers)} outlier XMLs\n")

    if outliers:
        for outlier in outliers[:15]:
            print(f"  File: {outlier['file']}")
            print(f"    Signature count: {outlier['signature_count']}")
            print(f"    Signers: {' -> '.join(outlier['signer_sequence'])}")
            print()

    # Save detailed results to JSON
    print("=" * 80)
    print("SAVING DETAILED RESULTS")
    print("=" * 80)

    output_data = {
        'summary': {
            'total_xmls': len(xml_files),
            'valid_xmls': len(valid_results),
            'errors': len(errors),
            'total_signatures': sum(sig_counts),
            'avg_signatures_per_xml': sum(sig_counts) / len(valid_results) if valid_results else 0,
            'min_signatures': min(sig_counts) if sig_counts else 0,
            'max_signatures': max(sig_counts) if sig_counts else 0
        },
        'signature_patterns': {
            'pattern_count': len(sorted_patterns),
            'top_10_patterns': [
                {
                    'signers': list(pattern),
                    'xml_count': count,
                    'files': analysis['patterns'][pattern][:5]  # First 5 files with this pattern
                }
                for pattern, count in sorted_patterns[:10]
            ]
        },
        'unique_signers': dict(analysis['all_cns'].most_common(50)),
        'ufms_validation': ufms_check,
        'pj_vs_pf': pj_pf,
        'outliers': outliers
    }

    output_file = Path("/sessions/serene-ecstatic-hawking/mnt/diploma-digital/signature_analysis.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Detailed results saved to: {output_file}")
    print()
    print("=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
