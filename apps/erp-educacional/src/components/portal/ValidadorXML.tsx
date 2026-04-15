'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import type { NivelValidacao } from '@/lib/portal/validar-xml'

// ── Tipos da resposta da API ────────────────────────────────

interface ItemValidacao {
  nivel: NivelValidacao
  categoria: string
  mensagem: string
  detalhe?: string
}

interface DadosExtraidos {
  nome_diplomado: string | null
  cpf_diplomado: string | null
  nome_ies: string | null
  nome_curso: string | null
  grau: string | null
  data_colacao: string | null
  data_conclusao: string | null
  data_nascimento: string | null
  codigo_curso_emec: string | null
}

interface ResultadoValidacao {
  valido: boolean
  tipo_documento: string | null
  versao_xsd: string | null
  total_erros: number
  total_avisos: number
  itens: ItemValidacao[]
  resumo: string
  tempo_ms: number
  dados_extraidos: DadosExtraidos | null
}

interface ValidadorXMLProps {
  turnstileToken: string | null
  /** Callback para avisar o pai que o token foi consumido e precisa ser renovado */
  onTokenUsed?: () => void
}

// ── Ícone SVG do diploma ────────────────────────────────────

function DiplomaIcon({ valido }: { valido: boolean }) {
  const sealColor = valido ? '#10b981' : '#ef4444'
  return (
    <svg width="88" height="88" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      {/* Documento/diploma */}
      <rect x="10" y="12" width="72" height="56" rx="4" fill="white" stroke="#1e2a4a" strokeWidth="3"/>
      <rect x="15" y="17" width="62" height="46" rx="2" stroke="#c8d1e0" strokeWidth="1"/>
      {/* Linhas de texto */}
      <line x1="24" y1="30" x2="68" y2="30" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="24" y1="38" x2="60" y2="38" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="46" x2="54" y2="46" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Selo/medalha */}
      <circle cx="82" cy="76" r="22" fill="white" stroke={sealColor} strokeWidth="3"/>
      <circle cx="82" cy="76" r="15" fill={sealColor} fillOpacity="0.12"/>
      {valido ? (
        <path d="M73 76l6 6 12-12" stroke={sealColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      ) : (
        <path d="M74 68l16 16M90 68l-16 16" stroke={sealColor} strokeWidth="3" strokeLinecap="round"/>
      )}
      {/* Fita do selo */}
      <path d="M72 95l10-6 10 6V84H72z" fill={sealColor} fillOpacity={valido ? 0.7 : 0.4}/>
    </svg>
  )
}

// ── Componente ──────────────────────────────────────────────

