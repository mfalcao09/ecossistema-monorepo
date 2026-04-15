'use client'

import { useState, useEffect } from 'react'
import {
  Settings2, Bell, FileCode, AlertTriangle, CheckCircle2,
  GitBranch, BrainCircuit, Code2, PenLine, BookOpen,
  FileImage, Globe, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { DiplomaConfig } from '@/types/diploma-config'
import { VERSOES_XSD } from '@/types/diploma-config'

// ─── Fluxo de estágios do diploma ────────────────────────────────────────────
const ESTAGIOS_FLUXO = [
  {
    numero: 1,
    status: 'em_extracao',
    label: 'Extração IA',
    descricao: 'O assistente IA lê o edital/histórico e extrai automaticamente os dados do diplomado, curso, datas e disciplinas.',
    responsavel: 'Sistema (IA)',
    tempo: '1–5 min',
    cor: 'violet',
    icone: BrainCircuit,
    acoes: ['IA extrai dados via GPT/Claude', 'Operador revisa e corrige campos', 'Confirmação manual obrigatória'],
  },
  {
    numero: 2,
    status: 'aguardando_revisao',
    label: 'Revisão',
    descricao: 'Secretário(a) confere os dados extraídos pela IA antes de gerar os XMLs oficiais.',
    responsavel: 'Secretaria',
    tempo: '1–30 min',
    cor: 'amber',
    icone: PenLine,
    acoes: ['Revisar dados do diplomado', 'Confirmar datas oficiais', 'Validar curso e disciplinas'],
  },
  {
    numero: 3,
    status: 'aguardando_assinatura',
    label: 'Geração XML + Assinatura',
    descricao: 'Sistema gera os 2 XMLs da emissora (HistoricoEscolar, DocumentacaoAcademica), valida contra XSD v1.05 e envia para assinatura XAdES AD-RA via BRy KMS.',
    responsavel: 'Sistema + BRy KMS',
    tempo: '2–10 min',
    cor: 'blue',
    icone: Code2,
    acoes: [
      'Gerar 2 XMLs da emissora (XSD v1.05)',
      'Validar schemas obrigatórios',
      'Assinar via BRy KMS (XAdES AD-RA)',
      'Carimbo de tempo (TSA)',
    ],
  },
  {
    numero: 4,
    status: 'registrado',
    label: 'Registro IES',
    descricao: 'Diploma registrado no sistema interno da IES. Em implementações futuras, este passo integrará com o e-MEC.',
    responsavel: 'Secretaria',
    tempo: '1–5 min',
    cor: 'teal',
    icone: BookOpen,
    acoes: ['Registro no livro eletrônico', 'Número de registro oficial', 'Protocolo de emissão'],
  },
  {
    numero: 5,
    status: 'rvdd_gerado',
    label: 'Geração RVDD',
    descricao: 'Sistema gera o PDF visual do diploma (RVDD) com QR Code de verificação, hashes SHA-256 dos XMLs e layout oficial.',
    responsavel: 'Sistema',
    tempo: '30s–2 min',
    cor: 'orange',
    icone: FileImage,
    acoes: ['Renderizar HTML → PDF', 'Inserir QR Code de verificação', 'Incluir hashes SHA-256', 'Gerar código de validação'],
  },
  {
    numero: 6,
    status: 'publicado',
    label: 'Publicado',
    descricao: 'Diploma disponível no portal público para o diplomado acessar via código de verificação. E-mail automático disparado.',
    responsavel: 'Sistema',
    tempo: 'Instantâneo',
    cor: 'emerald',
    icone: Globe,
    acoes: ['Publicar no portal diplomado', 'Enviar e-mail de notificação', 'Disponibilizar download PDF'],
  },
] as const

const COR_MAP = {
  violet:  { bg: 'bg-violet-50',  borda: 'border-violet-200', texto: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700',  icone: 'text-violet-500',  num: 'bg-violet-500' },
  amber:   { bg: 'bg-amber-50',   borda: 'border-amber-200',  texto: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',    icone: 'text-amber-500',   num: 'bg-amber-500' },
  blue:    { bg: 'bg-blue-50',    borda: 'border-blue-200',   texto: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',      icone: 'text-blue-500',    num: 'bg-blue-500' },
  teal:    { bg: 'bg-teal-50',    borda: 'border-teal-200',   texto: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',      icone: 'text-teal-500',    num: 'bg-teal-500' },
  orange:  { bg: 'bg-orange-50',  borda: 'border-orange-200', texto: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  icone: 'text-orange-500',  num: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-50', borda: 'border-emerald-200',texto: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',icone: 'text-emerald-500', num: 'bg-emerald-500' },
}

function FluxoVisual() {
  const [expandido, setExpandido] = useState<number | null>(null)

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <GitBranch size={18} className="text-primary-500" />
        <h3 className="font-semibold text-gray-800">Fluxo de Emissão</h3>
      </div>
      <p className="text-xs text-gray-500 mb-5 ml-7">
        Pipeline completo de 6 estágios para emissão do diploma digital. Clique em um estágio para ver detalhes.
      </p>

      {/* Pipeline horizontal (topo) */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-2">
        {ESTAGIOS_FLUXO.map((e, idx) => {
          const cor = COR_MAP[e.cor]
          const Icone = e.icone
          return (
            <div key={e.numero} className="flex items-center">
              <button
                onClick={() => setExpandido(expandido === e.numero ? null : e.numero)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border-2 transition-all min-w-[90px]
                  ${expandido === e.numero
                    ? `${cor.bg} ${cor.borda} shadow-sm`
                    : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${cor.num}`}>
                  {e.numero}
                </div>
                <Icone size={14} className={expandido === e.numero ? cor.icone : 'text-gray-400'} />
                <span className={`text-[10px] font-medium text-center leading-tight ${
                  expandido === e.numero ? cor.texto : 'text-gray-500'
                }`}>
                  {e.label}
                </span>
              </button>
              {idx < ESTAGIOS_FLUXO.length - 1 && (
                <div className="w-6 h-0.5 bg-gray-200 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Detalhe expandido */}
      {expandido !== null && (() => {
        const e = ESTAGIOS_FLUXO.find((s) => s.numero === expandido)
        if (!e) return null
        const cor = COR_MAP[e.cor]
        const Icone = e.icone
        return (
          <div className={`rounded-xl border-2 p-5 ${cor.bg} ${cor.borda} transition-all`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cor.num} text-white flex-shrink-0`}>
                  <Icone size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`font-semibold ${cor.texto}`}>
                      Estágio {e.numero}: {e.label}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cor.badge}`}>
                      {e.tempo}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 max-w-2xl leading-relaxed">
                    {e.descricao}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpandido(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ações neste estágio</p>
                <ul className="space-y-1">
                  {e.acoes.map((acao, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 size={13} className={`${cor.icone} mt-0.5 flex-shrink-0`} />
                      {acao}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Responsável</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${cor.badge}`}>
                  {e.responsavel}
                </span>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Status interno</p>
                <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded font-mono text-gray-600">
                  {e.status}
                </code>
              </div>
            </div>
          </div>
        )
      })()}

      {expandido === null && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <ChevronDown size={12} />
          Clique em qualquer estágio acima para ver detalhes, ações e responsáveis.
        </p>
      )}
    </section>
  )
}

interface AbaRegrasProps {
  config: DiplomaConfig
  saving: boolean
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

export default function AbaRegras({ config, saving, onSave }: AbaRegrasProps) {
  const [prazoDias, setPrazoDias] = useState(config.prazo_emissao_dias ?? 60)
  const [notificarEmail, setNotificarEmail] = useState(config.notificar_diplomado_email ?? true)
  const [versaoXsd, setVersaoXsd] = useState(config.versao_xsd ?? '1.06')
  const [ativo, setAtivo] = useState(config.ativo ?? true)
  const [saved, setSaved] = useState(false)
  const [confirmarDesativar, setConfirmarDesativar] = useState(false)

  useEffect(() => {
    setPrazoDias(config.prazo_emissao_dias ?? 60)
    setNotificarEmail(config.notificar_diplomado_email ?? true)
    setVersaoXsd(config.versao_xsd ?? '1.06')
    setAtivo(config.ativo ?? true)
    setConfirmarDesativar(false)
  }, [config])

  const handleAtivadoToggle = (novoValor: boolean) => {
    if (!novoValor && !confirmarDesativar) {
      setConfirmarDesativar(true)
      return
    }
    setAtivo(novoValor)
    setConfirmarDesativar(false)
  }

  const handleSave = async () => {
    const ok = await onSave({
      prazo_emissao_dias: prazoDias,
      notificar_diplomado_email: notificarEmail,
      versao_xsd: versaoXsd,
      ativo,
    })
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-8">

      {/* Fluxo Visual do Pipeline */}
      <FluxoVisual />

      <hr className="border-gray-100" />

      {/* Prazo de Emissão */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Prazo de Emissão</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Prazo máximo (em dias) para emissão do diploma após a conclusão do curso pelo diplomado.
        </p>

        <div className="flex items-center gap-4 max-w-xs">
          <input
            type="number"
            min={1}
            max={365}
            value={prazoDias}
            onChange={(e) => setPrazoDias(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none text-center font-medium"
          />
          <span className="text-sm text-gray-600">dias corridos</span>
        </div>

        <div className="mt-3 flex gap-2">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setPrazoDias(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                prazoDias === d
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>

        {prazoDias > 90 && (
          <div className="mt-3 flex items-start gap-2 text-amber-600 text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              Portaria MEC 70/2025 recomenda prazo máximo de 90 dias para graduação.
            </span>
          </div>
        )}
      </section>

      {/* Notificações */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Notificações</h3>
        </div>

        <label className="flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all border-gray-200 hover:border-gray-300 max-w-lg">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={notificarEmail}
              onChange={(e) => setNotificarEmail(e.target.checked)}
              className="w-4 h-4 accent-primary-500 rounded"
            />
          </div>
          <div>
            <p className="font-medium text-gray-800 text-sm">Notificar diplomado por e-mail</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Envia e-mail automático ao diplomado quando o diploma digital for emitido e estiver disponível para download.
            </p>
          </div>
        </label>
      </section>

      {/* Versão XSD */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileCode size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Versão do XSD</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Versão do esquema XML (XSD) a ser utilizada na geração dos documentos de diploma. Use sempre a versão mais recente homologada pelo MEC.
        </p>

        <div className="flex gap-3">
          {VERSOES_XSD.map((v) => (
            <button
              key={v}
              onClick={() => setVersaoXsd(v)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                versaoXsd === v
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              v{v}
              {v === '1.06' && (
                <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                  atual
                </span>
              )}
            </button>
          ))}
        </div>

        {versaoXsd !== '1.05' && (
          <div className="mt-3 flex items-start gap-2 text-amber-600 text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              A versão v1.05 é a versão vigente. Versões anteriores são mantidas apenas para compatibilidade com diplomas já emitidos.
            </span>
          </div>
        )}
      </section>

      {/* Status do Sistema */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="font-semibold text-gray-800">Status do Sistema</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Ativar ou desativar a emissão de diplomas neste ambiente. Desativar impede novas emissões mas não afeta diplomas já emitidos.
        </p>

        <div
          className={`flex items-center justify-between p-4 rounded-xl border-2 max-w-lg transition-all ${
            ativo
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div>
            <p className={`font-medium text-sm ${ativo ? 'text-emerald-800' : 'text-red-800'}`}>
              {ativo ? 'Sistema ativo — Emissão habilitada' : 'Sistema desativado — Emissão bloqueada'}
            </p>
            <p className={`text-xs mt-0.5 ${ativo ? 'text-emerald-600' : 'text-red-600'}`}>
              {ativo
                ? 'Novos diplomas podem ser gerados e assinados normalmente.'
                : 'Nenhum novo diploma será emitido até o sistema ser reativado.'}
            </p>
          </div>
          <button
            onClick={() => handleAtivadoToggle(!ativo)}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              ativo ? 'bg-emerald-500' : 'bg-red-400'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                ativo ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {confirmarDesativar && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg max-w-lg">
            <p className="text-sm text-red-700 font-medium mb-3">
              Tem certeza que deseja desativar a emissão de diplomas neste ambiente?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setAtivo(false); setConfirmarDesativar(false) }}
                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Sim, desativar
              </button>
              <button
                onClick={() => setConfirmarDesativar(false)}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Regras'}
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
