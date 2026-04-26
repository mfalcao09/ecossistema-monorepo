"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import type {
  RespostaAuditoria,
  GrupoAuditoria,
  IssueAuditoria,
  AcaoCorrecao,
} from "@/lib/auditoria/tipos";

// ── Ícones/cor por status ───────────────────────────────────────────────────

function BadgeGrupo({ grupo }: { grupo: GrupoAuditoria }) {
  const { status } = grupo;
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 size={9} /> {grupo.nome}
      </span>
    );
  }
  if (status === "com_erros") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle size={9} /> {grupo.nome}
      </span>
    );
  }
  if (status === "com_avisos") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle size={9} /> {grupo.nome}
      </span>
    );
  }
  // sem_dados
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
      <Info size={9} /> {grupo.nome}
    </span>
  );
}

// ── Botão de correção por ação ───────────────────────────────────────────────

function BotaoCorrecao({
  acao,
  sessaoId,
  diplomaId,
  onVerDocumentos,
}: {
  acao: AcaoCorrecao;
  sessaoId?: string | null;
  diplomaId?: string | null;
  onVerDocumentos?: () => void;
}) {
  const base =
    "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors";
  const primary = `${base} text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100`;
  const secondary = `${base} text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100`;

  // Ações de edição levam ao formulário de revisão da extração IA.
  // Sessão 2026-04-25 (Fase 0.6 — fluxo único): a criação manual foi
  // descontinuada. Sem sessaoId (ex.: diplomas legados), botão é ocultado.
  if (
    acao === "editar_diplomado" ||
    acao === "editar_historico" ||
    acao === "preencher_docentes"
  ) {
    if (!sessaoId) return null;

    const label = {
      editar_diplomado: "Editar dados pessoais",
      editar_historico: "Editar histórico / disciplinas",
      preencher_docentes: "Preencher docentes",
    }[acao];

    // Quando temos diplomaId, passa ?from=pipeline pra que o "←" da revisão
    // volte direto pro pipeline em vez de cair na lista de processos.
    const href = diplomaId
      ? `/diploma/processos/novo/revisao/${sessaoId}?from=pipeline&id=${diplomaId}`
      : `/diploma/processos/novo/revisao/${sessaoId}`;

    return (
      <Link href={href} target="_blank" className={primary}>
        <ExternalLink size={9} /> {label}
      </Link>
    );
  }

  switch (acao) {
    case "editar_curso":
      return (
        <Link href="/cadastro/cursos" target="_blank" className={primary}>
          <ExternalLink size={9} /> Editar template do curso
        </Link>
      );
    case "editar_ies":
      return (
        <Link href="/diploma/configuracoes" target="_blank" className={primary}>
          <ExternalLink size={9} /> Configurações IES
        </Link>
      );
    case "adicionar_comprobatorio":
      return onVerDocumentos ? (
        <button onClick={onVerDocumentos} className={secondary}>
          <Users size={9} /> Ver aba Documentos
        </button>
      ) : null;
    default:
      return null;
  }
}

