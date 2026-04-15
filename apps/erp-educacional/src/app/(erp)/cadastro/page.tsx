'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2, Building, BookOpen, ArrowRight,
  ClipboardList, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, GraduationCap, Users
} from 'lucide-react'

interface Metricas {
  total_ies: number
  credenciamentos_vigentes: number
  credenciamentos_vencendo: number // próximos 180 dias
  credenciamentos_vencidos: number
  total_departamentos: number
  total_cursos: number
  total_diretores: number
}

function MetricCard({
  label, value, icon: Icon, cor, sub, href,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  cor: string
  sub?: string
  href?: string
}) {
  const content = (
    <div className={`bg-white rounded-2xl border p-5 flex items-start gap-4 transition-all ${href ? 'hover:shadow-md hover:border-blue-200 cursor-pointer' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cor}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</p>
        <p className="text-sm text-gray-500 leading-tight">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

export default function CadastroDashboard() {
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/instituicoes').then(r => r.json()),
      fetch('/api/credenciamentos').then(r => r.json()),
      fetch('/api/departamentos').then(r => r.json()),
      fetch('/api/cursos').then(r => r.json()),
      fetch('/api/diretores').then(r => r.json()),
    ])
      .then(([ies, creds, deps, cursos, diretores]) => {
        const hoje = new Date()
        const em180dias = new Date(hoje.getTime() + 180 * 24 * 60 * 60 * 1000)

        const vigentes = Array.isArray(creds) ? creds.filter((c: { vigente: boolean }) => c.vigente) : []
        const vencendo = Array.isArray(creds) ? creds.filter((c: { vigente: boolean; data_vencimento: string }) => {
          if (!c.vigente || !c.data_vencimento) return false
          const venc = new Date(c.data_vencimento)
          return venc > hoje && venc <= em180dias
        }) : []
        const vencidos = Array.isArray(creds) ? creds.filter((c: { vigente: boolean; data_vencimento: string }) => {
          if (!c.data_vencimento) return false
          return new Date(c.data_vencimento) < hoje
        }) : []

        setMetricas({
          total_ies: Array.isArray(ies) ? ies.filter((i: { tipo: string }) => i.tipo === 'emissora' || !i.tipo).length : 0,
          credenciamentos_vigentes: vigentes.length,
          credenciamentos_vencendo: vencendo.length,
          credenciamentos_vencidos: vencidos.length,
          total_departamentos: Array.isArray(deps) ? deps.length : 0,
          total_cursos: Array.isArray(cursos) ? cursos.length : 0,
          total_diretores: Array.isArray(diretores) ? diretores.length : 0,
        })
      })
      .catch(() => setMetricas(null))
      .finally(() => setLoading(false))
  }, [])

  const m = metricas

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList size={26} className="text-blue-500" />
          Cadastro
        </h1>
        <p className="text-gray-500 mt-1">
          Gerencie as instituições, estrutura acadêmica e cursos do sistema
        </p>
      </div>

      {/* Alertas críticos */}
      {!loading && m && (m.credenciamentos_vencidos > 0 || m.credenciamentos_vencendo > 0) && (
        <div className="mb-6 space-y-2">
          {m.credenciamentos_vencidos > 0 && (
            <Link href="/cadastro/ies" className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm hover:bg-red-100 transition-colors">
              <AlertTriangle size={16} className="shrink-0" />
              <strong>{m.credenciamentos_vencidos} credenciamento{m.credenciamentos_vencidos > 1 ? 's' : ''} vencido{m.credenciamentos_vencidos > 1 ? 's' : ''}</strong> — Ação imediata necessária
              <ArrowRight size={14} className="ml-auto" />
            </Link>
          )}
          {m.credenciamentos_vencendo > 0 && (
            <Link href="/cadastro/ies" className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm hover:bg-amber-100 transition-colors">
              <Clock size={16} className="shrink-0" />
              <strong>{m.credenciamentos_vencendo} recredenciamento{m.credenciamentos_vencendo > 1 ? 's' : ''}</strong> vencendo nos próximos 180 dias
              <ArrowRight size={14} className="ml-auto" />
            </Link>
          )}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Unidades de Ensino"
          value={loading ? '—' : (m?.total_ies ?? 0)}
          icon={Building2}
          cor="bg-blue-500"
          href="/cadastro/ies"
        />
        <MetricCard
          label="Credenciamentos vigentes"
          value={loading ? '—' : (m?.credenciamentos_vigentes ?? 0)}
          icon={CheckCircle2}
          cor="bg-emerald-500"
          sub={m?.credenciamentos_vencendo ? `${m.credenciamentos_vencendo} vencendo em breve` : undefined}
        />
        <MetricCard
          label="Departamentos"
          value={loading ? '—' : (m?.total_departamentos ?? 0)}
          icon={Building}
          cor="bg-indigo-500"
          href="/cadastro/departamentos"
        />
        <MetricCard
          label="Cursos cadastrados"
          value={loading ? '—' : (m?.total_cursos ?? 0)}
          icon={GraduationCap}
          cor="bg-violet-500"
          href="/cadastro/cursos"
        />
      </div>

      {/* Cards de navegação */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Módulos de Cadastro</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Link
          href="/cadastro/ies"
          className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center">
              <Building2 size={22} className="text-white" />
            </div>
            <ArrowRight size={17} className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Unidades de Ensino (IES)</h2>
          <p className="text-sm text-gray-500">
            Cadastre e gerencie IES, mantenedoras vinculadas, credenciamentos, diretoria e endereço
          </p>
          {!loading && m && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{m.total_ies} unidade{m.total_ies !== 1 ? 's' : ''}</span>
              {m.credenciamentos_vencidos > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  {m.credenciamentos_vencidos} vencido{m.credenciamentos_vencidos > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </Link>

        <Link
          href="/cadastro/departamentos"
          className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 bg-indigo-400 rounded-xl flex items-center justify-center">
              <Building size={22} className="text-white" />
            </div>
            <ArrowRight size={17} className="text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Departamentos</h2>
          <p className="text-sm text-gray-500">
            Organize a estrutura departamental das instituições cadastradas
          </p>
          {!loading && m && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
              {m.total_departamentos} departamento{m.total_departamentos !== 1 ? 's' : ''}
            </p>
          )}
        </Link>

        <Link
          href="/cadastro/cursos"
          className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 bg-violet-500 rounded-xl flex items-center justify-center">
              <BookOpen size={22} className="text-white" />
            </div>
            <ArrowRight size={17} className="text-gray-300 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Cursos</h2>
          <p className="text-sm text-gray-500">
            Gerencie os cursos de graduação, habilitações e modalidades de oferta
          </p>
          {!loading && m && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
              {m.total_cursos} curso{m.total_cursos !== 1 ? 's' : ''} cadastrado{m.total_cursos !== 1 ? 's' : ''}
            </p>
          )}
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 bg-gray-200 rounded-xl flex items-center justify-center">
              <TrendingUp size={22} className="text-gray-400" />
            </div>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Em breve</span>
          </div>
          <h2 className="text-base font-bold text-gray-400 mb-1">Relatórios de Cadastro</h2>
          <p className="text-sm text-gray-400">
            Análises, exportações e relatórios do cadastro institucional
          </p>
        </div>

      </div>
    </div>
  )
}
