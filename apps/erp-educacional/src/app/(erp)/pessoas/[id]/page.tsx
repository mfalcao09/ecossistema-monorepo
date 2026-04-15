'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type {
  PessoaComRelacoes,
  PessoaDocumento,
  PessoaEndereco,
  PessoaContato,
  PessoaVinculo,
  StatusPessoa,
  TipoDocumentoPessoal,
  TipoContato,
  TipoVinculo,
} from '@/types/pessoas'
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  FileText,
  MapPin,
  Phone,
  Link2,
  Edit,
  Trash2,
  Plus,
  GraduationCap,
  BookOpen,
  Briefcase,
} from 'lucide-react'
import { BadgesCategorias } from '@/components/pessoas/BadgeCategoria'
import { SeletorCategorias } from '@/components/pessoas/SeletorCategorias'
import { extrairCategorias } from '@/lib/pessoas/categoria-config'

const STATUS_LABELS: Record<StatusPessoa, { label: string; cor: string }> = {
  ativo: { label: 'Ativo', cor: 'bg-green-100 text-green-800' },
  inativo: { label: 'Inativo', cor: 'bg-gray-100 text-gray-800' },
  suspenso: { label: 'Suspenso', cor: 'bg-yellow-100 text-yellow-800' },
  falecido: { label: 'Falecido', cor: 'bg-red-100 text-red-800' },
  transferido: { label: 'Transferido', cor: 'bg-blue-100 text-blue-800' },
}

const DOC_LABELS: Record<string, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  titulo_eleitor: 'Título de Eleitor',
  reservista: 'Certificado Reservista',
  certidao_nascimento: 'Certidão de Nascimento',
  certidao_casamento: 'Certidão de Casamento',
  passaporte: 'Passaporte',
  ctps: 'CTPS',
  pis_pasep: 'PIS/PASEP',
  outro: 'Outro',
}

const CONTATO_LABELS: Record<string, string> = {
  telefone_fixo: 'Telefone Fixo',
  celular: 'Celular',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  email_institucional: 'E-mail Institucional',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  outro: 'Outro',
}

const VINCULO_LABELS: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  colaborador: 'Colaborador',
  candidato: 'Candidato',
  ex_aluno: 'Ex-Aluno',
  visitante: 'Visitante',
  prestador: 'Prestador',
}

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

const ESTADO_CIVIL_OPTIONS = ['solteiro', 'casado', 'divorciado', 'viúvo', 'união_estável']
const SEXO_OPTIONS = ['masculino', 'feminino', 'outro']
const NACIONALIDADE_OPTIONS = ['brasileira', 'estrangeira']

interface TabType {
  id: string
  label: string
  icon: React.ReactNode
}

