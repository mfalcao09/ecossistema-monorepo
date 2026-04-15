import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ibge-municipios?nome=CHAPADAO&uf=MS
 *
 * Busca municípios na API do IBGE e retorna nome + código.
 * Pode filtrar por UF e/ou buscar por nome parcial.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nome = searchParams.get("nome")?.trim() || "";
  const uf = searchParams.get("uf")?.trim().toUpperCase() || "";

  if (!nome && !uf) {
    return NextResponse.json({ error: "Informe nome ou uf" }, { status: 400 });
  }

  try {
    // Se temos UF, buscar municípios daquela UF
    // Se não, buscar todos e filtrar por nome
    let url: string;
    if (uf) {
      // UF → código IBGE da UF
      const ufCodes: Record<string, number> = {
        AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
        GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
        PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
        SP: 35, SE: 28, TO: 17,
      };
      const ufCode = ufCodes[uf];
      if (!ufCode) {
        return NextResponse.json({ error: `UF inválida: ${uf}` }, { status: 400 });
      }
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufCode}/municipios?orderBy=nome`;
    } else {
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`;
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // Cache por 24h
    });

    if (!res.ok) {
      throw new Error(`IBGE API retornou ${res.status}`);
    }

    const municipios: any[] = await res.json();

    // Filtrar por nome se fornecido
    let filtrados = municipios;
    if (nome) {
      const nomeNorm = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      filtrados = municipios.filter((m: any) => {
        const mNorm = m.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        return mNorm.includes(nomeNorm);
      });
    }

    // Retornar no formato simplificado (máx 20 resultados)
    const resultado = filtrados.slice(0, 20).map((m: any) => ({
      codigo: String(m.id),
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || uf || "",
    }));

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[ibge-municipios] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao consultar API IBGE" },
      { status: 500 }
    );
  }
}
