'use client'
import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertCircle, FolderOpen, Circle } from 'lucide-react'
import type { DocumentoUpload } from '@/types/ia'

// Extend HTML input to support webkitdirectory
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
  }
}

interface DocumentUploaderProps {
  onFilesSelected: (files: DocumentoUpload[]) => void
  documentos: DocumentoUpload[]
  disabled?: boolean
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export function DocumentUploader({ onFilesSelected, documentos, disabled = false }: DocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    async (files: FileList) => {
      const processed: DocumentoUpload[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Validate file type
        if (!ACCEPTED_TYPES.includes(file.type)) {
          continue
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          continue
        }

        const id = crypto.randomUUID()
        const status: 'aguardando' | 'processando' | 'concluido' | 'erro' = 'aguardando'

        let base64: string | undefined
        if (file.type.startsWith('image/')) {
          // Convert images to base64
          const reader = new FileReader()
          base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
              const result = e.target?.result as string
              resolve(result)
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        }

        processed.push({
          id,
          arquivo: file,
          base64,
          nome: file.name,
          tipo: file.type.startsWith('image/') ? 'imagem' : 'pdf',
          tamanho: file.size,
          status,
          dataUpload: new Date(),
        })
      }

      if (processed.length > 0) {
        onFilesSelected([...documentos, ...processed])
      }
    },
    [documentos, onFilesSelected]
  )

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    processFiles(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }

  const removeDocument = (id: string) => {
    onFilesSelected(documentos.filter((doc) => doc.id !== id))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (tipo: string) => {
    if (tipo === 'imagem') {
      return <Image className="w-6 h-6 text-blue-500" />
    }
    return <FileText className="w-6 h-6 text-red-500" />
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando':
        return <Circle className="w-5 h-5 text-gray-400" />
      case 'processando':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'concluido':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'erro':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          accept={ACCEPTED_TYPES.join(',')}
          disabled={disabled}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory="true"
          onChange={handleFolderInput}
          disabled={disabled}
          className="hidden"
        />

        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium mb-2">Arraste documentos aqui ou clique para selecionar</p>
        <p className="text-sm text-gray-500 mb-4">Formatos aceitos: JPG, PNG, WebP, PDF | Máximo 20MB por arquivo</p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Selecionar Arquivos
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Selecionar Pasta
          </button>
        </div>
      </div>

      {/* File List */}
      {documentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">{documentos.length} documento(s) selecionado(s)</p>
          <div className="grid grid-cols-1 gap-2">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {/* Icon */}
                <div className="flex-shrink-0">{getFileIcon(doc.tipo)}</div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.nome}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(doc.tamanho)}</p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusIcon(doc.status)}
                  <span className="text-xs text-gray-600 capitalize">{doc.status}</span>
                </div>

                {/* Remove Button */}
                {doc.status !== 'processando' && (
                  <button
                    onClick={() => removeDocument(doc.id)}
                    disabled={disabled}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Thumbnails for Images */}
      {documentos.some((doc) => doc.tipo === 'imagem') && (
        <div className="grid grid-cols-4 gap-3">
          {documentos
            .filter((doc) => doc.tipo === 'imagem' && doc.base64)
            .map((doc) => (
              <div key={doc.id} className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={doc.base64}
                  alt={doc.nome}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/50 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-white hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
