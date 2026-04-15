'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Save,
  Edit,
  Loader2,
  ArrowLeft,
  Palette,
  Globe,
  Users,
  BarChart3,
  AlertCircle,
} from 'lucide-react'
import { TenantConfig, PlanoTenant, StatusTenant } from '@/types/configuracoes'

const STATUS_TENANT: Record<StatusTenant, { label: string; cor: string }> = {
  ativo: { label: 'Ativo', cor: 'bg-green-100 text-green-700' },
  inativo: { label: 'Inativo', cor: 'bg-gray-100 text-gray-700' },
  trial: { label: 'Trial', cor: 'bg-purple-100 text-purple-700' },
  suspenso: { label: 'Suspenso', cor: 'bg-yellow-100 text-yellow-700' },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-700' },
}

const PLANO_LABELS: Record<PlanoTenant, { label: string; cor: string }> = {
  free: { label: 'Free', cor: 'bg-gray-100 text-gray-700' },
  starter: { label: 'Starter', cor: 'bg-blue-100 text-blue-700' },
  pro: { label: 'Pro', cor: 'bg-indigo-100 text-indigo-700' },
  enterprise: { label: 'Enterprise', cor: 'bg-amber-100 text-amber-800' },
}

interface TenantFormData extends TenantConfig {
  id?: string
  nome?: string
}

export default function TenantConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [tenant, setTenant] = useState<TenantFormData | null>(null)
  const [formData, setFormData] = useState<TenantFormData | null>(null)
  const [currentUsage, setCurrentUsage] = useState({
    usuarios: 0,
    cursos: 0,
    alunos: 0,
  })

  // Fetch tenant data
  useEffect(() => {
    const fetchTenant = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/configuracoes/tenant')
        if (!res.ok) throw new Error('Falha ao carregar configurações do tenant')

        const data = await res.json()
        setTenant(data)
        setFormData(data)

        // Fetch current usage data
        try {
          const usageRes = await fetch('/api/configuracoes/tenant/usage')
          if (usageRes.ok) {
            const usage = await usageRes.json()
            setCurrentUsage(usage)
          }
        } catch {
          // Usage endpoint may not exist yet
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    fetchTenant()
  }, [])

  const handleInputChange = (field: string, value: any) => {
    if (!formData) return

    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData({
        ...formData,
        [parent]: {
          ...(formData[parent as keyof TenantFormData] as any),
          [child]: value,
        },
      })
    } else {
      setFormData({
        ...formData,
        [field]: value,
      })
    }
  }

  const handleSave = async () => {
    if (!formData) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/configuracoes/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Falha ao salvar configurações')
      }

      const updated = await res.json()
      setTenant(updated)
      setFormData(updated)
      setEditMode(false)
      setSuccess('Configurações salvas com sucesso!')

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData(tenant)
    setEditMode(false)
    setError(null)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    )
  }

  if (!tenant || !formData) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-900 font-medium">Erro ao carregar</p>
            <p className="text-red-700 text-sm">{error || 'Dados de configuração não disponíveis'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Configurações da Instituição</h1>
          </div>
          <p className="text-gray-500">Gerencie os dados e configurações do seu tenant</p>
        </div>

        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-900">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <div className="w-5 h-5 bg-green-600 rounded-full flex-shrink-0 mt-0.5" />
          <p className="text-green-900">{success}</p>
        </div>
      )}

      {/* Cards Container */}
      <div className="space-y-6">
        {/* Dados Básicos */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Dados Básicos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Instituição
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.nome || ''}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="px-4 py-2 text-gray-900">{tenant.nome || '—'}</p>
              )}
            </div>

            {/* Sigla */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sigla
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.slug || ''}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="px-4 py-2 text-gray-900 font-mono">{tenant.slug || '—'}</p>
              )}
            </div>

            {/* Logo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL
              </label>
              {editMode ? (
                <input
                  type="url"
                  value={formData.logo_url || ''}
                  onChange={(e) => handleInputChange('logo_url', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="https://..."
                />
              ) : (
                <p className="px-4 py-2 text-gray-600 text-sm break-all">{tenant.logo_url || '—'}</p>
              )}
              {formData.logo_url && (
                <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-16 h-16 bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden">
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="max-w-full max-h-full"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="%23999" font-size="12"%3EErro ao carregar%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">Preview da logo</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plano e Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Plano e Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plano */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plano Atual
              </label>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    PLANO_LABELS[tenant.plano].cor
                  }`}
                >
                  {PLANO_LABELS[tenant.plano].label}
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    STATUS_TENANT[tenant.status_tenant].cor
                  }`}
                >
                  {STATUS_TENANT[tenant.status_tenant].label}
                </span>
              </div>
            </div>

            {/* Trial Dates */}
            {tenant.status_tenant === 'trial' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Início do Trial
                  </label>
                  <p className="px-4 py-2 text-gray-900">
                    {tenant.trial_inicio
                      ? new Date(tenant.trial_inicio).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fim do Trial
                  </label>
                  <p className="px-4 py-2 text-gray-900">
                    {tenant.trial_fim
                      ? new Date(tenant.trial_fim).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Limites */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Limites de Uso</h2>
          </div>

          <div className="space-y-6">
            {/* Usuários */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuários
                </label>
                <span className="text-sm text-gray-600">
                  {currentUsage.usuarios} / {tenant.limites.usuarios}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      (currentUsage.usuarios / tenant.limites.usuarios) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Cursos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Cursos</label>
                <span className="text-sm text-gray-600">
                  {currentUsage.cursos} / {tenant.limites.cursos}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      (currentUsage.cursos / tenant.limites.cursos) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Alunos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Alunos</label>
                <span className="text-sm text-gray-600">
                  {currentUsage.alunos} / {tenant.limites.alunos}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      (currentUsage.alunos / tenant.limites.alunos) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Personalização */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Personalização</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cor Primária */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor Primária
              </label>
              {editMode ? (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cores_tema?.primaria || '#000000'}
                    onChange={(e) =>
                      handleInputChange('cores_tema.primaria', e.target.value)
                    }
                    className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.cores_tema?.primaria || ''}
                    onChange={(e) =>
                      handleInputChange('cores_tema.primaria', e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded border-2 border-gray-300"
                    style={{ backgroundColor: tenant.cores_tema?.primaria }}
                  />
                  <p className="text-gray-900 font-mono text-sm">
                    {tenant.cores_tema?.primaria || '—'}
                  </p>
                </div>
              )}
            </div>

            {/* Cor Secundária */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor Secundária
              </label>
              {editMode ? (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cores_tema?.secundaria || '#000000'}
                    onChange={(e) =>
                      handleInputChange('cores_tema.secundaria', e.target.value)
                    }
                    className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.cores_tema?.secundaria || ''}
                    onChange={(e) =>
                      handleInputChange('cores_tema.secundaria', e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded border-2 border-gray-300"
                    style={{ backgroundColor: tenant.cores_tema?.secundaria }}
                  />
                  <p className="text-gray-900 font-mono text-sm">
                    {tenant.cores_tema?.secundaria || '—'}
                  </p>
                </div>
              )}
            </div>

            {/* Domínio Customizado */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Domínio Customizado
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.dominio_customizado || ''}
                  onChange={(e) => handleInputChange('dominio_customizado', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="exemplo.com.br"
                />
              ) : (
                <p className="px-4 py-2 text-gray-900">
                  {tenant.dominio_customizado || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-3">
          {editMode ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Alterações
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar Configurações
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
