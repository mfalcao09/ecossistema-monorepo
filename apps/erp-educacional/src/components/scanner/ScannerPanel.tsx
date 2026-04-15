'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Usb, Wifi, Search, Loader2, CheckCircle, AlertCircle,
  ScanLine, Settings2, RotateCcw, Trash2, Download, X,
  Monitor, Info, ChevronDown, ChevronUp,
} from 'lucide-react'
import type {
  ScannerDevice,
  ScannerCapabilities,
  ScanOptions,
  ScanResult,
  ScannerStatus,
  ScannerColorMode,
} from '@/types/scanner'
import {
  DEFAULT_SCAN_OPTIONS,
  SCAN_COLOR_MODE_LABELS,
  SCAN_RESOLUTION_LABELS,
} from '@/types/scanner'

// ── Props ──
interface ScannerPanelProps {
  /** Callback quando imagem é digitalizada — recebe Blob + base64 */
  onScanComplete: (result: ScanResult) => void
  /** Permitir múltiplas digitalizações em sequência */
  allowMultiple?: boolean
  /** Modo compacto (menos opções visíveis) */
  compact?: boolean
}

export function ScannerPanel({
  onScanComplete,
  allowMultiple = true,
  compact = false,
}: ScannerPanelProps) {
  // ── Estado ──
  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [activeTab, setActiveTab] = useState<'usb' | 'network'>('usb')
  const [devices, setDevices] = useState<ScannerDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<ScannerDevice | null>(null)
  const [capabilities, setCapabilities] = useState<ScannerCapabilities | null>(null)
  const [options, setOptions] = useState<ScanOptions>(DEFAULT_SCAN_OPTIONS)
  const [scannedImages, setScannedImages] = useState<ScanResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [isWebUSBSupported, setIsWebUSBSupported] = useState(false)
  const [usbManager, setUsbManager] = useState<any>(null)

  // ── Verificar suporte WebUSB na montagem ──
  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'usb' in navigator
    setIsWebUSBSupported(supported)

    // Carregar USBScannerManager apenas no client
    if (supported) {
      import('@/lib/scanner/usb-scanner').then(mod => {
        setUsbManager(new mod.USBScannerManager())
      })
    }

    return () => {
      // Cleanup
      if (usbManager?.dispose) {
        usbManager.dispose()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Detectar scanner USB ──
  const detectarUSB = useCallback(async () => {
    if (!usbManager) {
      setError('WebUSB não suportado neste navegador. Use Google Chrome ou Microsoft Edge.')
      return
    }

    setStatus('detecting')
    setError(null)

    try {
      const found = await usbManager.detectDevices()
      setDevices(found)

      if (found.length > 0) {
        setSelectedDevice(found[0])
        const caps = await usbManager.getCapabilities(found[0])
        setCapabilities(caps)
        setStatus('ready')
      } else {
        setStatus('idle')
        setError('Nenhum scanner USB encontrado. Verifique se o scanner está conectado e ligado.')
      }
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }, [usbManager])

  // ── Digitalizar ──
  const digitalizar = useCallback(async () => {
    if (!selectedDevice || !usbManager) return

    setStatus('scanning')
    setError(null)

    try {
      const result = await usbManager.scan(selectedDevice, options)
      setScannedImages(prev => [...prev, result])
      onScanComplete(result)
      setStatus('ready')
    } catch (err: any) {
      // Se sane-wasm não está instalado, tentar ImageCapture como fallback
      if (err.message.includes('sane-wasm')) {
        setError(
          'O módulo de digitalização direta (sane-wasm) não está instalado. ' +
          'Você pode usar a câmera como alternativa ou instalar o módulo.'
        )
        setStatus('ready')
      } else {
        setStatus('error')
        setError(err.message)
      }
    }
  }, [selectedDevice, usbManager, options, onScanComplete])

  // ── Digitalizar via câmera (fallback) ──
  const digitalizarViaCamera = useCallback(async () => {
    if (!usbManager) return

    setStatus('scanning')
    setError(null)

    try {
      const result = await usbManager.scanViaImageCapture()
      setScannedImages(prev => [...prev, result])
      onScanComplete(result)
      setStatus('ready')
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }, [usbManager, onScanComplete])

  // ── Remover imagem digitalizada ──
  const removerImagem = useCallback((id: string) => {
    setScannedImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // ── Atualizar opção ──
  const atualizarOpcao = useCallback(<K extends keyof ScanOptions>(
    key: K,
    value: ScanOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  // ── Formatar tamanho ──
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-gray-900 text-sm">
            Digitalizar Documento
          </h2>
          {selectedDevice && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {selectedDevice.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Abas USB / Rede ── */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('usb')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'usb'
              ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Usb className="w-4 h-4" />
          Scanner USB
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'network'
              ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Wifi className="w-4 h-4" />
          Scanner de Rede
          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Em breve</span>
        </button>
      </div>

      {/* ── Conteúdo da aba USB ── */}
      {activeTab === 'usb' && (
        <div className="p-4 space-y-4">
          {/* Aviso de compatibilidade */}
          {!isWebUSBSupported && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Navegador não compatível</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A conexão USB com scanner requer <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>.
                  Seu navegador atual não suporta WebUSB.
                </p>
              </div>
            </div>
          )}

          {/* Botão detectar */}
          {status !== 'ready' && status !== 'scanning' && isWebUSBSupported && (
            <button
              onClick={detectarUSB}
              disabled={status === 'detecting'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {status === 'detecting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Detectando scanner...</>
              ) : (
                <><Search className="w-4 h-4" /> Detectar Scanner USB</>
              )}
            </button>
          )}

          {/* Informação sobre como funciona */}
          {status === 'idle' && isWebUSBSupported && !error && (
            <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600">
                Conecte o scanner ao computador via USB e clique em &ldquo;Detectar Scanner USB&rdquo;.
                O navegador vai mostrar uma janela para você selecionar o dispositivo.
              </p>
            </div>
          )}

          {/* Scanner detectado */}
          {selectedDevice && status !== 'error' && (
            <div className="space-y-3">
              {/* Info do dispositivo */}
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-900">{selectedDevice.name}</p>
                  <p className="text-xs text-emerald-700">{selectedDevice.vendor} • USB</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDevice(null)
                    setDevices([])
                    setStatus('idle')
                    setCapabilities(null)
                  }}
                  className="p-1 hover:bg-emerald-100 rounded transition-colors"
                  title="Desconectar"
                >
                  <X className="w-4 h-4 text-emerald-600" />
                </button>
              </div>

              {/* Opções de digitalização (colapsável) */}
              {!compact && (
                <div>
                  <button
                    onClick={() => setShowOptions(!showOptions)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Opções de digitalização
                    {showOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showOptions && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                      {/* Resolução */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Resolução</label>
                        <select
                          value={options.resolution}
                          onChange={(e) => atualizarOpcao('resolution', parseInt(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {(capabilities?.resolutions || [150, 300, 600]).map(res => (
                            <option key={res} value={res}>
                              {SCAN_RESOLUTION_LABELS[res] || `${res} DPI`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Modo de cor */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Modo de cor</label>
                        <select
                          value={options.colorMode}
                          onChange={(e) => atualizarOpcao('colorMode', e.target.value as ScannerColorMode)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {(capabilities?.colorModes || ['Color', 'Gray', 'Lineart']).map(mode => (
                            <option key={mode} value={mode}>
                              {SCAN_COLOR_MODE_LABELS[mode as ScannerColorMode] || mode}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Origem */}
                      {capabilities?.hasADF && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Origem</label>
                          <select
                            value={options.source}
                            onChange={(e) => atualizarOpcao('source', e.target.value as 'flatbed' | 'adf')}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="flatbed">Mesa plana (Flatbed)</option>
                            <option value="adf">Alimentador automático (ADF)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botão de digitalizar */}
              <button
                onClick={digitalizar}
                disabled={status === 'scanning'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium text-sm"
              >
                {status === 'scanning' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Digitalizando...</>
                ) : (
                  <><ScanLine className="w-4 h-4" /> Digitalizar Documento</>
                )}
              </button>

              {/* Botão alternativo: câmera */}
              <button
                onClick={digitalizarViaCamera}
                disabled={status === 'scanning'}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-xs"
              >
                <Monitor className="w-3.5 h-3.5" />
                Usar câmera como alternativa
              </button>
            </div>
          )}

          {/* Mensagem de erro */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
                <button
                  onClick={() => { setError(null); setStatus('idle') }}
                  className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Conteúdo da aba Rede (placeholder) ── */}
      {activeTab === 'network' && (
        <div className="p-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Scanner de Rede — Em desenvolvimento</p>
              <p className="text-xs text-blue-700 mt-1">
                A integração com scanners de rede via protocolo eSCL (AirScan) será implementada em breve.
                Scanners de rede HP, Canon, Epson, Brother e Xerox serão suportados.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Por enquanto, use o scanner USB ou faça upload dos documentos manualmente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Imagens digitalizadas (preview) ── */}
      {scannedImages.length > 0 && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Documentos digitalizados ({scannedImages.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {scannedImages.map((img) => (
              <div
                key={img.id}
                className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt="Documento digitalizado"
                  className="w-full h-24 object-cover"
                />
                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => removerImagem(img.id)}
                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[10px] text-white font-medium">{formatBytes(img.sizeBytes)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Botão digitalizar mais */}
          {allowMultiple && status === 'ready' && (
            <button
              onClick={digitalizar}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Digitalizar outro documento
            </button>
          )}
        </div>
      )}
    </div>
  )
}
