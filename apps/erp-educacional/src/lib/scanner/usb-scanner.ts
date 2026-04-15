/**
 * USB Scanner — Integração via WebUSB API
 *
 * Usa a WebUSB API nativa do navegador para detectar scanners USB.
 * O sane-wasm (SANE compilado para WebAssembly) é carregado sob demanda
 * quando o usuário decide digitalizar.
 *
 * Compatibilidade: Chrome 61+, Edge 79+ (Chromium-based)
 * Requer: HTTPS ou localhost
 */

import type {
  ScannerDevice,
  ScannerCapabilities,
  ScanOptions,
  ScanResult,
} from '@/types/scanner'

// ── Verificar suporte a WebUSB ──
export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

// ── Vendor IDs conhecidos de scanners ──
const SCANNER_VENDOR_IDS: Record<number, string> = {
  0x04b8: 'Epson',
  0x04a9: 'Canon',
  0x03f0: 'HP',
  0x04f9: 'Brother',
  0x0638: 'Xerox',
  0x06dc: 'Lexmark',
  0x04c5: 'Fujitsu',
  0x0482: 'Kyocera',
  0x0924: 'Xerox',
  0x1083: 'Canon',
  0x05ca: 'Ricoh',
}

// ── Classe USB Scanner ──
export class USBScannerManager {
  private saneLib: any = null
  private isInitialized = false

