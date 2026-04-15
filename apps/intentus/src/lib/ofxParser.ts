/**
 * Simple OFX parser – extracts STMTTRN entries from OFX 1.x format
 */
export interface OFXTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  referenceCode: string;
  direction: "credito" | "debito";
}

export function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const rawDate = get("DTPOSTED");
    const year = rawDate.substring(0, 4);
    const month = rawDate.substring(4, 6);
    const day = rawDate.substring(6, 8);
    const date = `${year}-${month}-${day}`;

    const rawAmt = parseFloat(get("TRNAMT")) || 0;
    const description = get("NAME") || get("MEMO") || "Sem descrição";
    const referenceCode = get("FITID");

    transactions.push({
      date,
      amount: Math.abs(rawAmt),
      description,
      referenceCode,
      direction: rawAmt >= 0 ? "credito" : "debito",
    });
  }

  return transactions;
}

/**
 * Generic CSV parser – expects header row
 * Returns array of objects keyed by header columns
 */
export function parseCSV(content: string, separator = ";"): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

/**
 * Converts parsed CSV rows into OFXTransaction format.
 * User must map columns: dateCol, amountCol, descriptionCol
 */
export function csvToTransactions(
  rows: Record<string, string>[],
  dateCol: string,
  amountCol: string,
  descriptionCol: string
): OFXTransaction[] {
  return rows.map((row) => {
    const rawAmt = parseFloat((row[amountCol] || "0").replace(/\./g, "").replace(",", ".")) || 0;
    // Try to parse date in DD/MM/YYYY or YYYY-MM-DD
    let date = row[dateCol] || "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m}-${d}`;
    }
    return {
      date,
      amount: Math.abs(rawAmt),
      description: row[descriptionCol] || "Sem descrição",
      referenceCode: "",
      direction: rawAmt >= 0 ? "credito" as const : "debito" as const,
    };
  });
}
