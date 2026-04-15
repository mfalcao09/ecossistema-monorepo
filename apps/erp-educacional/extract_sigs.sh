#!/bin/bash
# Extract signature data from diploma XML files

XMLS_DIR="/sessions/serene-ecstatic-hawking/mnt/diploma-digital/reference/xmls-legado/diploma-digital"
OUTPUT_FILE="/sessions/serene-ecstatic-hawking/mnt/diploma-digital/signatures_data.txt"

> "$OUTPUT_FILE"  # Clear output file

count=0
for xmlfile in "$XMLS_DIR"/*.xml; do
    count=$((count + 1))
    filename=$(basename "$xmlfile")

    # Extract all X509SubjectNames and SigningTimes from this file
    # Count signatures in this file
    sig_count=$(grep -o "<ds:Signature" "$xmlfile" 2>/dev/null | wc -l)

    # Extract CN values from certificate subjects
    cns=$(grep -o "CN=[^,>]*" "$xmlfile" 2>/dev/null | sed 's/CN=//' | tr '\n' '|')

    # Extract signing times
    times=$(grep -o "<xades:SigningTime>[^<]*</xades:SigningTime>" "$xmlfile" 2>/dev/null | sed 's/<xades:SigningTime>//g' | sed 's/<\/xades:SigningTime>//g' | tr '\n' '|')

    # Write to output
    echo "$filename|||$sig_count|||$cns|||$times" >> "$OUTPUT_FILE"

    if [ $((count % 20)) -eq 0 ]; then
        echo "Processed $count files..." >&2
    fi
done

echo "Total files processed: $count" >&2
echo "Output saved to: $OUTPUT_FILE" >&2
