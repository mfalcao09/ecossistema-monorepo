'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Server, Clock, CheckCircle2, Eye, EyeOff,
  Loader2, Wifi, WifiOff, ExternalLink, Info, AlertCircle,
} from 'lucide-react'
import type { DiplomaConfig, ProvedorAssinatura, BryCredencialTipo } from '@/types/diploma-config'
import { PROVEDOR_LABELS } from '@/types/diploma-config'

interface AbaIntegracaoProps {
  config: DiplomaConfig
  saving: boolean
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

// URLs base BRy KMS por ambiente
const BRY_ENDPOINTS = {
  homologacao: 'https://kms.hom.bry.com.br/kms/rest/v1',
  producao:    'https://kms.bry.com.br/kms/rest/v1',
}

const CREDENCIAL_LABELS: Record<BryCredencialTipo, { label: string; desc: string; placeholder: string }> = {
  pin:   { label: 'PIN',   desc: 'Senha fixa do compartimento, codificada em Base64 (UTF-8).', placeholder: 'Cole o PIN em texto (será enviado como Base64)' },
  otp:   { label: 'OTP',   desc: 'Código de 6 dígitos gerado pelo App BRy Autenticador (válido por 30s).', placeholder: 'Deixe em branco — o OTP é gerado no ato da assinatura' },
  token: { label: 'TOKEN', desc: 'Token de pré-autorização (Hexadecimal) que permite N assinaturas sem interação.', placeholder: 'Cole o token hexadecimal gerado pelo BRy Cloud' },
}

type TesteStatus = 'idle' | 'testando' | 'ok' | 'erro'

export default function AbaIntegracao({ config, saving, onSave }: AbaIntegracaoProps) {
  const [provedor, setProvedor]           = useState<ProvedorAssinatura>(config.assinatura_provedor ?? 'nenhum')
  const [bryAmbiente, setBryAmbiente]     = useState<'homologacao' | 'producao'>('homologacao')
  const [apiToken, setApiToken]           = useState('')                          // Bearer JWT BRy Cloud
  const [compartimentoUUID, setCompartimentoUUID] = useState(config.bry_compartimento_uuid ?? '')
  const [credTipo, setCredTipo]           = useState<BryCredencialTipo>(config.bry_credencial_tipo ?? 'pin')
  const [credValor, setCredValor]         = useState('')                          // PIN/TOKEN (OTP não precisa)
  const [endpoint, setEndpoint]           = useState(config.assinatura_endpoint ?? '')
  const [apiKey, setApiKey]               = useState('')                          // genérico (não-BRy)
  const [tsaUrl, setTsaUrl]               = useState(config.tsa_url ?? '')
  const [tsaUsuario, setTsaUsuario]       = useState(config.tsa_usuario ?? '')
  const [tsaSenha, setTsaSenha]           = useState('')
  const [repositorioUrl, setRepositorioUrl] = useState(config.repositorio_url ?? '')
  const [showToken, setShowToken]         = useState(false)
  const [showApiKey, setShowApiKey]       = useState(false)
  const [showTsaSenha, setShowTsaSenha]   = useState(false)
  const [showCredValor, setShowCredValor] = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [testeStatus, setTesteStatus]     = useState<TesteStatus>('idle')
  const [testeMsg, setTesteMsg]           = useState('')

  useEffect(() => {
    setProvedor(config.assinatura_provedor ?? 'nenhum')
    setEndpoint(config.assinatura_endpoint ?? '')
    setCompartimentoUUID(config.bry_compartimento_uuid ?? '')
    setCredTipo(config.bry_credencial_tipo ?? 'pin')
    setApiToken('')
    setApiKey('')
    setTsaUrl(config.tsa_url ?? '')
    setTsaUsuario(config.tsa_usuario ?? '')
    setTsaSenha('')
    setCredValor('')
    setRepositorioUrl(config.repositorio_url ?? '')
  }, [config])

  // Sincroniza endpoint BRy automaticamente conforme ambiente selecionado
  useEffect(() => {
    if (provedor === 'bry') {
      setEndpoint(BRY_ENDPOINTS[bryAmbiente])
    }
  }, [provedor, bryAmbiente])

  const handleSave = async () => {
    const updates: Partial<DiplomaConfig> = {
      assinatura_provedor:    provedor,
      assinatura_endpoint:    endpoint || null,
      tsa_url:                tsaUrl || null,
      tsa_usuario:            tsaUsuario || null,
      repositorio_url:        repositorioUrl || null,
      bry_compartimento_uuid: compartimentoUUID.trim() || null,
      bry_credencial_tipo:    credTipo,
    }
    if (apiToken.trim())    updates.assinatura_api_key_enc = apiToken.trim()
    if (apiKey.trim())      updates.assinatura_api_key_enc = apiKey.trim()
    if (tsaSenha.trim())    updates.tsa_senha_enc          = tsaSenha.trim()
    if (credValor.trim())   updates.bry_credencial_enc     = credValor.trim()

    const ok = await onSave(updates)
    if (ok) {
      setSaved(true)
      setApiToken('')
      setApiKey('')
      setTsaSenha('')
      setCredValor('')
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const testarConexao = async () => {
    setTesteStatus('testando')
    setTesteMsg('')
    try {
      const res = await fetch('/api/config/testar-bry', { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.ok) {
        setTesteStatus('ok')
        setTesteMsg(json.mensagem ?? 'Conexão bem-sucedida com o BRy KMS.')
      } else {
        setTesteStatus('erro')
        setTesteMsg(json.erro ?? 'Falha na conexão. Verifique as credenciais.')
      }
    } catch {
      setTesteStatus('erro')
      setTesteMsg('Erro de rede. O endpoint está acessível?')
    }
  }

  const provedoresOrdem: ProvedorAssinatura[] = ['bry', 'certisign', 'soluti', 'serpro', 'govbr', 'manual', 'nenhum']
  const credInfo = CREDENCIAL_LABELS[credTipo]

  return (
    <div className="space-y-8">

      {/* ── Provedor ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Provedor de Assinatura Digital</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          {provedoresOrdem.map((p) => (
            <button
              key={p}
              onClick={() => setProvedor(p)}
              className={`relative px-3 py-2.5 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                provedor === p
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {p === 'bry' && (
                <span className="absolute -top-2 -right-2 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  RECOMENDADO
                </span>
              )}
              {PROVEDOR_LABELS[p]}
            </button>
          ))}
        </div>
      </section>

      {/* ── Configuração específica BRy ───────────────────────────────────── */}
      {provedor === 'bry' && (
        <section className="space-y-5">
          <div className="flex items-center gap-2 border-t border-gray-100 pt-6">
            <div className="w-6 h-6 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center shrink-0">B</div>
            <h3 className="font-semibold text-gray-800">Configuração BRy KMS</h3>
            <a
              href="https://cloud.bry.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              BRy Cloud <ExternalLink size={12} />
            </a>
          </div>

          {/* Ambiente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ambiente</label>
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
              {(['homologacao', 'producao'] as const).map((amb) => (
                <button
                  key={amb}
                  onClick={() => setBryAmbiente(amb)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                    bryAmbiente === amb
                      ? amb === 'producao'
                        ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                        : 'bg-white text-amber-700 shadow-sm border border-amber-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {amb === 'homologacao' ? 'Homologação' : 'Produção'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Endpoint: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{BRY_ENDPOINTS[bryAmbiente]}</code>
            </p>
          </div>

          {/* Bearer JWT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Token (Bearer JWT)
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={config.assinatura_api_key_enc
                  ? '••••••••••••• (token salvo — preencha para substituir)'
                  : 'Cole o token JWT gerado no BRy Cloud'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none font-mono"
              />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Obtido em BRy Cloud → Minha Conta → Tokens de API. Armazenado criptografado.
            </p>
          </div>

          {/* UUID do Compartimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              UUID do Compartimento (HSM)
            </label>
            <input
              type="text"
              value={compartimentoUUID}
              onChange={(e) => setCompartimentoUUID(e.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Identificador UUID do compartimento onde o certificado A3 está armazenado no HSM da BRy.
            </p>
          </div>

          {/* Tipo de credencial do compartimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de credencial do compartimento
            </label>
            <div className="flex gap-2 mb-3">
              {(['pin', 'otp', 'token'] as BryCredencialTipo[]).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setCredTipo(tipo)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all uppercase tracking-wide ${
                    credTipo === tipo
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">{credInfo.desc}</p>
            </div>
          </div>

          {/* Valor da credencial (não para OTP) */}
          {credTipo !== 'otp' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {credInfo.label} do compartimento
              </label>
              <div className="relative">
                <input
                  type={showCredValor ? 'text' : 'password'}
                  value={credValor}
                  onChange={(e) => setCredValor(e.target.value)}
                  placeholder={config.bry_credencial_enc
                    ? '••••••• (salvo — preencha para substituir)'
                    : credInfo.placeholder}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none font-mono"
                />
                <button type="button" onClick={() => setShowCredValor(!showCredValor)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCredValor ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {credTipo === 'otp' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Com OTP, cada assinatura exigirá que o operador informe o código de 6 dígitos gerado pelo <strong>App BRy Autenticador</strong> no momento da operação. Não há credencial pré-armazenada.
              </p>
            </div>
          )}

          {/* Botão Testar Conexão */}
          <div className="pt-1">
            <button
              type="button"
              onClick={testarConexao}
              disabled={testeStatus === 'testando' || (!config.assinatura_api_key_enc && !apiToken)}
              className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testeStatus === 'testando'
                ? <Loader2 size={15} className="animate-spin" />
                : testeStatus === 'ok'
                ? <Wifi size={15} className="text-emerald-500" />
                : testeStatus === 'erro'
                ? <WifiOff size={15} className="text-red-500" />
                : <Wifi size={15} />
              }
              {testeStatus === 'testando' ? 'Testando...' : 'Testar conexão com BRy'}
            </button>
            {testeMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1.5 ${
                testeStatus === 'ok' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {testeStatus === 'ok'
                  ? <CheckCircle2 size={13} />
                  : <AlertCircle size={13} />
                }
                {testeMsg}
              </p>
            )}
            {(!config.assinatura_api_key_enc && !apiToken) && (
              <p className="text-xs text-gray-400 mt-1">Salve o API Token primeiro para habilitar o teste.</p>
            )}
          </div>
        </section>
      )}

      {/* ── Configuração genérica (não BRy) ───────────────────────────────── */}
      {provedor !== 'nenhum' && provedor !== 'manual' && provedor !== 'bry' && (
        <section className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Endpoint da API</label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.provedor.com.br/v1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key / Token</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.assinatura_api_key_enc ? '••••••••••••• (salvo)' : 'Cole a chave aqui'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm outline-none font-mono"
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </section>
      )}

      {provedor === 'manual' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <Shield size={16} className="shrink-0 mt-0.5" />
          <p>No modo manual, a assinatura digital é feita externamente. O sistema gerará os XMLs mas não os enviará para assinar automaticamente.</p>
        </div>
      )}

      {provedor === 'nenhum' && (
        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm">
          <Shield size={16} className="shrink-0 mt-0.5" />
          <p>Nenhum provedor configurado. Os diplomas não poderão ser assinados digitalmente.</p>
        </div>
      )}

      {/* ── TSA — Carimbo de Tempo ────────────────────────────────────────── */}
      <section className="border-t border-gray-100 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-purple-500" />
          <h3 className="font-semibold text-gray-800">TSA — Carimbo de Tempo</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Obrigatório para assinatura XAdES AD-RA (Portaria MEC 554/2019). A BRy oferece TSA próprio — consulte o suporte para as credenciais.
        </p>

        <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL do TSA</label>
            <input
              type="url"
              value={tsaUrl}
              onChange={(e) => setTsaUrl(e.target.value)}
              placeholder="http://tsa.bry.com.br"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuário TSA</label>
              <input
                type="text"
                value={tsaUsuario}
                onChange={(e) => setTsaUsuario(e.target.value)}
                placeholder="usuario@fic.edu.br"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha TSA</label>
              <div className="relative">
                <input
                  type={showTsaSenha ? 'text' : 'password'}
                  value={tsaSenha}
                  onChange={(e) => setTsaSenha(e.target.value)}
                  placeholder={config.tsa_senha_enc ? '••••••• (salva)' : 'Senha do TSA'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm outline-none"
                />
                <button type="button" onClick={() => setShowTsaSenha(!showTsaSenha)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showTsaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Repositório Público ───────────────────────────────────────────── */}
      <section className="border-t border-gray-100 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Server size={18} className="text-emerald-500" />
          <h3 className="font-semibold text-gray-800">Repositório Público de Diplomas</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          URL base HTTPS onde os XMLs serão publicados para consulta pública, conforme exigido pelo MEC.
        </p>
        <input
          type="url"
          value={repositorioUrl}
          onChange={(e) => setRepositorioUrl(e.target.value)}
          placeholder="https://diplomas.fic.edu.br"
          className="w-full max-w-lg px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Exemplo de acesso público: <code className="font-mono">{repositorioUrl || 'https://diplomas.fic.edu.br'}/{'{'}{'}'}codigo-diploma{'}'}.xml</code>
        </p>
      </section>

      {/* ── Salvar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Assinatura Digital'}
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
