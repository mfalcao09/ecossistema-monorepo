'use client'

import { useState } from 'react'
import {
  Building2,
  Palette,
  Shield,
  Settings2,
  AlertCircle,
  RefreshCw,
  FlaskConical,
  Rocket,
  GraduationCap,
} from 'lucide-react'
import { useDiplomaConfig } from '@/hooks/useDiplomaConfig'
import AbaInstituicao from '@/components/config/AbaInstituicao'
import AbaVisual from '@/components/config/AbaVisual'
import AbaIntegracao from '@/components/config/AbaIntegracao'
import AbaRegras from '@/components/config/AbaRegras'
import AbaVisualHistorico from '@/components/config/AbaVisualHistorico'
import type { AmbienteSistema } from '@/types/diploma-config'

type TabId = 'instituicao' | 'visual' | 'historico' | 'assinatura' | 'regras'

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'instituicao',
    label: 'Instituição',
    icon: <Building2 size={16} />,
    description: 'IES emissora e registradora',
  },
  {
    id: 'visual',
    label: 'Visual RVDD',
    icon: <Palette size={16} />,
    description: 'Cores, fonte e layout',
  },
  {
    id: 'historico',
    label: 'Visual Histórico',
    icon: <GraduationCap size={16} />,
    description: 'Aparência do histórico escolar',
  },
  {
    id: 'assinatura',
    label: 'Assinatura Digital',
    icon: <Shield size={16} />,
    description: 'BRy KMS, TSA e repositório',
  },
  {
    id: 'regras',
    label: 'Regras e Fluxo',
    icon: <Settings2 size={16} />,
    description: 'Prazos, XSD e notificações',
  },
]

export default function DiplomaConfigPage() {
  const { config, loading, saving, error, ambiente, setAmbiente, saveConfig, refresh } =
    useDiplomaConfig()
  const [abaAtiva, setAbaAtiva] = useState<TabId>('instituicao')


  const handleAmbienteChange = (novoAmbiente: AmbienteSistema) => {
    setAmbiente(novoAmbiente)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações do Diploma Digital</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie todas as configurações do sistema de diploma digital da FIC.
            </p>
          </div>

          {/* Seletor de Ambiente */}
          <div className="shrink-0">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => handleAmbienteChange('homologacao')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  ambiente === 'homologacao'
                    ? 'bg-white text-amber-700 shadow-sm border border-amber-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FlaskConical size={14} />
                Homologação
              </button>
              <button
                onClick={() => handleAmbienteChange('producao')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  ambiente === 'producao'
                    ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Rocket size={14} />
                Produção
              </button>
            </div>
          </div>
        </div>

        {/* Banner de ambiente */}
        {ambiente === 'producao' && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <Rocket size={16} className="shrink-0" />
            <span>
              Você está editando o ambiente de <strong>Produção</strong>. Alterações aqui afetam diretamente a emissão de diplomas reais.
            </span>
          </div>
        )}
        {ambiente === 'homologacao' && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            <FlaskConical size={16} className="shrink-0" />
            <span>
              Você está editando o ambiente de <strong>Homologação</strong>. Use para testar sem afetar diplomas reais.
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-800 font-medium"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Tabs + Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Nav */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  abaAtiva === tab.id
                    ? 'border-primary-500 text-primary-700 bg-primary-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={abaAtiva === tab.id ? 'text-primary-500' : 'text-gray-400'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !config ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <AlertCircle size={40} className="mb-3" />
              <p className="text-sm">Não foi possível carregar as configurações.</p>
              <button
                onClick={refresh}
                className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                <RefreshCw size={14} />
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {abaAtiva === 'instituicao' && (
                <AbaInstituicao config={config} saving={saving} onSave={saveConfig} />
              )}
              {abaAtiva === 'visual' && (
                <AbaVisual config={config} saving={saving} ambiente={ambiente} onSave={saveConfig} />
              )}
              {abaAtiva === 'historico' && (
                <AbaVisualHistorico config={config} saving={saving} onSave={saveConfig} />
              )}
              {abaAtiva === 'assinatura' && (
                <AbaIntegracao config={config} saving={saving} onSave={saveConfig} />
              )}
              {abaAtiva === 'regras' && (
                <AbaRegras config={config} saving={saving} onSave={saveConfig} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
