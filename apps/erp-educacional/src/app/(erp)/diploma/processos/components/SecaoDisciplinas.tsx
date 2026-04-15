"use client";

import { BookText, Trash2, Download, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, ShieldAlert, Pencil, Check } from "lucide-react";
import { Secao } from "./ui-helpers";
import type { EstadoRevisao, Disciplina } from "../types";
import { useState, useRef, useMemo } from "react";

interface SecaoDisciplinasProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

const DISCIPLINA_TEMPLATE_CSV = `Código,Disciplina,Situação,Período,CH,Nota,Conceito,Docente,Titulação Docente
EX001,Exemplo Disciplina,Aprovado,1,60,8.5,A,Prof. João,Doutor`;

interface GrupoPeriodo {
  periodo: string;       // chave numérica normalizada (ex: "7", "8")
  label: string;         // label padrão gerado (ex: "7º Período")
  disciplinas: Disciplina[];
  chTotal: number;
  pendentes: number;
}

// ── Normalizar período ─────────────────────────────────────────────────────
// Extrai o número de qualquer formato:
//   "7º Período"     → "7"
//   "8º SEMESTRE"    → "8"
//   "8"              → "8"
//   "Período 7"      → "7"
//   "7o Semestre"    → "7"
//   "sem-periodo"    → "sem-periodo"
function normalizarPeriodo(raw: string): string {
  if (!raw || raw === "sem-periodo") return "sem-periodo";
  const trimmed = raw.trim();
  // Se já é um número puro, retornar direto
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Extrair primeiro número da string
  const match = trimmed.match(/(\d+)/);
  return match ? match[1] : trimmed;
}

