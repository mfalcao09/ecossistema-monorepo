'use client'

import { useState, useEffect } from 'react'
import {
  Building2, CheckCircle2, AlertCircle, Search,
  PenLine, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { DiplomaConfig, RegistradoraTipoVinculo } from '@/types/diploma-config'

interface Instituicao {
  id: string
  nome: string
  cnpj: string | null
  codigo_mec: string | null
  tipo: string
}

interface AbaInstituicaoProps {
  config: DiplomaConfig
  saving: boolean
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

const VINCULO_LABELS: Record<RegistradoraTipoVinculo, string> = {
  convenio:          'Convênio interinstitucional',
  credenciamento_mec:'Credenciamento MEC',
  contrato:          'Contrato de prestação de serviço',
  outro:             'Outro',
}

function formatCNPJ(cnpj: string) {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return cnpj
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function maskCNPJ(value: string) {
  const n = value.replace(/\D/g, '').slice(0, 14)
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function AbaInstituicao({ config, saving, onSave }: AbaInstituicaoProps) {
  // ── IES Emissora ──────────────────────────────────────────────────────────
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([])
  const [loadingIES, setLoadingIES] = useState(true)
  const [emissoraId, setEmissoraId] = useState(config.ies_emissora_id ?? '')

  // ── IES Registradora (inline) ─────────────────────────────────────────────
  const [regNome, setRegNome]       = useState(config.registradora_nome ?? '')
  const [regCNPJ, setRegCNPJ]       = useState(config.registradora_cnpj ?? '')
  const [regMEC, setRegMEC]         = useState(config.registradora_codigo_mec ?? '')
  const [regVinculo, setRegVinculo] = useState<RegistradoraTipoVinculo>(
    config.registradora_tipo_vinculo ?? 'convenio'
  )
  const [regExpandido, setRegExpandido] = useState(
    !config.registradora_nome // começa expandido se ainda não tem dados
  )

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/instituicoes')
      .then((r) => r.json())
      .then((data) => setInstituicoes(data ?? []))
      .finally(() => setLoadingIES(false))
  }, [])

  useEffect(() => {
    setEmissoraId(config.ies_emissora_id ?? '')
    setRegNome(config.registradora_nome ?? '')
    setRegCNPJ(config.registradora_cnpj ?? '')
    setRegMEC(config.registradora_codigo_mec ?? '')
    setRegVinculo(config.registradora_tipo_vinculo ?? 'convenio')
  }, [config])

  // Mostra apenas IES emissoras (mesmo filtro do Cadastro IES)
  // Mantenedora não emite diploma — não deve aparecer aqui
  const emissoras = instituicoes.filter((i) =>
    i.tipo === 'emissora' || !i.tipo
  )

  const emissoraAtual = instituicoes.find((i) => i.id === emissoraId)

  const registradoraPreenchida = regNome.trim().length > 0

  const handleSave = async () => {
    const ok = await onSave({
      ies_emissora_id:          emissoraId || null,
      registradora_nome:        regNome.trim() || null,
      registradora_cnpj:        regCNPJ.replace(/\D/g, '') || null,
      registradora_codigo_mec:  regMEC.trim() || null,
      registradora_tipo_vinculo: regVinculo,
    })
    if (ok) {
      setSaved(true)
      if (regNome.trim()) setRegExpandido(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-8">

      {/* ── IES Emissora ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">IES Diplomadora (Emissora)</h3>
        </div>

        {loadingIES ? (
          <div className="h-16 bg-gray-100 animate-pulse rounded-xl" />
        ) : emissoras.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              Nenhuma IES emissora cadastrada em{' '}
              <a href="/cadastro/ies" className="underline font-medium">Instituições</a>.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {emissoras.map((ies) => (
              <label
                key={ies.id}
                className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  emissoraId === ies.id
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="emissora"
                  value={ies.id}
                  checked={emissoraId === ies.id}
                  onChange={() => setEmissoraId(ies.id)}
                  className="accent-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{ies.nome}</p>
                  <p className="text-xs text-gray-500">
                    {ies.cnpj ? `CNPJ: ${formatCNPJ(ies.cnpj)}` : ''}
                    {ies.codigo_mec ? ` • e-MEC: ${ies.codigo_mec}` : ''}
                  </p>
                </div>
                {emissoraId === ies.id && (
                  <CheckCircle2 size={18} className="text-primary-500 shrink-0" />
                )}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* ── IES Registradora (inline) ─────────────────────────────────────── */}
      <section>
        {/* Cabeçalho clicável para expandir/recolher */}
        <button
          type="button"
          onClick={() => setRegExpandido((v) => !v)}
          className="w-full flex items-center justify-between gap-3 mb-1 group"
        >
          <div className="flex items-center gap-2">
            <Search size={18} className="text-purple-500" />
            <h3 className="font-semibold text-gray-800">IES Registradora</h3>
            {registradoraPreenchida && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} />
                Configurada
              </span>
            )}
          </div>
          {regExpandido
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />
          }
        </button>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Instituição que co-assina e registra o diploma junto ao MEC. A FIC necessita de uma parceira registradora.
        </p>

        {/* Cartão de resumo quando recolhido e preenchido */}
        {!regExpandido && registradoraPreenchida && (
          <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div>
              <p className="font-medium text-gray-900 text-sm">{regNome}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {regCNPJ ? `CNPJ: ${formatCNPJ(regCNPJ)} ` : ''}
                {regMEC ? `• e-MEC: ${regMEC} ` : ''}
                • {VINCULO_LABELS[regVinculo]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegExpandido(true)}
              className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <PenLine size={13} />
              Editar
            </button>
          </div>
        )}

        {/* Formulário inline expandido */}
        {regExpandido && (
          <div className="space-y-4 p-5 bg-gray-50 border border-gray-200 rounded-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome da IES Registradora <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={regNome}
                onChange={(e) => setRegNome(e.target.value)}
                placeholder="Ex: Universidade Estadual de Mato Grosso do Sul"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={maskCNPJ(regCNPJ)}
                  onChange={(e) => setRegCNPJ(e.target.value.replace(/\D/g, ''))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código e-MEC
                </label>
                <input
                  type="text"
                  value={regMEC}
                  onChange={(e) => setRegMEC(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tipo de vínculo
              </label>
              <select
                value={regVinculo}
                onChange={(e) => setRegVinculo(e.target.value as RegistradoraTipoVinculo)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none bg-white"
              >
                {Object.entries(VINCULO_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <AlertCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">
                Os dados da registradora são incorporados nos XMLs do diploma (campo <code className="font-mono bg-blue-100 px-1 rounded">IesRegistradora</code> no XSD v1.05). Certifique-se de que o código e-MEC está correto.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Resumo de configuração ────────────────────────────────────────── */}
      {(emissoraAtual || registradoraPreenchida) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Configuração atual</p>
          {emissoraAtual && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-400 shrink-0" />
              <span className="text-gray-600">
                <span className="font-medium text-gray-800">Emissora:</span> {emissoraAtual.nome}
              </span>
            </div>
          )}
          {registradoraPreenchida && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              <span className="text-gray-600">
                <span className="font-medium text-gray-800">Registradora:</span> {regNome}
                {regMEC ? ` (e-MEC ${regMEC})` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Salvar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Instituições'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <CheckCircle2 size={16} />
            Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
