/**
 * Cliente para o microserviço DocumentConverter
 *
 * Uso server-side apenas (Next.js API Routes ou Server Actions).
 * Nunca use diretamente no browser — a CONVERTER_API_KEY ficaria exposta.
 */

const CONVERTER_URL = process.env.DOCUMENT_CONVERTER_URL
const CONVERTER_API_KEY = process.env.CONVERTER_API_KEY

export interface ConversionResult {
  success: boolean
  pdfaBase64: string
  validation: {
    isCompliant: boolean | null
    profile: string
    warnings: string[]
    errors: string[]
  }
  metadata: {
    originalName: string
    originalSize: number
    pdfaSize: number
    processingMs: number
  }
}

export interface ConversionError {
  success: false
  error: string
  detail?: string
}

/**
 * Converte um arquivo (Buffer) para PDF/A.
 * Usa o endpoint /convert do microserviço via FormData.
 *
 * @param buffer    - Buffer do arquivo original
 * @param filename  - Nome original do arquivo (ex: "rg.jpg")
 * @param mimetype  - MIME type (ex: "image/jpeg", "application/pdf")
 */
export async function convertDocumentToPdfA(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ConversionResult> {
  if (!CONVERTER_URL) {
    throw new Error(
      'DOCUMENT_CONVERTER_URL não configurada. ' +
      'Adicione ao .env.local: DOCUMENT_CONVERTER_URL=http://localhost:3100'
    )
  }

  const formData = new FormData()
  const blob = new Blob([buffer as unknown as ArrayBuffer], { type: mimetype })
  formData.append('file', blob, filename)

  const response = await fetch(`${CONVERTER_URL}/convert`, {
    method: 'POST',
    headers: {
      'x-api-key': CONVERTER_API_KEY || ''
    },
    body: formData,
    // Timeout de 90s — Ghostscript pode ser lento em arquivos grandes
    signal: AbortSignal.timeout(90_000)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`DocumentConverter retornou ${response.status}: ${error.error || error.detail}`)
  }

  return response.json() as Promise<ConversionResult>
}

/**
 * Converte um arquivo já em Base64 para PDF/A.
 * Útil quando o arquivo já está em Base64 (ex: vindo do Supabase Storage).
 */
export async function convertBase64ToPdfA(
  base64: string,
  filename: string,
  mimetype: string
): Promise<ConversionResult> {
  if (!CONVERTER_URL) {
    throw new Error('DOCUMENT_CONVERTER_URL não configurada.')
  }

  const response = await fetch(`${CONVERTER_URL}/convert-base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONVERTER_API_KEY || ''
    },
    body: JSON.stringify({ base64, filename, mimetype }),
    signal: AbortSignal.timeout(90_000)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`DocumentConverter retornou ${response.status}: ${error.error}`)
  }

  return response.json() as Promise<ConversionResult>
}

/**
 * Verifica se o microserviço está disponível.
 * Use para health checks antes de operações críticas.
 */
export async function checkConverterHealth(): Promise<boolean> {
  if (!CONVERTER_URL) return false
  try {
    const response = await fetch(`${CONVERTER_URL}/health`, {
      signal: AbortSignal.timeout(5_000)
    })
    return response.ok
  } catch {
    return false
  }
}
