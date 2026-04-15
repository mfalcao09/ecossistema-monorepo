/**
 * Formats a raw string into a Brazilian CEP mask: 00000-000
 */
export function formatCep(value: string): string {
  let digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) {
    digits = digits.slice(0, 5) + "-" + digits.slice(5);
  }
  return digits;
}

/**
 * Fetches address data from ViaCEP API.
 * Returns null if CEP is invalid or not found.
 */
export async function fetchAddressByCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