// ── IssueRow ─────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  sessaoId,
  diplomaId,
  onVerDocumentos,
}: {
  issue: IssueAuditoria;
  sessaoId?: string | null;
  diplomaId?: string | null;
  onVerDocumentos?: () => void;
}) {
  const severityColors = {
    critico: "text-red-700 bg-red-50 border-red-100",
    aviso: "text-amber-700 bg-amber-50 border-amber-100",
    info: "text-blue-700 bg-blue-50 border-blue-100",
  };
  const severityIcon = {
    critico: (
      <XCircle size={11} className="flex-shrink-0 mt-0.5 text-red-500" />
    ),
    aviso: (
      <AlertTriangle
        size={11}
        className="flex-shrink-0 mt-0.5 text-amber-500"
      />
    ),
    info: <Info size={11} className="flex-shrink-0 mt-0.5 text-blue-500" />,
  };

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[11px] ${severityColors[issue.severidade]}`}
    >
      {severityIcon[issue.severidade]}
      <div className="flex-1 min-w-0">
        <p>{issue.mensagem}</p>
        <div className="mt-1">
          <BotaoCorrecao
            acao={issue.acao}
            sessaoId={sessaoId}
            diplomaId={diplomaId}
            onVerDocumentos={onVerDocumentos}
          />
        </div>
      </div>
    </div>
  );
}

// ── GrupoExpandível ───────────────────────────────────────────────────────────

function GrupoExpandivel({
  grupo,
  sessaoId,
  diplomaId,
  onVerDocumentos,
}: {
  grupo: GrupoAuditoria;
  sessaoId?: string | null;
  diplomaId?: string | null;
  onVerDocumentos?: () => void;
}) {
  const [aberto, setAberto] = useState(grupo.status === "com_erros");

  if (grupo.issues.length === 0) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BadgeGrupo grupo={grupo} />
          <span className="text-[10px] text-gray-500">
            {grupo.issues.length}{" "}
            {grupo.issues.length === 1 ? "problema" : "problemas"}
          </span>
        </div>
        {aberto ? (
          <ChevronUp size={12} className="text-gray-400" />
        ) : (
          <ChevronDown size={12} className="text-gray-400" />
        )}
      </button>

      {aberto && (
        <div className="px-3 pb-3 pt-2 space-y-2 bg-white">
          {grupo.issues.map((issue, idx) => (
            <IssueRow
              key={`${issue.campo}-${idx}`}
              issue={issue}
              sessaoId={sessaoId}
              diplomaId={diplomaId}
              onVerDocumentos={onVerDocumentos}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PainelAuditoria (componente principal) ────────────────────────────────────

interface PainelAuditoriaProps {
  diplomaId: string;
  sessaoId?: string | null;
  auditoria: RespostaAuditoria | null;
  carregando: boolean;
  erro: string | null;
  onAuditar: (forcar?: boolean) => void;
  onVerDocumentos?: () => void;
}

export function PainelAuditoria({
  diplomaId,
  sessaoId,
  auditoria,
  carregando,
  erro,
  onAuditar,
  onVerDocumentos,
}: PainelAuditoriaProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  return (
    <div
      className={`p-3 rounded-xl border-2 transition-all ${
        auditoria
          ? auditoria.pode_gerar_xml
            ? "border-emerald-200 bg-emerald-50/20"
            : "border-red-200 bg-red-50/20"
          : "border-gray-200 bg-gray-50/30"
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              auditoria
                ? auditoria.pode_gerar_xml
                  ? "bg-emerald-500"
                  : "bg-red-500"
                : "bg-gray-300"
            }`}
          >
            {auditoria ? (
              auditoria.pode_gerar_xml ? (
                <Shield size={13} className="text-white" />
              ) : (
                <ShieldAlert size={13} className="text-white" />
              )
            ) : (
              <Shield size={13} className="text-white" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800">
              Auditar Requisitos XSD
            </p>
            <p className="text-[10px] text-gray-400">
              {auditoria
                ? auditoria.pode_gerar_xml
                  ? "Todos os requisitos críticos preenchidos ✓"
                  : `${auditoria.totais.criticos} erro(s) crítico(s) encontrado(s)`
                : "Verifica campos obrigatórios antes de gerar o XML"}
            </p>
          </div>
        </div>

        <button
          onClick={() => onAuditar(true)}
          disabled={carregando}
          className="flex-shrink-0 px-3 py-1.5 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {carregando ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {carregando ? "Auditando..." : auditoria ? "Re-auditar" : "Auditar"}
        </button>
      </div>

      {/* Erro de fetch */}
      {erro && (
        <p className="mt-2 text-[11px] text-red-600 flex items-center gap-1">
          <XCircle size={11} /> {erro}
        </p>
      )}

      {/* Resumo — badges por grupo */}
      {auditoria && (
        <div className="mt-3 space-y-2">
          {/* Badges compactos */}
          <div className="flex flex-wrap gap-1.5">
            {auditoria.grupos.map((g) => (
              <BadgeGrupo key={g.id} grupo={g} />
            ))}
          </div>

          {/* Contador de totais */}
          {auditoria.totais.total > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              {auditoria.totais.criticos > 0 && (
                <span className="text-red-600 font-semibold">
                  {auditoria.totais.criticos} crítico
                  {auditoria.totais.criticos !== 1 ? "s" : ""}
                </span>
              )}
              {auditoria.totais.avisos > 0 && (
                <span className="text-amber-600">
                  {auditoria.totais.avisos} aviso
                  {auditoria.totais.avisos !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Botão "ver detalhes" */}
          {auditoria.totais.total > 0 && (
            <button
              onClick={() => setDetalhesAbertos(!detalhesAbertos)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 font-medium"
            >
              {detalhesAbertos ? (
                <ChevronUp size={10} />
              ) : (
                <ChevronDown size={10} />
              )}
              {detalhesAbertos ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
          )}

          {/* Grupos expandíveis */}
          {detalhesAbertos && (
            <div className="space-y-2 mt-1">
              {auditoria.grupos.map((grupo) => (
                <GrupoExpandivel
                  key={grupo.id}
                  grupo={grupo}
                  sessaoId={sessaoId}
                  diplomaId={diplomaId}
                  onVerDocumentos={onVerDocumentos}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