  /**
   * Detectar scanners USB conectados
   * Abre o dialog nativo do browser para o usuário selecionar o dispositivo
   */
  async detectDevices(): Promise<ScannerDevice[]> {
    if (!isWebUSBSupported()) {
      throw new Error('WebUSB não é suportado neste navegador. Use Chrome ou Edge.')
    }

    try {
      // Tentar obter dispositivos já autorizados
      const existingDevices = await navigator.usb.getDevices()

      if (existingDevices.length > 0) {
        return existingDevices.map(this.usbDeviceToScannerDevice)
      }

      // Se não tem dispositivos autorizados, solicitar permissão
      // Filtrar por vendor IDs de scanners conhecidos
      const filters = Object.keys(SCANNER_VENDOR_IDS).map(vid => ({
        vendorId: parseInt(vid),
      }))

      const device = await navigator.usb.requestDevice({ filters })
      return [this.usbDeviceToScannerDevice(device)]
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // Usuário cancelou a seleção
        return []
      }
      throw new Error(`Erro ao detectar scanner USB: ${err.message}`)
    }
  }

  /**
   * Converter USBDevice nativo para nosso tipo ScannerDevice
   */
  private usbDeviceToScannerDevice(device: USBDevice): ScannerDevice {
    const vendorId = device.vendorId
    const vendor = SCANNER_VENDOR_IDS[vendorId] || `Vendor ${vendorId.toString(16)}`

    return {
      id: `usb-${vendorId}-${device.productId}`,
      name: device.productName || `${vendor} Scanner`,
      vendor,
      model: device.productName || `Modelo ${device.productId.toString(16)}`,
      type: 'usb',
    }
  }

  /**
   * Carregar sane-wasm sob demanda (lazy load)
   * O bundle tem ~10MB, só carrega quando necessário
   * Se não estiver instalado, funciona em modo limitado (só detecção)
   */
  private async initSane(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Import dinâmico — não quebra build se pacote não existir
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const saneModule = await (Function('return import("sane-wasm")')() as Promise<any>)
      this.saneLib = typeof saneModule.default === 'function'
        ? await saneModule.default()
        : saneModule
      this.isInitialized = true
    } catch (err: any) {
      console.warn('sane-wasm não disponível, usando modo limitado:', err.message)
      // sane-wasm pode não estar instalado — funcionar em modo limitado
      this.isInitialized = false
    }
  }

  /**
   * Obter capacidades do scanner
   */
  async getCapabilities(_device: ScannerDevice): Promise<ScannerCapabilities> {
    // Capacidades padrão (quando sane-wasm não está disponível ou para scanners genéricos)
    return {
      resolutions: [150, 300, 600],
      colorModes: ['Color', 'Gray', 'Lineart'],
      formats: ['image/jpeg', 'image/png'],
      maxWidth: 216,  // A4 width em mm
      maxHeight: 297, // A4 height em mm
      hasFlatbed: true,
      hasADF: false,
      hasDuplex: false,
    }
  }

  /**
   * Digitalizar documento via sane-wasm
   * Se sane-wasm não estiver disponível, retorna erro com instrução
   */
  async scan(device: ScannerDevice, options: ScanOptions): Promise<ScanResult> {
    await this.initSane()

    if (!this.saneLib) {
      throw new Error(
        'O módulo de digitalização (sane-wasm) não está instalado. ' +
        'Execute: npm install sane-wasm'
      )
    }

    try {
      // Inicializar SANE
      await this.saneLib.sane_init()

      // Listar dispositivos
      const devices = await this.saneLib.sane_get_devices()
      if (devices.length === 0) {
        throw new Error('Nenhum scanner detectado pelo SANE')
      }

      // Abrir o dispositivo
      await this.saneLib.sane_open(devices[0].name)

      // Configurar opções
      try {
        await this.saneLib.sane_set_option('resolution', options.resolution)
        await this.saneLib.sane_set_option('mode',
          options.colorMode === 'Color' ? 'Color' :
          options.colorMode === 'Gray' ? 'Gray' : 'Lineart'
        )
      } catch {
        // Algumas opções podem não ser suportadas — continuar
        console.warn('Algumas opções de scanner não foram aplicadas')
      }

      // Iniciar digitalização
      await this.saneLib.sane_start()

      // Ler dados
      const chunks: Uint8Array[] = []
      let reading = true
      while (reading) {
        try {
          const data = await this.saneLib.sane_read(65536) // 64KB chunks
          if (data && data.length > 0) {
            chunks.push(new Uint8Array(data))
          } else {
            reading = false
          }
        } catch {
          reading = false
        }
      }

      // Montar imagem
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const imageData = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        imageData.set(chunk, offset)
        offset += chunk.length
      }

      // Converter para Blob
      const blob = new Blob([imageData], { type: options.format })
      const dataUrl = await this.blobToDataUrl(blob)

      // Fechar scanner
      await this.saneLib.sane_close()

      return {
        id: `scan-${Date.now()}`,
        blob,
        dataUrl,
        width: 0, // SANE retorna nos metadados
        height: 0,
        format: options.format,
        resolution: options.resolution,
        timestamp: new Date(),
        sizeBytes: blob.size,
      }
    } catch (err: any) {
      // Garantir cleanup
      try { await this.saneLib.sane_cancel() } catch {}
      try { await this.saneLib.sane_close() } catch {}
      throw new Error(`Erro na digitalização: ${err.message}`)
    }
  }

  /**
   * Modo alternativo: usar Web ImageCapture API
   * Funciona sem sane-wasm, mas usa câmera/webcam em vez de scanner
   * Útil como fallback
   */
  async scanViaImageCapture(): Promise<ScanResult> {
    if (!('ImageCapture' in window)) {
      throw new Error('ImageCapture API não suportada neste navegador')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 3264 }, height: { ideal: 2448 } }
    })

    const track = stream.getVideoTracks()[0]
    const imageCapture = new (window as any).ImageCapture(track)
    const photoBlob = await imageCapture.takePhoto()

    // Parar stream
    stream.getTracks().forEach(t => t.stop())

    const dataUrl = await this.blobToDataUrl(photoBlob)

    return {
      id: `capture-${Date.now()}`,
      blob: photoBlob,
      dataUrl,
      width: 0,
      height: 0,
      format: 'image/jpeg',
      resolution: 300,
      timestamp: new Date(),
      sizeBytes: photoBlob.size,
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.saneLib) {
      try { await this.saneLib.sane_exit() } catch {}
    }
    this.saneLib = null
    this.isInitialized = false
  }
}
