// ── Tipos para integração com Scanner (USB + Rede) ──

/** Tipo de conexão do scanner */
export type ScannerConnectionType = 'usb' | 'network'

/** Status do scanner */
export type ScannerStatus = 'idle' | 'detecting' | 'ready' | 'scanning' | 'error' | 'unsupported'

/** Modos de cor suportados */
export type ScannerColorMode = 'Color' | 'Gray' | 'Lineart'

/** Formatos de saída */
export type ScannerOutputFormat = 'image/jpeg' | 'image/png' | 'application/pdf'

/** Dispositivo scanner detectado */
export interface ScannerDevice {
  id: string
  name: string
  vendor: string
  model: string
  type: ScannerConnectionType
  /** IP do scanner (apenas para rede) */
  ip?: string
  /** Porta eSCL (default 9095 ou 443) */
  port?: number
}

/** Capacidades do scanner */
export interface ScannerCapabilities {
  resolutions: number[]           // DPI disponíveis (ex: [150, 300, 600])
  colorModes: ScannerColorMode[]  // Modos de cor
  formats: ScannerOutputFormat[]  // Formatos de saída
  maxWidth?: number               // Largura máxima em mm
  maxHeight?: number              // Altura máxima em mm
  hasFlatbed?: boolean            // Mesa plana
  hasADF?: boolean                // Alimentador automático
  hasDuplex?: boolean             // Frente e verso
}

/** Opções de digitalização */
export interface ScanOptions {
  resolution: number              // DPI (default 300)
  colorMode: ScannerColorMode     // Modo de cor
  format: ScannerOutputFormat     // Formato de saída
  source?: 'flatbed' | 'adf'     // Origem do papel
  duplex?: boolean                // Frente e verso
  brightness?: number             // -100 a 100
  contrast?: number               // -100 a 100
}

/** Resultado de uma digitalização */
export interface ScanResult {
  id: string
  blob: Blob
  dataUrl: string                 // base64 para preview
  width: number
  height: number
  format: ScannerOutputFormat
  resolution: number
  timestamp: Date
  sizeBytes: number
}

/** Estado global do módulo de scanner */
export interface ScannerState {
  status: ScannerStatus
  devices: ScannerDevice[]
  selectedDevice: ScannerDevice | null
  capabilities: ScannerCapabilities | null
  scannedImages: ScanResult[]
  error: string | null
  isWebUSBSupported: boolean
}

/** Opções padrão de digitalização */
export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  resolution: 300,
  colorMode: 'Color',
  format: 'image/jpeg',
  source: 'flatbed',
  duplex: false,
  brightness: 0,
  contrast: 0,
}

/** Labels legíveis */
export const SCAN_COLOR_MODE_LABELS: Record<ScannerColorMode, string> = {
  Color: 'Colorido',
  Gray: 'Escala de Cinza',
  Lineart: 'Preto e Branco',
}

export const SCAN_RESOLUTION_LABELS: Record<number, string> = {
  150: '150 DPI (Rascunho)',
  300: '300 DPI (Padrão)',
  600: '600 DPI (Alta Qualidade)',
  1200: '1200 DPI (Máxima)',
}
