'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeVerificacaoProps {
  /** Código de verificação do documento */
  codigo: string
  /** Tamanho do QR Code em pixels */
  tamanho?: number
  /** Classe CSS adicional */
  className?: string
}

/**
 * Gera um QR Code que aponta para a URL de verificação do documento
 * O QR pode ser escaneado por qualquer leitor para verificar autenticidade
 */
export default function QRCodeVerificacao({
  codigo,
  tamanho = 120,
  className = '',
}: QRCodeVerificacaoProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = `https://diploma.ficcassilandia.com.br/verificar/${codigo}`

    QRCode.toDataURL(url, {
      width: tamanho,
      margin: 1,
      color: {
        dark: '#1e293b',  // slate-800
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch((err) => {
        console.error('[QR Code] Erro ao gerar:', err)
      })
  }, [codigo, tamanho])

  if (!dataUrl) return null

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <img
        src={dataUrl}
        alt={`QR Code de verificação — código ${codigo}`}
        width={tamanho}
        height={tamanho}
        className="rounded-lg"
      />
      <p className="text-xs text-slate-400 mt-2 text-center">
        Escaneie para verificar
      </p>
    </div>
  )
}
