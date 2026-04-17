// pii-mask/patterns.ts
// Patterns brasileiros + e-mail. Cada pattern define como mascarar preservando o formato.

export type PIIType = "cpf" | "cnpj" | "email" | "phone" | "rg" | "cep";

export interface PIIPattern {
  type: PIIType;
  regex: RegExp;
  mask: (match: string) => string;
}

function maskEmail(m: string): string {
  const [local, domain] = m.split("@");
  if (!domain) return m;
  const kept = local.slice(0, 1);
  return `${kept}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function maskKeepStructure(m: string): string {
  // Preserva separadores (.-()/ e espaço), mascara dígitos/letras com *
  return m.replace(/[A-Za-z0-9]/g, "*");
}

export const PII_PATTERNS: PIIPattern[] = [
  // CPF: 000.000.000-00 ou 00000000000
  {
    type: "cpf",
    regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    mask: maskKeepStructure,
  },
  // CNPJ: 00.000.000/0000-00
  {
    type: "cnpj",
    regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    mask: maskKeepStructure,
  },
  // E-mail
  {
    type: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    mask: maskEmail,
  },
  // Phone BR: (11) 99999-8888 / +55 11 99999-8888 / 11999998888 / 11 9999-8888
  // Usa lookaround porque `\b` não funciona contra `(`.
  {
    type: "phone",
    regex: /(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}(?!\d)/g,
    mask: maskKeepStructure,
  },
  // CEP: 00000-000
  {
    type: "cep",
    regex: /\b\d{5}-?\d{3}\b/g,
    mask: maskKeepStructure,
  },
  // RG: 00.000.000-X (ordem importa — após CPF/CEP para não colidir)
  {
    type: "rg",
    regex: /\b\d{1,2}\.\d{3}\.\d{3}-[\dXx]\b/g,
    mask: maskKeepStructure,
  },
];
