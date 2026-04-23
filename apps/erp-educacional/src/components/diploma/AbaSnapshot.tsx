"use client"

/**
 * Aba Snapshot — Diploma Digital
 *
 * Exibe e permite editar o snapshot imutável da extração enquanto está em
 * rascunho. Após o usuário clicar "Confirmar e liberar assinaturas", o
 * snapshot trava e os 2 fluxos BRy (XML XAdES + PDF HUB Signer) podem ser
 * iniciados nas outras abas.
 *
 * Fase 1 do plano Snapshot Imutável (2026-04-22).
 */

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { fetchSeguro } from "@/lib/security/fetch-seguro"

// ═══════════════════════════════════════════════════════════════════════════
// Tipos (espelho do backend)
// ═══════════════════════════════════════════════════════════════════════════

interface EdicaoAuditoria {
  id: string
  usuario_id: string
  justificativa: string
  campos_alterados: Record<string, { antes: unknown; depois: unknown }>
  versao_antes: number
  versao_depois: number
  created_at: string
}

interface SnapshotResponse {
  diploma_id: string
  status_diploma: string
  snapshot: {
    versao: number
    snapshot_id?: string
    extracao_sessao_id?: string | null
    gerado_em: string
    diplomado: Record<string, unknown>
    curso: Record<string, unknown>
    dados_academicos: Record<string, unknown>
    disciplinas: Array<Record<string, unknown>>
    atividades_complementares: Array<Record<string, unknown>>
    estagios: Array<Record<string, unknown>>
    assinantes: Array<Record<string, unknown>>
  } | null
  versao: number | null
  gerado_em: string | null
  travado: boolean
  travado_em: string | null
  travado_por: string | null
  edicoes: EdicaoAuditoria[]
  pode_editar: boolean
}