export default function PessoaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [pessoa, setPessoa] = useState<PessoaComRelacoes | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('dados-pessoais')
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state for dados pessoais
  const [editForm, setEditForm] = useState<Partial<PessoaComRelacoes>>({})

  // Add forms visibility
  const [showAddDocumento, setShowAddDocumento] = useState(false)
  const [showAddEndereco, setShowAddEndereco] = useState(false)
  const [showAddContato, setShowAddContato] = useState(false)
  const [showAddVinculo, setShowAddVinculo] = useState(false)

  // Add forms state
  const [addDocumentoForm, setAddDocumentoForm] = useState<Partial<PessoaDocumento>>({})
  const [addEnderecoForm, setAddEnderecoForm] = useState<Partial<PessoaEndereco>>({})
  const [addContatoForm, setAddContatoForm] = useState<Partial<PessoaContato>>({})
  const [addVinculoForm, setAddVinculoForm] = useState<Partial<PessoaVinculo>>({})

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchPessoa()
  }, [id])

  const fetchPessoa = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/pessoas/${id}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Erro ao carregar pessoa')
      const data = await res.json()
      setPessoa(data)
      setEditForm(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatCPF = (cpf: string) => {
    if (!cpf) return ''
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('pt-BR')
  }

  const handleEditModeToggle = () => {
    if (editMode) {
      setEditForm(pessoa!)
    }
    setEditMode(!editMode)
  }

  const handleSaveDadosPessoais = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/pessoas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      const data = await res.json()
      setPessoa(data)
      setEditMode(false)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar dados pessoais')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePessoa = async () => {
    if (!window.confirm('Tem certeza que deseja deletar esta pessoa? Esta ação não pode ser desfeita.')) {
      return
    }
    try {
      const res = await fetch(`/api/pessoas/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      router.push('/pessoas')
    } catch (err) {
      console.error(err)
      alert('Erro ao deletar pessoa')
    }
  }

  const handleAddDocumento = async () => {
    if (!addDocumentoForm.tipo || !addDocumentoForm.numero) {
      alert('Preencha tipo e número do documento')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`/api/pessoas/${id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addDocumentoForm),
      })
      if (!res.ok) throw new Error('Erro ao adicionar documento')
      await fetchPessoa()
      setShowAddDocumento(false)
      setAddDocumentoForm({})
    } catch (err) {
      console.error(err)
      alert('Erro ao adicionar documento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDocumento = async (docId: string) => {
    if (!window.confirm('Deletar este documento?')) return
    try {
      const res = await fetch(`/api/pessoas/${id}/documentos/${docId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      await fetchPessoa()
    } catch (err) {
      console.error(err)
      alert('Erro ao deletar documento')
    }
  }

  const handleAddEndereco = async () => {
    if (!addEnderecoForm.tipo || !addEnderecoForm.logradouro || !addEnderecoForm.numero) {
      alert('Preencha tipo, logradouro e número')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`/api/pessoas/${id}/enderecos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addEnderecoForm),
      })
      if (!res.ok) throw new Error('Erro ao adicionar endereço')
      await fetchPessoa()
      setShowAddEndereco(false)
      setAddEnderecoForm({})
    } catch (err) {
      console.error(err)
      alert('Erro ao adicionar endereço')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEndereco = async (endId: string) => {
    if (!window.confirm('Deletar este endereço?')) return
    try {
      const res = await fetch(`/api/pessoas/${id}/enderecos/${endId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      await fetchPessoa()
    } catch (err) {
      console.error(err)
      alert('Erro ao deletar endereço')
    }
  }

  const handleAddContato = async () => {
    if (!addContatoForm.tipo || !addContatoForm.valor) {
      alert('Preencha tipo e valor do contato')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`/api/pessoas/${id}/contatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addContatoForm),
      })
      if (!res.ok) throw new Error('Erro ao adicionar contato')
      await fetchPessoa()
      setShowAddContato(false)
      setAddContatoForm({})
    } catch (err) {
      console.error(err)
      alert('Erro ao adicionar contato')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteContato = async (conId: string) => {
    if (!window.confirm('Deletar este contato?')) return
    try {
      const res = await fetch(`/api/pessoas/${id}/contatos/${conId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      await fetchPessoa()
    } catch (err) {
      console.error(err)
      alert('Erro ao deletar contato')
    }
  }

  const handleAddVinculo = async () => {
    if (!addVinculoForm.tipo || !addVinculoForm.status) {
      alert('Preencha tipo e status do vínculo')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`/api/pessoas/${id}/vinculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addVinculoForm),
      })
      if (!res.ok) throw new Error('Erro ao adicionar vínculo')
      await fetchPessoa()
      setShowAddVinculo(false)
      setAddVinculoForm({})
    } catch (err) {
      console.error(err)
      alert('Erro ao adicionar vínculo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVinculo = async (vinId: string) => {
    if (!window.confirm('Deletar este vínculo?')) return
    try {
      const res = await fetch(`/api/pessoas/${id}/vinculos/${vinId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      await fetchPessoa()
    } catch (err) {
      console.error(err)
      alert('Erro ao deletar vínculo')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (notFound || !pessoa) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <p className="font-semibold">Pessoa não encontrada</p>
          <p className="text-sm mt-1">O ID fornecido não corresponde a nenhuma pessoa no sistema.</p>
        </div>
      </div>
    )
  }

  const tabs: TabType[] = [
    { id: 'dados-pessoais', label: 'Dados Pessoais', icon: <User className="w-4 h-4" /> },
    { id: 'documentos', label: 'Documentos', icon: <FileText className="w-4 h-4" /> },
    { id: 'enderecos', label: 'Endereços', icon: <MapPin className="w-4 h-4" /> },
    { id: 'contatos', label: 'Contatos', icon: <Phone className="w-4 h-4" /> },
    { id: 'vinculos', label: 'Vínculos', icon: <Link2 className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {pessoa.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{pessoa.nome}</h1>
                {pessoa.nome_social && (
                  <p className="text-sm text-gray-600">Nome social: {pessoa.nome_social}</p>
                )}
                <p className="text-sm text-gray-600">CPF: {formatCPF(pessoa.cpf)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      STATUS_LABELS[pessoa.status].cor
                    }`}
                  >
                    {STATUS_LABELS[pessoa.status].label}
                  </span>
                  {/* Badges de categorias */}
                  {pessoa.vinculos && pessoa.vinculos.length > 0 && (
                    <BadgesCategorias
                      tipos={extrairCategorias(pessoa.vinculos)}
                      tamanho="sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEditModeToggle}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={handleDeletePessoa}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Trash2 className="w-4 h-4" />
                Deletar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-4 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Dados Pessoais Tab */}
        {activeTab === 'dados-pessoais' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Dados Pessoais</h2>
                {editMode && (
                  <button
                    onClick={handleSaveDadosPessoais}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.nome || ''}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.nome}</p>
                  )}
                </div>

                {/* Nome Social */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Social</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.nome_social || ''}
                      onChange={(e) => setEditForm({ ...editForm, nome_social: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.nome_social || '—'}</p>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CPF</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.cpf || ''}
                      onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 font-mono">{formatCPF(pessoa.cpf)}</p>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Nascimento
                  </label>
                  {editMode ? (
                    <input
                      type="date"
                      value={
                        editForm.data_nascimento
                          ? new Date(editForm.data_nascimento).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) => setEditForm({ ...editForm, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(pessoa.data_nascimento)}</p>
                  )}
                </div>

                {/* Sexo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sexo</label>
                  {editMode ? (
                    <select
                      value={editForm.sexo || ''}
                      onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {SEXO_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {pessoa.sexo ? pessoa.sexo.charAt(0).toUpperCase() + pessoa.sexo.slice(1) : '—'}
                    </p>
                  )}
                </div>

                {/* Estado Civil */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estado Civil</label>
                  {editMode ? (
                    <select
                      value={editForm.estado_civil || ''}
                      onChange={(e) => setEditForm({ ...editForm, estado_civil: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {ESTADO_CIVIL_OPTIONS.map((ec) => (
                        <option key={ec} value={ec}>
                          {ec.charAt(0).toUpperCase() + ec.slice(1).replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {pessoa.estado_civil
                        ? pessoa.estado_civil.charAt(0).toUpperCase() + pessoa.estado_civil.slice(1)
                        : '—'}
                    </p>
                  )}
                </div>

                {/* Nacionalidade */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nacionalidade</label>
                  {editMode ? (
                    <select
                      value={editForm.nacionalidade || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nacionalidade: e.target.value as any })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {NACIONALIDADE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {pessoa.nacionalidade
                        ? pessoa.nacionalidade.charAt(0).toUpperCase() + pessoa.nacionalidade.slice(1)
                        : '—'}
                    </p>
                  )}
                </div>

                {/* Naturalidade */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Naturalidade</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.naturalidade_municipio || ''}
                      onChange={(e) => setEditForm({ ...editForm, naturalidade_municipio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.naturalidade_municipio || '—'}</p>
                  )}
                </div>

                {/* Filiação Pai */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Filiação - Pai</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.nome_pai || ''}
                      onChange={(e) => setEditForm({ ...editForm, nome_pai: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.nome_pai || '—'}</p>
                  )}
                </div>

                {/* Filiação Mãe */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Filiação - Mãe</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.nome_mae || ''}
                      onChange={(e) => setEditForm({ ...editForm, nome_mae: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.nome_mae || '—'}</p>
                  )}
                </div>

                {/* Observações */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                  {editMode ? (
                    <textarea
                      value={editForm.observacoes || ''}
                      onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{pessoa.observacoes || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documentos Tab */}
        {activeTab === 'documentos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Documentos</h2>
              <button
                onClick={() => setShowAddDocumento(!showAddDocumento)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar Documento
              </button>
            </div>

            {showAddDocumento && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Novo Documento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                    <select
                      value={addDocumentoForm.tipo || ''}
                      onChange={(e) => setAddDocumentoForm({ ...addDocumentoForm, tipo: e.target.value as TipoDocumentoPessoal })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {Object.entries(DOC_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={addDocumentoForm.numero || ''}
                      onChange={(e) => setAddDocumentoForm({ ...addDocumentoForm, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Órgão Expedidor
                    </label>
                    <input
                      type="text"
                      value={addDocumentoForm.orgao_expedidor || ''}
                      onChange={(e) =>
                        setAddDocumentoForm({ ...addDocumentoForm, orgao_expedidor: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data de Expedição
                    </label>
                    <input
                      type="date"
                      value={
                        addDocumentoForm.data_expedicao
                          ? new Date(addDocumentoForm.data_expedicao).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setAddDocumentoForm({ ...addDocumentoForm, data_expedicao: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddDocumento}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddDocumento(false)
                      setAddDocumentoForm({})
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {pessoa.documentos && pessoa.documentos.length > 0 ? (
              <div className="grid gap-4">
                {pessoa.documentos.map((doc) => (
                  <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">{DOC_LABELS[doc.tipo] || doc.tipo}</h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Número:</span> {doc.numero}
                        </p>
                        {doc.orgao_expedidor && (
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Órgão Expedidor:</span> {doc.orgao_expedidor}
                          </p>
                        )}
                        {doc.data_expedicao && (
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Data de Expedição:</span> {formatDate(doc.data_expedicao)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteDocumento(doc.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Nenhum documento cadastrado</p>
              </div>
            )}
          </div>
        )}

        {/* Endereços Tab */}
        {activeTab === 'enderecos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Endereços</h2>
              <button
                onClick={() => setShowAddEndereco(!showAddEndereco)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar Endereço
              </button>
            </div>

            {showAddEndereco && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Novo Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                    <select
                      value={addEnderecoForm.tipo || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, tipo: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      <option value="residencial">Residencial</option>
                      <option value="comercial">Comercial</option>
                      <option value="correspondencia">Correspondência</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
                    <input
                      type="text"
                      placeholder="Buscar via CEP"
                      value={addEnderecoForm.cep || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, cep: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Logradouro</label>
                    <input
                      type="text"
                      value={addEnderecoForm.logradouro || ''}
                      onChange={(e) =>
                        setAddEnderecoForm({ ...addEnderecoForm, logradouro: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={addEnderecoForm.numero || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Complemento</label>
                    <input
                      type="text"
                      value={addEnderecoForm.complemento || ''}
                      onChange={(e) =>
                        setAddEnderecoForm({ ...addEnderecoForm, complemento: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bairro</label>
                    <input
                      type="text"
                      value={addEnderecoForm.bairro || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, bairro: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade</label>
                    <input
                      type="text"
                      value={addEnderecoForm.cidade || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, cidade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">UF</label>
                    <select
                      value={addEnderecoForm.uf || ''}
                      onChange={(e) => setAddEnderecoForm({ ...addEnderecoForm, uf: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddEndereco}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEndereco(false)
                      setAddEnderecoForm({})
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {pessoa.enderecos && pessoa.enderecos.length > 0 ? (
              <div className="grid gap-4">
                {pessoa.enderecos.map((end) => (
                  <div key={end.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">
                            {end.logradouro}, {end.numero}
                          </h3>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {end.tipo.charAt(0).toUpperCase() + end.tipo.slice(1)}
                          </span>
                        </div>
                        {end.complemento && (
                          <p className="text-sm text-gray-600">{end.complemento}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          {end.bairro} - {end.cidade}, {end.uf}
                        </p>
                        {end.cep && (
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">CEP:</span> {end.cep}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEndereco(end.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Nenhum endereço cadastrado</p>
              </div>
            )}
          </div>
        )}

        {/* Contatos Tab */}
        {activeTab === 'contatos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Contatos</h2>
              <button
                onClick={() => setShowAddContato(!showAddContato)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar Contato
              </button>
            </div>

            {showAddContato && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Novo Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                    <select
                      value={addContatoForm.tipo || ''}
                      onChange={(e) => setAddContatoForm({ ...addContatoForm, tipo: e.target.value as TipoContato })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {Object.entries(CONTATO_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Valor</label>
                    <input
                      type="text"
                      value={addContatoForm.valor || ''}
                      onChange={(e) => setAddContatoForm({ ...addContatoForm, valor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddContato}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddContato(false)
                      setAddContatoForm({})
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {pessoa.contatos && pessoa.contatos.length > 0 ? (
              <div className="grid gap-4">
                {pessoa.contatos.map((con) => (
                  <div key={con.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">
                            {CONTATO_LABELS[con.tipo] || con.tipo}
                          </h3>
                        </div>
                        <p className="text-gray-900 break-all">{con.valor}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteContato(con.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                <Phone className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Nenhum contato cadastrado</p>
              </div>
            )}
          </div>
        )}

        {/* Vínculos Tab */}
        {activeTab === 'vinculos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Vínculos</h2>
              <button
                onClick={() => setShowAddVinculo(!showAddVinculo)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar Vínculo
              </button>
            </div>

            {showAddVinculo && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Novo Vínculo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                    <select
                      value={addVinculoForm.tipo || ''}
                      onChange={(e) => setAddVinculoForm({ ...addVinculoForm, tipo: e.target.value as TipoVinculo })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {Object.entries(VINCULO_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <select
                      value={addVinculoForm.status || ''}
                      onChange={(e) => setAddVinculoForm({ ...addVinculoForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                      <option value="trancado">Trancado</option>
                      <option value="desligado">Desligado</option>
                      <option value="formado">Formado</option>
                      <option value="transferido">Transferido</option>
                      <option value="jubilado">Jubilado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cargo</label>
                    <input
                      type="text"
                      value={addVinculoForm.cargo || ''}
                      onChange={(e) => setAddVinculoForm({ ...addVinculoForm, cargo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={
                        addVinculoForm.data_inicio
                          ? new Date(addVinculoForm.data_inicio).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setAddVinculoForm({ ...addVinculoForm, data_inicio: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Término</label>
                    <input
                      type="date"
                      value={
                        addVinculoForm.data_fim
                          ? new Date(addVinculoForm.data_fim).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) => setAddVinculoForm({ ...addVinculoForm, data_fim: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddVinculo}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddVinculo(false)
                      setAddVinculoForm({})
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {pessoa.vinculos && pessoa.vinculos.length > 0 ? (
              <div className="grid gap-4">
                {pessoa.vinculos.map((vin) => (
                  <div key={vin.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">
                            {VINCULO_LABELS[vin.tipo] || vin.tipo}
                          </h3>
                          <span
                            className={`text-xs px-2 py-1 rounded font-semibold ${
                              vin.status === 'ativo'
                                ? 'bg-green-100 text-green-800'
                                : vin.status === 'inativo'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {vin.status.charAt(0).toUpperCase() + vin.status.slice(1)}
                          </span>
                        </div>
                        {vin.cargo && (
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Cargo:</span> {vin.cargo}
                          </p>
                        )}
                        <div className="flex gap-4 text-sm text-gray-600 mt-2">
                          {vin.data_inicio && (
                            <p>
                              <span className="font-semibold">Início:</span> {formatDate(vin.data_inicio)}
                            </p>
                          )}
                          {vin.data_fim && (
                            <p>
                              <span className="font-semibold">Término:</span> {formatDate(vin.data_fim)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteVinculo(vin.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                <Briefcase className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Nenhum vínculo cadastrado</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
