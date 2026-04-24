import { verificarAuth } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/cep/[cep] — consulta ViaCEP e retorna endereço + código município IBGE
// O código IBGE de 7 dígitos é o mesmo usado pelo MEC para identificar municípios
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cep: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { cep: cepParam } = await params;
  const cep = cepParam.replace(/\D/g, "");
  if (cep.length !== 8) {
    return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok)
      return NextResponse.json(
        { error: "CEP não encontrado" },
        { status: 404 },
      );

    const data = await res.json();
    if (data.erro)
      return NextResponse.json(
        { error: "CEP não encontrado" },
        { status: 404 },
      );

    // ibge é o código de 7 dígitos do IBGE — o MEC usa este mesmo código
    // Referência: Portaria MEC 554/2019 e base do e-MEC usam código IBGE do município
    return NextResponse.json({
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.localidade,
      uf: data.uf,
      // Código IBGE de 7 dígitos = código do município no MEC
      codigo_municipio_mec: data.ibge,
      // País padrão
      pais: "Brasil",
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao consultar CEP" },
      { status: 500 },
    );
  }
}
