"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus,
  Radio,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  Search,
  Loader2,
} from "lucide-react";
import { CANAIS, type TipoCanal } from "./_components/canais-catalogo";
import {
  AddChannelDialog,
  type NovoCanalPayload,
} from "./_components/AddChannelDialog";

type StatusCanal = "ativo" | "desconectado" | "aguardando" | "demo";

interface CanalConectado {
  id: string;
  tipo: TipoCanal;
  nome: string;
  identificador: string;
  cor: string;
  ambiente: "demo" | "producao";
  status: StatusCanal;
  ultimaAtividade: string;
  receberMensagens: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "nunca";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function mapApiCanal(item: Record<string, unknown>): CanalConectado {
  return {
    id: item.id as string,
    tipo: item.tipo as TipoCanal,
    nome: item.nome as string,
    identificador: (item.identificador as string) ?? "Aguardando conexão",
    cor: item.cor as string,
    ambiente: item.ambiente as "demo" | "producao",
    status: item.status as StatusCanal,
    ultimaAtividade: formatRelativeTime(
      item.ultima_atividade_at as string | null,
    ),
    receberMensagens: item.receber_mensagens as boolean,
  };
}

// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  StatusCanal,
  { label: string; cor: string; bg: string; ring: string }
> = {
  ativo: {
    label: "Ativo",
    cor: "text-green-700",
    bg: "bg-green-100",
    ring: "ring-green-200",
  },
  desconectado: {
    label: "Desconectado",
    cor: "text-red-700",
    bg: "bg-red-100",
    ring: "ring-red-200",
  },
  aguardando: {
    label: "Aguardando aprovação",
    cor: "text-amber-700",
    bg: "bg-amber-100",
    ring: "ring-amber-200",
  },
  demo: {
    label: "Demonstração",
    cor: "text-slate-700",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CanaisPage() {
  const [canais, setCanais] = useState<CanalConectado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtro, setFiltro] = useState<TipoCanal | "todos">("todos");
  const [busca, setBusca] = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchCanais = useCallback(async () => {
    try {
      const res = await fetch("/api/atendimento/canais");
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>[];
      setCanais(data.map(mapApiCanal));
    } catch (err) {
      console.error("[CanaisPage:fetch]", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCanais();
  }, [fetchCanais]);

  // ── Contadores ───────────────────────────────────────────────────────────
  const contadores = useMemo(
    () => ({
      total: canais.length,
      ativos: canais.filter((c) => c.status === "ativo").length,
      problema: canais.filter(
        (c) => c.status === "desconectado" || c.status === "aguardando",
      ).length,
    }),
    [canais],
  );

  // ── Filtro ───────────────────────────────────────────────────────────────
  const canaisFiltrados = useMemo(() => {
    return canais.filter((c) => {
      if (filtro !== "todos" && c.tipo !== filtro) return false;
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()))
        return false;
      return true;
    });
  }, [canais, filtro, busca]);

  // ── Criar canal ──────────────────────────────────────────────────────────
  async function handleNovoCanal(payload: NovoCanalPayload) {
    setIsSaving(true);
    try {
      // 1. Criar canal (+ inbox operacional para whatsapp-cloud em produção)
      const res = await fetch("/api/atendimento/canais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const canalData = (await res.json()) as Record<string, unknown>;

      // 2. Embedded Signup: trocar code → token permanente e ativar canal
      if (
        payload.tipo === "whatsapp-cloud" &&
        payload.config["embedded_code"]
      ) {
        await fetch(
          `/api/atendimento/canais/${canalData.id as string}/connect-meta`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: payload.config["embedded_code"],
              waba_id: payload.config["waba_id"],
              phone_number_id: payload.config["phone_number_id"],
            }),
          },
        );
      }

      // 3. Recarregar lista
      await fetchCanais();
    } catch (err) {
      console.error("[handleNovoCanal]", err);
      // TODO: toast de erro
    } finally {
      setIsSaving(false);
    }
  }

  // ── Toggle receber mensagens (optimistic — PATCH a implementar) ──────────
  function toggleReceber(id: string) {
    setCanais((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, receberMensagens: !c.receberMensagens } : c,
      ),
    );
    // TODO: PATCH /api/atendimento/canais/[id] com { receber_mensagens }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Canais de Atendimento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure por onde sua equipe recebe mensagens dos alunos e
            candidatos.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Adicionar canal
        </button>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Contador
          icone={Radio}
          label="Total de canais"
          valor={contadores.total}
          cor="text-blue-700"
          bg="bg-blue-50"
        />
        <Contador
          icone={CheckCircle2}
          label="Ativos"
          valor={contadores.ativos}
          cor="text-green-700"
          bg="bg-green-50"
        />
        <Contador
          icone={AlertTriangle}
          label="Com problema"
          valor={contadores.problema}
          cor="text-amber-700"
          bg="bg-amber-50"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
      )}

      {/* Toolbar + lista */}
      {!isLoading && (
        <>
          {canais.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
              <select
                value={filtro}
                onChange={(e) =>
                  setFiltro(e.target.value as TipoCanal | "todos")
                }
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              >
                <option value="todos">Todos os tipos</option>
                {CANAIS.filter((c) => c.status === "disponivel").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canais.length === 0 ? (
            <EmptyState onAdd={() => setDialogOpen(true)} />
          ) : canaisFiltrados.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">
              Nenhum canal encontrado com esses filtros.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {canaisFiltrados.map((c) => (
                <CardCanalConectado
                  key={c.id}
                  canal={c}
                  onToggle={() => toggleReceber(c.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AddChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(payload) => void handleNovoCanal(payload)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Contador({
  icone: Icone,
  label,
  valor,
  cor,
  bg,
}: {
  icone: typeof Radio;
  label: string;
  valor: number;
  cor: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
      <div
        className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}
      >
        <Icone size={18} className={cor} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{valor}</p>
      </div>
    </div>
  );
}

function CardCanalConectado({
  canal,
  onToggle,
}: {
  canal: CanalConectado;
  onToggle: () => void;
}) {
  const cat = CANAIS.find((c) => c.id === canal.tipo);
  const Icone = cat?.icone ?? Radio;
  const status = STATUS_CONFIG[canal.status];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: canal.cor }}
        >
          <Icone size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {canal.nome}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {canal.identificador}
          </p>
        </div>
        <button className="p-1 rounded hover:bg-slate-100 text-slate-400">
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.cor} ring-1 ${status.ring}`}
        >
          {status.label}
        </span>
        <span className="text-[10px] text-slate-400">
          {canal.ultimaAtividade}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-600">Receber mensagens</span>
        <button
          type="button"
          onClick={onToggle}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            canal.receberMensagens ? "bg-green-600" : "bg-slate-300"
          }`}
          aria-pressed={canal.receberMensagens}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              canal.receberMensagens ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
        <Radio className="text-blue-600" size={26} />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Nenhum canal conectado ainda
      </h3>
      <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
        Conecte WhatsApp, Instagram, e-mail e outros canais para começar a
        centralizar o atendimento da FIC.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
      >
        <Plus size={16} />
        Adicionar primeiro canal
      </button>
    </div>
  );
}