export function SecaoDisciplinas({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly = false,
}: SecaoDisciplinasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<"agrupado" | "lista">("agrupado");
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set(["__all__"]));

  // Labels personalizados por período (editáveis pelo usuário)
  const [labelsPersonalizados, setLabelsPersonalizados] = useState<Record<string, string>>({});
  // Controle de edição inline do label
  const [editandoLabel, setEditandoLabel] = useState<string | null>(null);
  const [labelTemp, setLabelTemp] = useState("");

  // ── Agrupar disciplinas por período (normalizado) ──
  const grupos: GrupoPeriodo[] = useMemo(() => {
    const map = new Map<string, Disciplina[]>();
    for (const disc of revisao.disciplinas) {
      const raw = disc.periodo?.trim() || "sem-periodo";
      const key = normalizarPeriodo(raw);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(disc);
    }

    // Ordenar por período numérico
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      const na = parseInt(a) || 999;
      const nb = parseInt(b) || 999;
      return na - nb;
    });

    return sorted.map(([periodo, disciplinas]) => {
      const chTotal = disciplinas.reduce(
        (sum, d) => sum + (parseInt(d.carga_horaria) || 0),
        0
      );
      const pendentes = disciplinas.filter(
        (d) => !d.nome_docente || (d.nome_docente && !d.titulacao_docente)
      ).length;
      // Label: personalizado > padrão
      const label =
        labelsPersonalizados[periodo]
          ? labelsPersonalizados[periodo]
          : periodo === "sem-periodo"
            ? "Sem Período Definido"
            : `${periodo}º Período`;
      return { periodo, label, disciplinas, chTotal, pendentes };
    });
  }, [revisao.disciplinas, labelsPersonalizados]);

  // ── Salvar label editado ──
  const salvarLabel = (periodo: string) => {
    const novoLabel = labelTemp.trim();
    if (novoLabel) {
      setLabelsPersonalizados((prev) => ({ ...prev, [periodo]: novoLabel }));
    }
    setEditandoLabel(null);
    setLabelTemp("");
  };

  // ── Normalizar períodos das disciplinas (atualizar o campo para número puro) ──
  const normalizarTodosPeriodos = () => {
    const novas = revisao.disciplinas.map((d) => ({
      ...d,
      periodo: normalizarPeriodo(d.periodo?.trim() || ""),
    }));
    setRevisao({ ...revisao, disciplinas: novas });
  };

  const toggleGrupo = (periodo: string) => {
    setGruposAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(periodo)) next.delete(periodo);
      else next.add(periodo);
      return next;
    });
  };

  const expandirTodos = () => {
    setGruposAbertos(new Set(grupos.map((g) => g.periodo)));
  };

  const recolherTodos = () => {
    setGruposAbertos(new Set());
  };

  const handleAdd = () => {
    const newDisciplina: Disciplina = {
      id: `disc-${Date.now()}`,
      codigo: "",
      nome: "",
      situacao: "",
      periodo: "",
      carga_horaria: "",
      nota: "",
      conceito: "",
      nome_docente: "",
      titulacao_docente: "",
    };
    setRevisao({
      ...revisao,
      disciplinas: [...revisao.disciplinas, newDisciplina],
    });
  };

  const handleRemove = (id: string) => {
    setRevisao({
      ...revisao,
      disciplinas: revisao.disciplinas.filter((d) => d.id !== id),
    });
  };

  const handleChange = (id: string, field: string, value: string) => {
    setRevisao({
      ...revisao,
      disciplinas: revisao.disciplinas.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    });
  };

  const handleClear = () => {
    if (confirm("Deseja limpar todas as disciplinas?")) {
      setRevisao({ ...revisao, disciplinas: [] });
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.trim().split("\n");
        if (lines.length < 2) return;

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const newDisciplinas: Disciplina[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());
          if (values.length < 2) continue;

          const disc: Disciplina = {
            id: `disc-${Date.now()}-${i}`,
            codigo: values[headers.indexOf("código")] || "",
            nome: values[headers.indexOf("disciplina")] || "",
            situacao: values[headers.indexOf("situação")] || "",
            periodo: values[headers.indexOf("período")] || "",
            carga_horaria: values[headers.indexOf("ch")] || "",
            nota: values[headers.indexOf("nota")] || "",
            conceito: values[headers.indexOf("conceito")] || "",
            nome_docente: values[headers.indexOf("docente")] || "",
            titulacao_docente: values[headers.indexOf("titulação docente")] || "",
          };
          newDisciplinas.push(disc);
        }

        setRevisao({
          ...revisao,
          disciplinas: [...revisao.disciplinas, ...newDisciplinas],
        });
      } catch (err) {
        alert("Erro ao importar CSV. Verifique o formato.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(DISCIPLINA_TEMPLATE_CSV)
    );
    element.setAttribute("download", "disciplinas-template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const totalPendentes = revisao.disciplinas.filter(
    (d) => !d.nome_docente || (d.nome_docente && !d.titulacao_docente)
  ).length;

  const totalVerificados = revisao.disciplinas.filter(
    (d) => d.docente_verificado === true
  ).length;

  const chTotalGeral = revisao.disciplinas.reduce(
    (sum, d) => sum + (parseInt(d.carga_horaria) || 0),
    0
  );

  // ── Renderizar linha da tabela ──
  const renderRow = (disc: Disciplina) => {
    const verificado = disc.docente_verificado === true;
    const semDocente = !disc.nome_docente;
    const temPendente = disc.nome_docente && !disc.titulacao_docente;
    return (
      <tr key={disc.id} className="border-b hover:bg-gray-50">
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.codigo}
            onChange={(e) => handleChange(disc.id, "codigo", e.target.value)}
            readOnly={readOnly}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.nome}
            onChange={(e) => handleChange(disc.id, "nome", e.target.value)}
            readOnly={readOnly}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.situacao}
            onChange={(e) => handleChange(disc.id, "situacao", e.target.value)}
            readOnly={readOnly}
            placeholder="Aprovado"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.periodo}
            onChange={(e) => handleChange(disc.id, "periodo", e.target.value)}
            readOnly={readOnly}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.carga_horaria}
            onChange={(e) => handleChange(disc.id, "carga_horaria", e.target.value)}
            readOnly={readOnly}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.nota}
            onChange={(e) => handleChange(disc.id, "nota", e.target.value)}
            readOnly={readOnly}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="text"
            value={disc.conceito}
            onChange={(e) => handleChange(disc.id, "conceito", e.target.value)}
            readOnly={readOnly}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
          />
        </td>
        <td className={`px-2 py-1.5 ${semDocente ? "bg-amber-50" : verificado ? "bg-emerald-50" : ""}`}>
          <div className="flex items-center gap-1">
            {verificado && <span title="Verificado na lista de professores"><ShieldCheck size={12} className="text-emerald-600 shrink-0" /></span>}
            {semDocente && <span title="Não encontrado na lista de professores"><ShieldAlert size={12} className="text-amber-500 shrink-0" /></span>}
            <input
              type="text"
              value={disc.nome_docente}
              onChange={(e) => handleChange(disc.id, "nome_docente", e.target.value)}
              readOnly={readOnly}
              className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                semDocente ? "border-amber-400 bg-amber-100/50" : verificado ? "border-emerald-300 bg-emerald-50" : "border-gray-300"
              }`}
              placeholder={semDocente ? "Pendente — preencher manualmente" : ""}
            />
          </div>
        </td>
        <td className={`px-2 py-1.5 ${temPendente ? "bg-amber-50" : verificado && disc.titulacao_docente ? "bg-emerald-50" : ""}`}>
          <input
            type="text"
            value={disc.titulacao_docente || ""}
            onChange={(e) => handleChange(disc.id, "titulacao_docente", e.target.value)}
            readOnly={readOnly}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              temPendente ? "border-amber-400 bg-amber-100/50" : verificado && disc.titulacao_docente ? "border-emerald-300 bg-emerald-50" : "border-gray-300"
            }`}
            placeholder={temPendente || semDocente ? "Pendente" : ""}
          />
        </td>
        <td className="px-2 py-1.5 text-center">
          {!readOnly && (
            <button
              onClick={() => handleRemove(disc.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
              title="Remover disciplina"
            >
              <Trash2 size={14} />
            </button>
          )}
        </td>
      </tr>
    );
  };

  // ── Renderizar cabeçalho da tabela ──
  const renderTableHeader = () => (
    <thead className="bg-gray-50 border-b sticky top-0 z-10">
      <tr>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Código</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Disciplina</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Situação</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs w-16">Per.</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs w-16">CH</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs w-16">Nota</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs w-16">Conc.</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Docente</th>
        <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Titulação</th>
        <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs w-12">Ação</th>
      </tr>
    </thead>
  );

  return (
    <Secao
      id="secao-disciplinas"
      titulo="Disciplinas"
      icone={<BookText size={18} className="text-teal-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
      badge={`${revisao.disciplinas.length} disc. | CH ${chTotalGeral}h | ${totalVerificados} verificados | ${totalPendentes} pendentes`}
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          {!readOnly && (
            <>
              <button
                onClick={handleAdd}
                className="px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-medium hover:bg-teal-100"
              >
                + Adicionar
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100"
              >
                Importar CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
              <button
                onClick={handleDownloadTemplate}
                className="px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-1"
              >
                <Download size={14} /> Template CSV
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                Limpar
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-300 mx-1" />
            </>
          )}

          {/* Toggle visualização */}
          <button
            onClick={() => setModoVisualizacao(modoVisualizacao === "agrupado" ? "lista" : "agrupado")}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              modoVisualizacao === "agrupado"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {modoVisualizacao === "agrupado" ? "⊞ Agrupado" : "☰ Lista"}
          </button>

          {modoVisualizacao === "agrupado" && grupos.length > 1 && (
            <>
              <button
                onClick={expandirTodos}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Expandir todos
              </button>
              <button
                onClick={recolherTodos}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Recolher todos
              </button>
              {!readOnly && (
                <>
                  <div className="w-px h-4 bg-gray-300 mx-0.5" />
                  <button
                    onClick={normalizarTodosPeriodos}
                    className="px-2 py-1.5 text-xs text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition-colors"
                    title="Padroniza todos os períodos para formato numérico (ex: '7º SEMESTRE' → '7')"
                  >
                    ✨ Padronizar Períodos
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Legenda de verificação */}
        {revisao.disciplinas.length > 0 && (totalVerificados > 0 || totalPendentes > 0) && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              Verificado na lista de professores ({totalVerificados})
            </span>
            <span className="flex items-center gap-1">
              <ShieldAlert size={12} className="text-amber-500" />
              Não localizado — preencher manualmente ({totalPendentes})
            </span>
          </div>
        )}

        {/* Conteúdo */}
        {revisao.disciplinas.length > 0 ? (
          modoVisualizacao === "agrupado" ? (
            // ── MODO AGRUPADO POR PERÍODO ──
            <div className="space-y-3">
              {grupos.map((grupo) => {
                const isOpen = gruposAbertos.has(grupo.periodo);
                return (
                  <div
                    key={grupo.periodo}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Header do grupo — label editável */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-50 to-teal-25">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleGrupo(grupo.periodo)} className="flex items-center gap-2 hover:bg-teal-100/50 rounded px-1 -mx-1 transition-colors">
                          {isOpen ? (
                            <ChevronUp size={16} className="text-teal-600" />
                          ) : (
                            <ChevronDown size={16} className="text-teal-600" />
                          )}
                        </button>

                        {/* Label editável */}
                        {editandoLabel === grupo.periodo ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={labelTemp}
                              onChange={(e) => setLabelTemp(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarLabel(grupo.periodo);
                                if (e.key === "Escape") { setEditandoLabel(null); setLabelTemp(""); }
                              }}
                              autoFocus
                              className="border border-teal-400 rounded px-2 py-0.5 text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
                            />
                            <button
                              onClick={() => salvarLabel(grupo.periodo)}
                              className="p-1 rounded hover:bg-teal-200 transition-colors"
                              title="Salvar"
                            >
                              <Check size={14} className="text-teal-700" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <button
                              onClick={() => toggleGrupo(grupo.periodo)}
                              className="font-semibold text-sm text-teal-800 hover:underline"
                            >
                              {grupo.label}
                            </button>
                            {!readOnly && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditandoLabel(grupo.periodo);
                                  setLabelTemp(grupo.label);
                                }}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-teal-200 transition-all"
                                title="Editar nome do período"
                              >
                                <Pencil size={12} className="text-teal-600" />
                              </button>
                            )}
                          </div>
                        )}

                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                          {grupo.disciplinas.length} disciplina{grupo.disciplinas.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-gray-500">
                          CH: {grupo.chTotal}h
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {grupo.pendentes > 0 && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={12} />
                            {grupo.pendentes} pendente{grupo.pendentes > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tabela do grupo */}
                    {isOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          {renderTableHeader()}
                          <tbody>
                            {grupo.disciplinas.map(renderRow)}
                          </tbody>
                          {/* Footer do grupo com CH total */}
                          <tfoot>
                            <tr className="bg-gray-50 border-t">
                              <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold text-gray-600">
                                CH Total do Período:
                              </td>
                              <td className="px-2 py-2 text-xs font-bold text-teal-700 text-center">
                                {grupo.chTotal}h
                              </td>
                              <td colSpan={5}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Resumo geral */}
              <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
                <span className="text-sm font-semibold text-teal-800">
                  Total Geral: {revisao.disciplinas.length} disciplinas em {grupos.length} período(s)
                </span>
                <span className="text-sm font-bold text-teal-700">
                  CH Total: {chTotalGeral}h
                </span>
              </div>
            </div>
          ) : (
            // ── MODO LISTA FLAT (original) ──
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                {renderTableHeader()}
                <tbody>
                  {revisao.disciplinas.map(renderRow)}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="text-xs text-gray-400 italic py-4">
            Nenhuma disciplina. Clique em Adicionar ou importe um CSV para incluir.
          </p>
        )}
      </div>
    </Secao>
  );
}