export default function ValidadorXML({ turnstileToken, onTokenUsed }: ValidadorXMLProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dragAtivo, setDragAtivo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Handlers de arquivo ────────────────────────────────

  const processarArquivo = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErro('Apenas arquivos .xml são aceitos.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErro('Arquivo muito grande. Limite: 10MB.')
      return
    }
    setArquivo(file)
    setErro(null)
    setResultado(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragAtivo(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }, [processarArquivo])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragAtivo(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragAtivo(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processarArquivo(file)
  }, [processarArquivo])

  // ── Enviar para validação ──────────────────────────────

  const validar = async () => {
    if (!arquivo) return

    setCarregando(true)
    setErro(null)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      if (turnstileToken) {
        formData.append('turnstile_token', turnstileToken)
      }

      const response = await fetch('/api/portal/validar-xml', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setErro(data.erro || 'Erro ao validar o XML.')
        return
      }

      setResultado(data as ResultadoValidacao)
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setCarregando(false)
      // Token Turnstile é de uso único — pedir renovação ao pai
      onTokenUsed?.()
    }
  }

  // ── Limpar e recomeçar ─────────────────────────────────

  const limpar = () => {
    setArquivo(null)
    setResultado(null)
    setErro(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Ícone por nível ────────────────────────────────────

  const iconeNivel = (nivel: NivelValidacao) => {
    switch (nivel) {
      case 'sucesso':
        return <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
      case 'aviso':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      case 'erro':
        return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
    }
  }

  const bgNivel = (nivel: NivelValidacao) => {
    switch (nivel) {
      case 'sucesso': return 'bg-green-50 border-green-200'
      case 'aviso': return 'bg-amber-50 border-amber-200'
      case 'erro': return 'bg-red-50 border-red-200'
    }
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Área de upload / drag-and-drop */}
      {!resultado && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${dragAtivo
              ? 'border-primary-500 bg-primary-50'
              : arquivo
                ? 'border-green-400 bg-green-50'
                : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xml"
            onChange={handleInputChange}
            className="hidden"
          />

          {arquivo ? (
            <div className="space-y-2">
              <FileText className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-medium text-green-800">{arquivo.name}</p>
              <p className="text-sm text-green-600">
                {(arquivo.size / 1024).toFixed(1)} KB — Pronto para validar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="font-medium text-slate-700">
                Arraste o arquivo XML aqui
              </p>
              <p className="text-sm text-slate-500">
                ou clique para selecionar (máx. 10MB)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {/* Botões de ação */}
      {arquivo && !resultado && (
        <div className="flex gap-3">
          <button
            onClick={validar}
            disabled={carregando}
            className="flex-1 bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium
              hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2"
          >
            {carregando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Validar XML
              </>
            )}
          </button>
          <button
            onClick={limpar}
            disabled={carregando}
            className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg
              hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* Resultado da validação — Card estilo MEC            */}
      {/* ════════════════════════════════════════════════════ */}
      {resultado && (
        <div className="space-y-4">
          {/* ── Hero card com dados extraídos ── */}
          <div className={`relative overflow-hidden rounded-xl border ${
            resultado.valido
              ? 'bg-gradient-to-br from-slate-50 to-white border-green-200'
              : 'bg-gradient-to-br from-red-50/50 to-white border-red-200'
          }`}>
            {/* Watermark FIC */}
            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 -rotate-[15deg] text-[100px] font-black text-slate-500/[0.03] tracking-[8px] pointer-events-none select-none">
              FIC
            </div>

            <div className="relative p-5 sm:p-6">
              {/* Título */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-5">
                <h3 className="text-base sm:text-lg font-extrabold text-[#1e2a4a]">
                  Estrutura do XML do Diploma Digital
                </h3>
                <span className={`text-base sm:text-lg font-extrabold ${
                  resultado.valido ? 'text-green-600' : 'text-red-600'
                }`}>
                  {resultado.valido ? 'em Conformidade' : 'com Problemas'}
                </span>
              </div>

              {/* Corpo: ícone + dados */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <DiplomaIcon valido={resultado.valido} />

                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Nome do diplomado */}
                  {resultado.dados_extraidos?.nome_diplomado ? (
                    <p className="text-base sm:text-lg font-bold text-[#1e2a4a] leading-tight">
                      {resultado.dados_extraidos.nome_diplomado.toUpperCase()}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Nome não identificado no XML</p>
                  )}

                  {/* IES */}
                  {resultado.dados_extraidos?.nome_ies && (
                    <p className="text-sm text-slate-600">
                      {resultado.dados_extraidos.nome_ies}
                    </p>
                  )}

                  {/* Curso */}
                  {resultado.dados_extraidos?.nome_curso && (
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-[#1e2a4a]">
                        {resultado.dados_extraidos.nome_curso.toUpperCase()}
                      </span>
                      {resultado.dados_extraidos.grau && (
                        <span className="text-slate-400"> — {resultado.dados_extraidos.grau}</span>
                      )}
                    </p>
                  )}

                  {/* Datas */}
                  {(resultado.dados_extraidos?.data_colacao || resultado.dados_extraidos?.data_conclusao) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 pt-0.5">
                      {resultado.dados_extraidos.data_colacao && (
                        <p>
                          <span className="text-slate-400">Data de colação de grau: </span>
                          {resultado.dados_extraidos.data_colacao}
                        </p>
                      )}
                      {resultado.dados_extraidos.data_conclusao && (
                        <p>
                          <span className="text-slate-400">Data de conclusão: </span>
                          {resultado.dados_extraidos.data_conclusao}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {resultado.valido ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        VÁLIDO
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />
                          {resultado.total_erros} ERRO{resultado.total_erros > 1 ? 'S' : ''}
                        </span>
                        {resultado.total_avisos > 0 && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {resultado.total_avisos} AVISO{resultado.total_avisos > 1 ? 'S' : ''}
                          </span>
                        )}
                      </>
                    )}
                    {resultado.tipo_documento && (
                      <span className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {resultado.tipo_documento}
                      </span>
                    )}
                    <span className="inline-flex items-center bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                      {resultado.tempo_ms}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Rodapé — frase de conformidade */}
              <div className={`mt-5 pt-4 border-t ${
                resultado.valido ? 'border-green-100' : 'border-red-100'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  resultado.valido ? 'text-slate-500' : 'text-red-600'
                }`}>
                  {resultado.valido
                    ? 'A estrutura do XML e padrão de assinaturas estão em conformidade com os requisitos técnicos estabelecidos.'
                    : resultado.resumo
                  }
                </p>
              </div>
            </div>
          </div>

          {/* ── Lista de itens — colapsável ── */}
          <details className={`group rounded-lg border bg-white ${
            resultado.valido ? 'border-slate-200' : 'border-red-200'
          }`}>
            <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors select-none list-none">
              <span>Detalhes da validação ({resultado.itens.length} verificações)</span>
              <svg
                className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-3 space-y-1.5">
              {resultado.itens.map((item, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded border text-sm flex items-start gap-2 ${bgNivel(item.nivel)}`}
                >
                  {iconeNivel(item.nivel)}
                  <div>
                    <span className="text-slate-800">{item.mensagem}</span>
                    {item.detalhe && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.detalhe}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* Botão para nova validação */}
          <button
            onClick={limpar}
            className="w-full py-2.5 text-primary-700 border border-primary-300 rounded-lg
              font-medium hover:bg-primary-50 transition-colors"
          >
            Validar outro arquivo
          </button>
        </div>
      )}
    </div>
  )
}
