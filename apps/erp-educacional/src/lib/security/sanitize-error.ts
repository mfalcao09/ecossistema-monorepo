/**
 * Sanitiza mensagens de erro para não expor detalhes internos ao cliente
 */
export function sanitizarErro(message: string, statusCode: number = 500): string {
  // Log completo internamente (em produção, seria registrado)
  console.error(`[${statusCode}] ${message}`)

  // Retornar mensagem genérica para o cliente
  const errorMessages: Record<number, string> = {
    400: 'Requisição inválida',
    401: 'Não autorizado',
    403: 'Acesso negado',
    404: 'Recurso não encontrado',
    500: 'Erro interno do servidor',
  }

  return errorMessages[statusCode] || 'Erro ao processar requisição'
}