// Campos disponíveis para edição simples (Fase 1). Mais campos podem ser
// habilitados depois sem mudar o backend (ele aceita qualquer path válido).
const CAMPOS_EDITAVEIS: Array<{ path: string; label: string; grupo: string }> = [
  { path: "diplomado.nome", label: "Nome", grupo: "Diplomado" },
  { path: "diplomado.nome_social", label: "Nome social", grupo: "Diplomado" },
  { path: "diplomado.cpf", label: "CPF", grupo: "Diplomado" },
  { path: "diplomado.rg_numero", label: "RG número", grupo: "Diplomado" },
  { path: "diplomado.rg_orgao", label: "RG órgão", grupo: "Diplomado" },
  { path: "diplomado.rg_uf", label: "RG UF", grupo: "Diplomado" },
  { path: "diplomado.data_nascimento", label: "Data de nascimento", grupo: "Diplomado" },
  { path: "diplomado.nacionalidade", label: "Nacionalidade", grupo: "Diplomado" },
  { path: "diplomado.naturalidade_municipio", label: "Naturalidade (município)", grupo: "Diplomado" },
  { path: "diplomado.naturalidade_uf", label: "Naturalidade (UF)", grupo: "Diplomado" },
  { path: "curso.nome", label: "Curso", grupo: "Curso" },
  { path: "curso.grau", label: "Grau", grupo: "Curso" },
  { path: "curso.titulo_conferido", label: "Título conferido", grupo: "Curso" },
  { path: "curso.modalidade", label: "Modalidade", grupo: "Curso" },
  { path: "dados_academicos.turno", label: "Turno", grupo: "Acadêmicos" },
  { path: "dados_academicos.data_ingresso", label: "Data de ingresso", grupo: "Acadêmicos" },
  { path: "dados_academicos.data_conclusao", label: "Data de conclusão", grupo: "Acadêmicos" },
  { path: "dados_academicos.data_colacao_grau", label: "Data de colação", grupo: "Acadêmicos" },
  { path: "dados_academicos.forma_acesso", label: "Forma de acesso", grupo: "Acadêmicos" },
]

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function AbaSnapshot({
  diplomaId,
  onAtualizar,
}: {
  diplomaId: string
  onAtualizar?: () => void
}) {
  const [data, setData] = useState<SnapshotResponse | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")
  const [viewerAberto, setViewerAberto] = useState(false)
  const [editorAberto, setEditorAberto] = useState(false)
  const [travandoEmProgresso, setTravando] = useState(false)
  const [confirmandoTrava, setConfirmandoTrava] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro("")
    try {
      const res = await fetch(`/api/diplomas/${diplomaId}/snapshot`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        )
      }
      const json: SnapshotResponse = await res.json()
      setData(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar snapshot")
    } finally {
      setCarregando(false)
    }
  }, [diplomaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const travar = async () => {
    setTravando(true)
    setErro("")
    setSucesso("")
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/snapshot/travar`,
        { method: "POST" }
      )
      const body = await res.json()
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? "Erro ao travar snapshot"
        )
      }
      setSucesso(
        "Snapshot travado com sucesso. Os fluxos de assinatura (XML e PDF) podem ser iniciados."
      )
      setConfirmandoTrava(false)
      await carregar()
      onAtualizar?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao travar snapshot")
    } finally {
      setTravando(false)
    }
  }

  if (carregando) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-center text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        Carregando snapshot…
      </div>
    )
  }

  if (erro && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3 text-sm text-red-700">
        <AlertCircle size={16} />
        <span className="flex-1">{erro}</span>
        <button
          onClick={carregar}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-red-300 rounded hover:bg-red-100"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    )
  }

  // Diploma legado (sem snapshot)
  if (!data?.snapshot) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertCircle size={16} /> Diploma sem snapshot
        </div>
        <p className="leading-relaxed">
          Este diploma não possui dados consolidados em formato snapshot. Isso
          pode acontecer em diplomas legados (migrados antes da implementação
          do snapshot imutável) ou em diplomas criados antes da Fase 0.6.
        </p>
        <p className="mt-2 leading-relaxed">
          O fluxo atual continua funcional — os artefatos serão gerados a
          partir das tabelas normalizadas como no fluxo legado.
        </p>
      </div>
    )
  }

  const snap = data.snapshot
  const travado = data.travado
  const podeEditar = data.pode_editar

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {sucesso && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={15} /> {sucesso}
          <button
            onClick={() => setSucesso("")}
            className="ml-auto text-emerald-400 hover:text-emerald-600"
          >
            <X size={13} />
          </button>
        </div>
      )}
      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} /> {erro}
          <button
            onClick={() => setErro("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Status card */}
      <div
        className={`rounded-2xl border p-5 ${
          travado
            ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
            : "bg-gradient-to-br from-amber-50 to-white border-amber-200"
        }`}
      >
        <div className="flex items-start gap-3">
          {travado ? (
            <Lock size={18} className="text-emerald-600 mt-0.5" />
          ) : (
            <LockOpen size={18} className="text-amber-600 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-bold ${
                  travado ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                Snapshot {travado ? "travado" : "em rascunho"} · versão {data.versao}
              </h3>
              <span className="text-xs text-gray-400">
                ({snap.disciplinas.length} disciplinas)
              </span>
            </div>
            <p
              className={`text-xs mt-1 ${
                travado ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {travado ? (
                <>
                  Travado em {formatDate(data.travado_em)}. Este é o documento
                  oficial imutável — fontes de dados para geração de XMLs e PDFs.
                </>
              ) : (
                <>
                  Edição permitida com justificativa auditada. Ao confirmar,
                  os fluxos de assinatura (XML e PDF) serão liberados.
                </>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Gerado em {formatDate(data.gerado_em ?? snap.gerado_em)} ·{" "}
              {data.edicoes.length > 0
                ? `${data.edicoes.length} edição(ões) registradas`
                : "Nenhuma edição"}
            </p>
          </div>
        </div>
      </div>

      {/* Resumo dos dados principais */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900">Resumo do snapshot</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewerAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Eye size={12} /> Ver JSON completo
            </button>
            {podeEditar && (
              <button
                onClick={() => setEditorAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-violet-600 rounded-lg hover:bg-violet-700"
              >
                <Edit3 size={12} /> Editar campo
              </button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <ResumoCampo label="Nome" valor={str(snap.diplomado.nome)} />
          <ResumoCampo label="CPF" valor={str(snap.diplomado.cpf)} />
          <ResumoCampo
            label="RG"
            valor={[snap.diplomado.rg_numero, snap.diplomado.rg_orgao, snap.diplomado.rg_uf]
              .filter(Boolean)
              .join(" ")}
          />
          <ResumoCampo
            label="Nascimento"
            valor={formatDate(str(snap.diplomado.data_nascimento))}
          />
          <ResumoCampo label="Curso" valor={str(snap.curso.nome)} />
          <ResumoCampo label="Grau" valor={str(snap.curso.grau)} />
          <ResumoCampo label="Modalidade" valor={str(snap.curso.modalidade)} />
          <ResumoCampo
            label="Ingresso"
            valor={formatDate(str(snap.dados_academicos.data_ingresso))}
          />
          <ResumoCampo
            label="Conclusão"
            valor={formatDate(str(snap.dados_academicos.data_conclusao))}
          />
          <ResumoCampo
            label="Colação"
            valor={formatDate(str(snap.dados_academicos.data_colacao_grau))}
          />
        </dl>
      </div>

      {/* Botão confirmar e liberar (se rascunho) */}
      {podeEditar && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-violet-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-violet-900">
                Confirmar e liberar assinaturas
              </h4>
              <p className="text-xs text-violet-800 mt-1 mb-3 leading-relaxed">
                Ao confirmar, o snapshot trava permanentemente. Os XMLs e PDFs
                serão gerados a partir desses dados e os dois fluxos BRy ficarão
                disponíveis. Só avance quando todos os dados estiverem corretos.
              </p>
              {!confirmandoTrava ? (
                <button
                  onClick={() => setConfirmandoTrava(true)}
                  disabled={travandoEmProgresso}
                  className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  Confirmar e liberar assinaturas
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={travar}
                    disabled={travandoEmProgresso}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {travandoEmProgresso ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Travando…
                      </>
                    ) : (
                      <>
                        <Lock size={12} /> Sim, travar permanentemente
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmandoTrava(false)}
                    disabled={travandoEmProgresso}
                    className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico de edições */}
      {data.edicoes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardList size={14} /> Histórico de edições ({data.edicoes.length})
          </h4>
          <ul className="space-y-3">
            {data.edicoes.map((ed) => (
              <li
                key={ed.id}
                className="border-l-2 border-violet-300 pl-3 py-1"
              >
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Clock size={11} />
                  {formatDate(ed.created_at)} · v{ed.versao_antes} → v{ed.versao_depois}
                </div>
                <p className="text-sm text-gray-700">{ed.justificativa}</p>
                <div className="mt-1 text-xs text-gray-500">
                  Campos alterados:{" "}
                  <span className="font-mono">
                    {Object.keys(ed.campos_alterados).join(", ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal: Viewer JSON */}
      {viewerAberto && (
        <JSONViewerModal data={snap} onClose={() => setViewerAberto(false)} />
      )}

      {/* Modal: Editor */}
      {editorAberto && data.snapshot && (
        <EditorModal
          diplomaId={diplomaId}
          snapshot={snap}
          onClose={() => setEditorAberto(false)}
          onSalvou={async () => {
            setEditorAberto(false)
            setSucesso("Edição registrada com sucesso.")
            await carregar()
            onAtualizar?.()
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ═══════════════════════════════════════════════════════════════════════════

function ResumoCampo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">
        {valor && valor.trim() !== "" ? valor : <span className="text-gray-400">—</span>}
      </dd>
    </div>
  )
}

function JSONViewerModal({
  data,
  onClose,
}: {
  data: unknown
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-4xl h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-sm font-bold text-gray-900">
            Snapshot completo (JSON)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-5 bg-gray-50 text-xs font-mono text-gray-800 leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function EditorModal({
  diplomaId,
  snapshot,
  onClose,
  onSalvou,
}: {
  diplomaId: string
  snapshot: SnapshotResponse["snapshot"]
  onClose: () => void
  onSalvou: () => void
}) {
  const [path, setPath] = useState<string>(CAMPOS_EDITAVEIS[0].path)
  const [valor, setValor] = useState<string>("")
  const [justificativa, setJustificativa] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")

  // Pré-popula o valor atual quando muda o campo
  useEffect(() => {
    if (!snapshot) return
    const atual = getByPath(snapshot, path)
    setValor(atual == null ? "" : String(atual))
  }, [path, snapshot])

  const salvar = async () => {
    setErro("")
    if (justificativa.trim().length < 20) {
      setErro("Justificativa precisa ter pelo menos 20 caracteres")
      return
    }
    setSalvando(true)
    try {
      const res = await fetchSeguro(`/api/diplomas/${diplomaId}/snapshot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patches: { [path]: valor.trim() === "" ? null : valor.trim() },
          justificativa: justificativa.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? "Erro ao salvar edição"
        )
      }
      onSalvou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar edição")
    } finally {
      setSalvando(false)
    }
  }

  const campoAtual = CAMPOS_EDITAVEIS.find((c) => c.path === path)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-sm font-bold text-gray-900">Editar campo do snapshot</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Campo
            </label>
            <select
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            >
              {gruposDeCampos().map((grupo) => (
                <optgroup key={grupo.nome} label={grupo.nome}>
                  {grupo.campos.map((c) => (
                    <option key={c.path} value={c.path}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Novo valor{" "}
              <span className="font-normal text-gray-400">({campoAtual?.label})</span>
            </label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              placeholder="Deixe vazio para limpar"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Justificativa <span className="text-red-500">*</span>{" "}
              <span className="font-normal text-gray-400">(mín. 20 caracteres)</span>
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              placeholder="Ex: Correção de digitação confirmada com o RG original"
            />
            <p className="text-xs text-gray-400 mt-1">
              {justificativa.length}/20 caracteres mínimos
            </p>
          </div>

          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {erro}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || justificativa.trim().length < 20}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Salvando…
              </>
            ) : (
              "Salvar edição"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function gruposDeCampos(): Array<{ nome: string; campos: typeof CAMPOS_EDITAVEIS }> {
  const map = new Map<string, typeof CAMPOS_EDITAVEIS>()
  for (const c of CAMPOS_EDITAVEIS) {
    const arr = map.get(c.grupo) ?? []
    arr.push(c)
    map.set(c.grupo, arr)
  }
  return Array.from(map.entries()).map(([nome, campos]) => ({ nome, campos }))
}

function getByPath(obj: unknown, path: string): unknown {
  const tokens = path.split(".").flatMap((t) => {
    const m = t.match(/^([^\[]+)(?:\[(\d+)\])?$/)
    if (!m) return [t]
    return m[2] !== undefined ? [m[1], Number(m[2])] : [m[1]]
  })
  let ref: any = obj
  for (const t of tokens) {
    if (ref == null) return null
    ref = ref[t]
  }
  return ref
}

function str(v: unknown): string {
  if (v == null) return ""
  return String(v)
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—"
  // ISO-8601 completo ou só data
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
