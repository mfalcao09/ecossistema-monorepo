// Rota removida — era temporária para diagnóstico. Não expõe dados em produção.
export async function GET() {
  return new Response('Not Found', { status: 404 })
}
