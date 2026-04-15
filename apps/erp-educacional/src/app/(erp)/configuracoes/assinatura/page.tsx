'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Eye, EyeOff, CheckCircle2, AlertCircle,
  Loader2, Wifi, WifiOff, Info, Save, RefreshCw,
  ExternalLink, Key, Server, Clock,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// /configuracoes/assinatura
//
// Configuração global de assinatura digital ICP-Brasil para todos os módulos
// do ERP (Diploma Digital, Acervo, futuros).
//
// Provedor atual: BRy KMS (bry.com.br)
// Padrão de assinatura: XAdES AD-RA (obrigatório Portaria MEC 554/2019)
//
// Esta página salva na tabela `configuracoes` com chave `bry_kms`,
// tornando a configuração compartilhada entre todos os módulos.
// ─────────────────────────────────────────────────────────────────────────────

interface BryConfig {
  api_url: string
  client_id: string
  client_secret: string          // nunca exibido em texto após salvo
  certificate_id: string
  compartimento_uuid: string
  credencial_tipo: 'pin' | 'otp' | 'token'
  credencial_valor: string       // PIN/Token (OTP gerado no ato)
  tsa_url: string
  tsa_usuario: string
  tsa_senha: string              // nunca exibido em texto após salvo
  ambiente: 'homologacao' | 'producao'
  ativo: boolean
}

const EMPTY_CONFIG: BryConfig = {
  api_url: 'https://kms.hom.bry.com.br/kms/rest/v1',
  client_id: '',
  client_secret: '',
  certificate_id: '',
  compartimento_uuid: '',
  credencial_tipo: 'pin',
  credencial_valor: '',
  tsa_url: 'http://timestamp.bry.com.br',
  tsa_usuario: '',
  tsa_senha: '',
  ambiente: 'homologacao',
  ativo: false,
}

const AMBIENTES = {
  homologacao: {
    label: 'Homologação',
    desc: 'Ambiente de testes. Assinaturas não têm validade jurídica.',
    url: 'https://kms.hom.bry.com.br/kms/rest/v1',
    cor: 'amber',
  },
  producao: {
    label: 'Produção',
    desc: 'Ambiente real. Assinaturas têm validade jurídica ICP-Brasil.',
    url: 'https://kms.bry.com.br/kms/rest/v1',
    cor: 'emerald',
  },
} as const

const CREDENCIAL_INFO = {
  pin: {
    label: 'PIN',
    desc: 'Senha fixa do compartimento BRy, codificada em Base64 (UTF-8).',
    placeholder: 'Cole o PIN em texto claro (será convertido para Base64)',
    permanente: true,
  },
  otp: {
    label: 'OTP (App Autenticador)',
    desc: 'Código de 6 dígitos gerado pelo App BRy Autenticador. Válido por 30 segundos. Gerado no momento da assinatura — não precisa salvar aqui.',
    placeholder: 'Nenhum valor necessário — gerado no ato da assinatura',
    permanente: false,
  },
  token: {
    label: 'Token de Pré-Autorização',
    desc: 'Token hexadecimal que autoriza N assinaturas sem interação. Gerado no painel BRy Cloud.',
    placeholder: 'Cole o token hexadecimal gerado pelo BRy Cloud',
    permanente: true,
  },
}

type TesteStatus = 'idle' | 'testando' | 'ok' | 'erro'

export default function ConfiguracaoAssinaturaPage() {
  const [config, setConfig]           = useState<BryConfig>(EMPTY_CONFIG)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [erro, setErro]               = useState<string | null>(null)
  const [testeStatus, setTesteStatus] = useState<TesteStatus>('idle')
  const [testeMsg, setTesteMsg]       = useState('')

  // Controles de visibilidade de campos sensíveis
  const [showSecret, setShowSecret]   = useState(false)
  const [showCred, setShowCred]       = useState(false)
  const [showTsaSenha, setShowTsaSenha] = useState(false)

  // ── Carregar configuração existente ──────────────────────────────────────
  useEffect(() => {
    async function carregar() {
      try {
        const resp = await fetch('/api/configuracoes/assinatura')
        if (resp.ok) {
          const data = await resp.json()
          if (data.config) {
            setConfig({ ...EMPTY_CONFIG, ...data.config })
          }
        }
      } catch {
        // config vazia — vai usar os defaults
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  // ── Mudar ambiente (atualiza URL automaticamente) ─────────────────────────
  const handleAmbienteChange = (amb: 'homologacao' | 'producao') => {
    setConfig((prev) => ({
      ...prev,
      ambiente: amb,
      api_url: AMBIENTES[amb].url,
    }))
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setErro(null)
    try {
      const resp = await fetch('/api/configuracoes/assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error ?? 'Erro ao salvar')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  // ── Testar conexão BRy ────────────────────────────────────────────────────
  const handleTestar = async () => {
    setTesteStatus('testando')
    setTesteMsg('')
    try {
      const resp = await fetch('/api/configuracoes/assinatura/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: config.api_url,
          client_id: config.client_id,
          client_secret: config.client_secret,
        }),
      })
      const data = await resp.json()
      if (resp.ok && data.ok) {
        setTesteStatus('ok')
        setTesteMsg(data.mensagem ?? 'Conexão estabelecida com sucesso.')
      } else {
        setTesteStatus('erro')
        setTesteMsg(data.error ?? 'Falha na conexão com a API BRy.')
      }
    } catch {
      setTesteStatus('erro')
      setTesteMsg('Não foi possível alcançar a API BRy. Verifique URL e credenciais.')
    }
    setTimeout(() => setTesteStatus('idle'), 8000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span>Carregando configurações...</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">

      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Shield size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assinatura Digital</h1>
            <p className="text-sm text-gray-500">BRy KMS — ICP-Brasil XAdES AD-RA</p>
          </div>
          {config.ativo && (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ativo
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Configuração compartilhada entre todos os módulos do ERP (Diploma Digital, Acervo e futuros).
          Assinaturas no padrão <strong>XAdES AD-RA</strong>, obrigatório pela Portaria MEC 554/2019.
        </p>
      </div>

      {/* Aviso banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-blue-800">
          <p className="font-medium mb-0.5">Conta BRy necessária</p>
          <p className="text-blue-700 text-xs">
            Para usar assinatura digital real, você precisa de um contrato ativo com a{' '}
            <a href="https://bry.com.br" target="_blank" rel="noopener noreferrer"
               className="underline hover:text-blue-900 inline-flex items-center gap-0.5">
              BRy Tecnologia <ExternalLink size={10} />
            </a>{' '}
            e um certificado digital A3 configurado no cofre (KMS). Sem configuração, o sistema
            usa <strong>modo simulação</strong> (mock) que não tem validade jurídica.
          </p>
        </div>
      </div>

      {/* Ambiente */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Ambiente</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(AMBIENTES) as [keyof typeof AMBIENTES, typeof AMBIENTES[keyof typeof AMBIENTES]][]).map(([key, amb]) => (
            <button
              key={key}
              onClick={() => handleAmbienteChange(key)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                config.ambiente === key
                  ? key === 'producao'
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-amber-400 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${
                  key === 'producao' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <span className="font-semibold text-sm text-gray-800">{amb.label}</span>
                {config.ambiente === key && (
                  <CheckCircle2 size={14} className={key === 'producao' ? 'text-emerald-600' : 'text-amber-600'} />
                )}
              </div>
              <p className="text-xs text-gray-500 ml-4">{amb.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Credenciais de autenticação */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Credenciais de Autenticação</h2>
        </div>

        <div className="space-y-3">
          {/* URL da API */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL da API BRy KMS</label>
            <input
              type="url"
              value={config.api_url}
              onChange={(e) => setConfig((p) => ({ ...p, api_url: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              placeholder="https://kms.hom.bry.com.br/kms/rest/v1"
            />
          </div>

          {/* Client ID + Client Secret */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <input
                type="text"
                value={config.client_id}
                onChange={(e) => setConfig((p) => ({ ...p, client_id: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder="client-id-bry"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={config.client_secret}
                  onChange={(e) => setConfig((p) => ({ ...p, client_secret: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Certificate ID + Compartimento UUID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Certificate ID</label>
              <input
                type="text"
                value={config.certificate_id}
                onChange={(e) => setConfig((p) => ({ ...p, certificate_id: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder="cert-uuid"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Compartimento UUID</label>
              <input
                type="text"
                value={config.compartimento_uuid}
                onChange={(e) => setConfig((p) => ({ ...p, compartimento_uuid: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tipo de credencial (PIN/OTP/Token) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Método de Credencial A3</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(CREDENCIAL_INFO) as [keyof typeof CREDENCIAL_INFO, typeof CREDENCIAL_INFO[keyof typeof CREDENCIAL_INFO]][]).map(([tipo, info]) => (
            <button
              key={tipo}
              onClick={() => setConfig((p) => ({ ...p, credencial_tipo: tipo }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                config.credencial_tipo === tipo
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {config.credencial_tipo === tipo && <CheckCircle2 size={13} className="text-blue-600" />}
                <span className="font-semibold text-xs text-gray-800">{info.label}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">{info.desc.split('.')[0]}.</p>
            </button>
          ))}
        </div>

        {CREDENCIAL_INFO[config.credencial_tipo].permanente && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Valor da Credencial ({CREDENCIAL_INFO[config.credencial_tipo].label})
            </label>
            <div className="relative">
              <input
                type={showCred ? 'text' : 'password'}
                value={config.credencial_valor}
                onChange={(e) => setConfig((p) => ({ ...p, credencial_valor: e.target.value }))}
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder={CREDENCIAL_INFO[config.credencial_tipo].placeholder}
              />
              <button
                type="button"
                onClick={() => setShowCred((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCred ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        )}

        {config.credencial_tipo === 'otp' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <p>Com OTP, cada assinatura exige que o operador abra o App BRy Autenticador e informe o código de 6 dígitos no momento da assinatura. Não é necessário salvar nenhum valor aqui.</p>
          </div>
        )}
      </section>

      {/* Carimbo de Tempo (TSA) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Carimbo de Tempo (TSA)</h2>
        </div>
        <p className="text-xs text-gray-500">
          Necessário para assinatura AD-RA (com referência de arquivamento). A BRy fornece TSA próprio.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL do TSA</label>
            <input
              type="url"
              value={config.tsa_url}
              onChange={(e) => setConfig((p) => ({ ...p, tsa_url: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              placeholder="http://timestamp.bry.com.br"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Usuário TSA</label>
              <input
                type="text"
                value={config.tsa_usuario}
                onChange={(e) => setConfig((p) => ({ ...p, tsa_usuario: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder="usuario@sua-ies.edu.br"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Senha TSA</label>
              <div className="relative">
                <input
                  type={showTsaSenha ? 'text' : 'password'}
                  value={config.tsa_senha}
                  onChange={(e) => setConfig((p) => ({ ...p, tsa_senha: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowTsaSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showTsaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ativar/Desativar */}
      <section>
        <div
          className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
            config.ativo ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div>
            <p className={`font-medium text-sm ${config.ativo ? 'text-emerald-800' : 'text-gray-700'}`}>
              {config.ativo ? 'Assinatura digital ativada' : 'Assinatura digital desativada (modo simulação)'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {config.ativo
                ? 'Todos os módulos usarão assinatura real via BRy KMS.'
                : 'Módulos usarão assinatura simulada (mock). Não tem validade jurídica.'}
            </p>
          </div>
          <button
            onClick={() => setConfig((p) => ({ ...p, ativo: !p.ativo }))}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              config.ativo ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              config.ativo ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </section>

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p>{erro}</p>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>

        <button
          onClick={handleTestar}
          disabled={testeStatus === 'testando' || !config.client_id || !config.client_secret}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {testeStatus === 'testando'
            ? <Loader2 size={16} className="animate-spin" />
            : testeStatus === 'ok'
              ? <Wifi size={16} className="text-emerald-600" />
              : testeStatus === 'erro'
                ? <WifiOff size={16} className="text-red-500" />
                : <RefreshCw size={16} />
          }
          Testar Conexão BRy
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <CheckCircle2 size={16} />
            Salvo com sucesso!
          </span>
        )}
      </div>

      {/* Resultado do teste */}
      {testeStatus !== 'idle' && testeMsg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          testeStatus === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : testeStatus === 'erro'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          {testeStatus === 'ok'
            ? <Wifi size={16} className="flex-shrink-0 mt-0.5" />
            : <WifiOff size={16} className="flex-shrink-0 mt-0.5" />
          }
          <p>{testeMsg}</p>
        </div>
      )}
    </div>
  )
}
