"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileUp,
  RotateCcw,
  Printer,
  Trash2,
  FileText,
} from "lucide-react";
import type {
  DadosExtraidos,
  EstadoRevisao,
  Curso,
  DadosCursoCadastro,
  DadosEmissoraCadastro,
} from "../types";
import { REVISAO_INICIAL } from "../types";
import {
  SecaoProcesso,
  SecaoPessoais,
  SecaoCurso,
  SecaoEmissora,
  SecaoAcademicos,
  SecaoDisciplinas,
  SecaoAtividades,
  SecaoEstagio,
  SecaoAssinantes,
  SecaoHabilitacoes,
  SecaoDecisaoJudicial,
} from "../components";

// ─── Status Badge Configuration ─────────────────────────────────────────────

const STATUS_LABELS: Record<
  string,
  { label: string; cor: string }
> = {
  rascunho: { label: "Rascunho", cor: "bg-gray-100 text-gray-700" },
  em_extracao: { label: "IA Processando", cor: "bg-violet-100 text-violet-700" },
  aguardando_revisao: { label: "Aguardando Revisão", cor: "bg-blue-100 text-blue-700" },
  aguardando_assinatura: { label: "Aguardando Assinatura", cor: "bg-amber-100 text-amber-700" },
  concluido: { label: "Concluído", cor: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", cor: "bg-red-100 text-red-700" },
};

// ─── Type Definitions ───────────────────────────────────────────────────────

interface ArquivoSalvo {
  id: string;
  nome_original: string;
  tipo_documento: string | null;
  mime_type: string;
  tamanho_bytes: number;
  url_assinada: string | null;
  created_at: string;
}

interface Processo {
  id: string;
  nome: string;
  status: string;
  curso_id: string;
  turno?: string;
  periodo_letivo?: string;
  data_colacao?: string;
  dados_diplomado?: any;
  dados_academicos?: any;
  disciplinas?: any[];
  atividades_complementares?: any[];
  estagios?: any[];
  assinantes?: any;
  habilitacoes?: any[];
  decisao_judicial?: any;
  diploma_id?: string;
}

// ─── Component: Status Badge ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_LABELS[status] || STATUS_LABELS.rascunho;
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.cor}`}>
      {config.label}
    </div>
  );
}

// ─── Component: Drop Zone ──────────────────────────────────────────────────

function DropZone({
  onFilesSelected,
  isDragging,
  setIsDragging,
}: {
  onFilesSelected: (files: File[]) => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition ${
        isDragging
          ? "border-violet-500 bg-violet-50"
          : "border-gray-300 hover:border-violet-400 hover:bg-violet-50/50"
      }`}
    >
      <FileUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
      <p className="text-sm font-medium text-gray-900 mb-1">
        Arraste documentos aqui para adicionar ao processo
      </p>
      <p className="text-xs text-gray-600 mb-4">ou clique para selecionar</p>
      <input
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleInputChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      <button className="text-xs text-violet-600 font-medium hover:underline">
        Selecionar arquivos
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ProcessoDetalhePage() {
  const router = useRouter();
  const params = useParams();
  const processoId = params.id as string;

  // ── Loading States ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processoLoaded, setProcessoLoaded] = useState(false);

  // ── Data States ─────────────────────────────────────────────────────────
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [iesLista, setIesLista] = useState<any[]>([]);
  const [revisao, setRevisao] = useState<EstadoRevisao>(REVISAO_INICIAL);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);

  // ── Auto-fill Data ──────────────────────────────────────────────────────
  const [dadosCurso, setDadosCurso] = useState<DadosCursoCadastro | null>(null);
  const [dadosEmissora, setDadosEmissora] = useState<DadosEmissoraCadastro | null>(null);

  // ── UI States ───────────────────────────────────────────────────────────
  const [secoes, setSecoes] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null);

  // ── Arquivos de Origem ──────────────────────────────────────────────────
  const [arquivosSalvos, setArquivosSalvos] = useState<ArquivoSalvo[]>([]);
  const [loadingArquivos, setLoadingArquivos] = useState(false);
  const [uploadandoArquivos, setUploadandoArquivos] = useState(false);

  // ── Computed Values ─────────────────────────────────────────────────────
  const isRascunho = processo?.status === "rascunho";
  const readOnly = !isRascunho;

  // ─── Load Cursos ───────────────────────────────────────────────────────
  const carregarCursos = useCallback(async () => {
    try {
      const res = await fetch("/api/cursos", { cache: "no-store" });
      if (!res.ok) throw new Error("Erro ao carregar cursos");
      const data = await res.json();
      setCursos(data);
    } catch (e) {
      console.error("Erro ao carregar cursos:", e);
    }
  }, []);

  // ─── Load IES List ──────────────────────────────────────────────────────
  const carregarIES = useCallback(async () => {
    try {
      const res = await fetch("/api/instituicoes", { cache: "no-store" });
      if (!res.ok) throw new Error("Erro ao carregar IES");
      const data = await res.json();
      setIesLista(data);
    } catch (e) {
      console.error("Erro ao carregar IES:", e);
    }
  }, []);

  // ─── Load Arquivos Salvos ──────────────────────────────────────────────
  const carregarArquivos = useCallback(async () => {
    if (!processoId) return;
    setLoadingArquivos(true);
    try {
      const res = await fetch(`/api/processos/${processoId}/arquivos`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setArquivosSalvos(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Erro ao carregar arquivos:", e);
    } finally {
      setLoadingArquivos(false);
    }
  }, [processoId]);

  // ─── Load Processo ──────────────────────────────────────────────────────
  const carregarProcesso = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/processos/${processoId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Processo não encontrado");
      const data = await res.json();
      setProcesso(data);

      // If rascunho, load dados_rascunho
      if (data.status === "rascunho" && data.id) {
        setRascunhoId(data.id);
        try {
          const rascunhoRes = await fetch(`/api/processos/rascunho/${data.id}`, {
            cache: "no-store",
          });
          if (rascunhoRes.ok) {
            const rascunhoData = await rascunhoRes.json();
            if (rascunhoData.dados_rascunho) {
              // null-safe: mescla com REVISAO_INICIAL pra garantir que arrays
              // (disciplinas, assinantes, habilitacoes, etc) nunca fiquem
              // undefined e quebrem o .map() das seções ao carregar rascunho vazio
              setRevisao({ ...REVISAO_INICIAL, ...rascunhoData.dados_rascunho });
            }
          }
        } catch (e) {
          console.error("Erro ao carregar rascunho:", e);
        }
      } else {
        // Map processo data to EstadoRevisao for display
        const estadoMapeado: EstadoRevisao = {
          ...REVISAO_INICIAL,
          nome: data.nome || "",
          curso_id: data.curso_id || "",
          turno: data.turno || "Matutino",
          periodo_letivo: data.periodo_letivo || "",
          data_colacao: data.data_colacao || "",
          observacoes: data.obs || "",
          // Diplomado
          nome_aluno: data.dados_diplomado?.nome_aluno || "",
          nome_social: data.dados_diplomado?.nome_social || "",
          cpf: data.dados_diplomado?.cpf || "",
          data_nascimento: data.dados_diplomado?.data_nascimento || "",
          sexo: data.dados_diplomado?.sexo || "",
          nacionalidade: data.dados_diplomado?.nacionalidade || "Brasileira",
          naturalidade_municipio: data.dados_diplomado?.naturalidade_municipio || "",
          naturalidade_codigo_municipio: data.dados_diplomado?.naturalidade_codigo_municipio || "",
          naturalidade_uf: data.dados_diplomado?.naturalidade_uf || "",
          rg_numero: data.dados_diplomado?.rg_numero || "",
          rg_uf: data.dados_diplomado?.rg_uf || "",
          rg_orgao_expedidor: data.dados_diplomado?.rg_orgao_expedidor || "",
          doc_substituto_rg: data.dados_diplomado?.doc_substituto_rg || "",
          telefone: data.dados_diplomado?.telefone || "",
          email: data.dados_diplomado?.email || "",
          genitores: data.dados_diplomado?.genitores || REVISAO_INICIAL.genitores,
          // Acadêmico
          forma_acesso: data.dados_academicos?.forma_acesso || "",
          data_ingresso: data.dados_academicos?.data_ingresso || "",
          data_conclusao: data.dados_academicos?.data_conclusao || "",
          situacao_discente: data.dados_academicos?.situacao_discente || "Formado",
          codigo_curriculo: data.dados_academicos?.codigo_curriculo || "",
          carga_horaria_curso: data.dados_academicos?.carga_horaria_curso || "",
          carga_horaria_integralizada: data.dados_academicos?.carga_horaria_integralizada || "",
          hora_aula: data.dados_academicos?.hora_aula || "",
          enade_situacao: data.dados_academicos?.enade_situacao || "",
          enade_condicao: data.dados_academicos?.enade_condicao || "",
          enade_edicao: data.dados_academicos?.enade_edicao || "",
          // Listas
          disciplinas: data.disciplinas || [],
          atividades_complementares: data.atividades_complementares || [],
          estagios: data.estagios || [],
          ecnpj_emissora: data.assinantes?.ecnpj_emissora || "",
          assinantes_diploma: data.assinantes?.assinantes_diploma || [],
          habilitacoes: data.habilitacoes || [],
          decisao_judicial: !!data.decisao_judicial,
          dj_numero_processo: data.decisao_judicial?.numero_processo || "",
          dj_nome_juiz: data.decisao_judicial?.nome_juiz || "",
          dj_decisao: data.decisao_judicial?.decisao || "",
          dj_declaracoes: data.decisao_judicial?.declaracoes || "",
        };
        setRevisao(estadoMapeado);
      }

      setProcessoLoaded(true);
    } catch (e) {
      console.error("Erro ao carregar processo:", e);
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [processoId]);

  // ─── Auto-fill when curso_id changes ────────────────────────────────────
  useEffect(() => {
    const loadCursoData = async () => {
      if (!revisao.curso_id) {
        setDadosCurso(null);
        return;
      }

      try {
        const res = await fetch(`/api/cursos/${revisao.curso_id}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const curso = await res.json();
          const dadosMapeados: DadosCursoCadastro = {
            id: curso.id,
            nome: curso.nome,
            codigo_emec: curso.codigo_emec,
            modalidade: curso.modalidade,
            titulo_conferido: curso.titulo_conferido,
            grau_conferido: curso.grau_conferido,
            outro_titulo: curso.outro_titulo,
            carga_horaria: curso.carga_horaria,
            hora_aula: curso.hora_aula,
            codigo_curriculo: curso.codigo_curriculo,
          };
          setDadosCurso(dadosMapeados);

          // Auto-fill relevant fields
          setRevisao((prev) => ({
            ...prev,
            carga_horaria_curso: curso.carga_horaria || prev.carga_horaria_curso,
            hora_aula: curso.hora_aula || prev.hora_aula,
            codigo_curriculo: curso.codigo_curriculo || prev.codigo_curriculo,
          }));
        }
      } catch (e) {
        console.error("Erro ao carregar dados do curso:", e);
      }
    };

    loadCursoData();
  }, [revisao.curso_id]);

  // ─── Auto-fill emissora when instituicao changes ────────────────────────
  const handleSelectIES = useCallback(
    async (iesId: string) => {
      if (!iesId) {
        setDadosEmissora(null);
        return;
      }

      try {
        const res = await fetch(`/api/instituicoes/${iesId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const ies = await res.json();
          const dadosMapeados: DadosEmissoraCadastro = {
            nome: ies.nome,
            codigo_mec: ies.codigo_mec,
            cnpj: ies.cnpj,
            ecnpj: ies.ecnpj,
          };
          setDadosEmissora(dadosMapeados);
        }
      } catch (e) {
        console.error("Erro ao carregar dados da IES:", e);
      }
    },
    []
  );

  // ─── Save Rascunho ─────────────────────────────────────────────────────
  const salvarRascunho = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...(rascunhoId ? { id: rascunhoId } : {}),
        nome: revisao.nome || null,
        curso_id: revisao.curso_id || null,
        dados_rascunho: revisao,
      };

      const res = await fetch("/api/processos/rascunho", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro ao salvar rascunho");

      const data = await res.json();
      if (data.id && !rascunhoId) {
        setRascunhoId(data.id);
      }

      setError(null);
      setRascunhoSalvoEm(
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );

      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setRascunhoSalvoEm(null), 5000);
    } catch (e) {
      console.error("Erro ao salvar rascunho:", e);
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setRascunhoSalvoEm(null);
    } finally {
      setSaving(false);
    }
  }, [revisao, rascunhoId]);

  // ─── Create Processo ───────────────────────────────────────────────────
  const criarProcesso = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        nome: revisao.nome,
        curso_id: revisao.curso_id,
        turno: revisao.turno || null,
        periodo_letivo: revisao.periodo_letivo || null,
        data_colacao: revisao.data_colacao || null,
        obs: revisao.observacoes || null,
        dados_diplomado: {
          nome_aluno: revisao.nome_aluno,
          nome_social: revisao.nome_social || null,
          cpf: revisao.cpf,
          data_nascimento: revisao.data_nascimento || null,
          sexo: revisao.sexo || null,
          nacionalidade: revisao.nacionalidade || null,
          naturalidade_municipio: revisao.naturalidade_municipio || null,
          naturalidade_codigo_municipio: revisao.naturalidade_codigo_municipio || null,
          naturalidade_uf: revisao.naturalidade_uf || null,
          rg_numero: revisao.rg_numero || null,
          rg_uf: revisao.rg_uf || null,
          rg_orgao_expedidor: revisao.rg_orgao_expedidor || null,
          telefone: revisao.telefone || null,
          email: revisao.email || null,
          genitores: revisao.genitores,
        },
        dados_academicos: {
          forma_acesso: revisao.forma_acesso || null,
          data_ingresso: revisao.data_ingresso || null,
          data_conclusao: revisao.data_conclusao || null,
          situacao_discente: revisao.situacao_discente,
          codigo_curriculo: revisao.codigo_curriculo || null,
          carga_horaria_curso: revisao.carga_horaria_curso || null,
          carga_horaria_integralizada: revisao.carga_horaria_integralizada || null,
          hora_aula: revisao.hora_aula || null,
          enade_situacao: revisao.enade_situacao || null,
          enade_condicao: revisao.enade_condicao || null,
          enade_edicao: revisao.enade_edicao || null,
        },
        disciplinas: revisao.disciplinas,
        atividades_complementares: revisao.atividades_complementares,
        estagios: revisao.estagios,
        assinantes: {
          ecnpj_emissora: revisao.ecnpj_emissora || null,
          assinantes_diploma: revisao.assinantes_diploma,
        },
        habilitacoes: revisao.habilitacoes,
        decisao_judicial: revisao.decisao_judicial
          ? {
              numero_processo: revisao.dj_numero_processo || null,
              nome_juiz: revisao.dj_nome_juiz || null,
              decisao: revisao.dj_decisao || null,
              declaracoes: revisao.dj_declaracoes || null,
            }
          : null,
      };

      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody.error || errBody.detalhes
          ? `Erro ao criar processo: ${errBody.error || ''}${errBody.detalhes ? ' — ' + JSON.stringify(errBody.detalhes) : ''}`
          : `Erro ao criar processo (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const novoProcesso = await res.json();

      // Delete rascunho if it exists
      if (rascunhoId) {
        fetch(`/api/processos/${processoId}`, { method: "DELETE" }).catch(
          () => {}
        );
      }

      // Redirect to pipeline
      if (novoProcesso.diploma_id) {
        router.push(`/diploma/diplomas/${novoProcesso.diploma_id}`);
      } else {
        router.push(`/diploma/diplomas?processo=${novoProcesso.id}`);
      }
    } catch (e) {
      console.error("Erro ao criar processo:", e);
      setError(e instanceof Error ? e.message : "Erro ao criar processo");
    } finally {
      setSaving(false);
    }
  }, [revisao, rascunhoId, processoId, router]);

  // ─── Toggle Section ────────────────────────────────────────────────────
  const toggleSecao = (secaoId: string) => {
    setSecoes((prev) => {
      const novo = new Set(prev);
      if (novo.has(secaoId)) {
        novo.delete(secaoId);
      } else {
        novo.add(secaoId);
      }
      return novo;
    });
  };

  // ─── Handle Files — Upload para Storage ───────────────────────────────
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!processoId || files.length === 0) return;
    setUploadandoArquivos(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append("arquivo", file);
      try {
        const res = await fetch(`/api/processos/${processoId}/arquivos`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Erro ao fazer upload:", err.error || res.statusText);
        }
      } catch (e) {
        console.error("Erro ao fazer upload:", e);
      }
    }

    setUploadandoArquivos(false);
    await carregarArquivos();
  }, [processoId, carregarArquivos]);

  // ─── Excluir arquivo salvo ─────────────────────────────────────────────
  const excluirArquivo = useCallback(async (arquivoId: string, nome: string) => {
    if (!confirm(`Remover o arquivo "${nome}"?`)) return;
    try {
      const res = await fetch(
        `/api/processos/${processoId}/arquivos?arquivo_id=${arquivoId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await carregarArquivos();
      }
    } catch (e) {
      console.error("Erro ao excluir arquivo:", e);
    }
  }, [processoId, carregarArquivos]);

  // ─── Exportar PDF ──────────────────────────────────────────────────────
  const exportarPDF = useCallback(() => {
    const cursoInfo = cursos.find((c) => c.id === revisao.curso_id);

    const formatarData = (d: string) => {
      if (!d) return "—";
      try {
        return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
      } catch { return d; }
    };

    const esc = (s: string | undefined | null) => {
      if (!s) return "—";
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    // Montar tabela de disciplinas
    let discRows = "";
    if (revisao.disciplinas?.length > 0) {
      discRows = revisao.disciplinas.map((d, i) =>
        `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.codigo)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.nome)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(d.carga_horaria)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(d.nota || d.conceito)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(d.situacao)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.nome_docente)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(d.periodo)}</td>
        </tr>`
      ).join("");
    }

    // Montar atividades complementares
    let ativRows = "";
    if (revisao.atividades_complementares?.length > 0) {
      ativRows = revisao.atividades_complementares.map((a, i) =>
        `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.descricao || a.tipo)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(a.ch_hora_relogio)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${formatarData(a.data_inicio || "")}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${formatarData(a.data_fim || "")}</td>
        </tr>`
      ).join("");
    }

    // Montar estágios
    let estagRows = "";
    if (revisao.estagios?.length > 0) {
      estagRows = revisao.estagios.map((e, i) =>
        `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(e.concedente_razao_social)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(e.ch_hora_relogio)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${formatarData(e.data_inicio || "")}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${formatarData(e.data_fim || "")}</td>
        </tr>`
      ).join("");
    }

    // Montar assinantes
    let assinRows = "";
    if (revisao.assinantes_diploma?.length > 0) {
      assinRows = revisao.assinantes_diploma.map((a, i) =>
        `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.nome)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(a.cpf)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.cargo)}</td>
        </tr>`
      ).join("");
    }

    // Genitores
    const genitorText = revisao.genitores?.length > 0
      ? revisao.genitores.map(g => `${esc(g.nome)} (${esc(g.sexo)})`).join(", ")
      : "—";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Processo - ${esc(processo?.nome)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 53mm 20mm 38mm; }
      .no-print { display: none !important; }
      @page { margin: 0; size: A4; }
    }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.4; padding: 170px 50px 130px; max-width: 860px; margin: 0 auto; }
    /* ── Cabeçalho do documento ── */
    .header { text-align: center; margin: 0 0 20px 0; }
    .header-doc-title { font-size: 13px; font-weight: 700; color: #1e40af; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.3px; }
    .header .meta { font-size: 11px; color: #6b7280; }
    /* ── Seções e campos ── */
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 8px 12px; border-left: 4px solid #1e40af; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; padding: 0 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; padding: 0 12px; }
    .field { margin-bottom: 4px; }
    .field .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .field .value { font-size: 12px; color: #111827; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 8px 0; }
    th { background: #1e40af; color: white; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-rascunho { background: #f3f4f6; color: #4b5563; }
    .badge-concluido { background: #d1fae5; color: #065f46; }
    /* ── Botão Imprimir (FIC vermelho) ── */
    .print-btn { position: fixed; top: 20px; right: 20px; background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; z-index: 1000; box-shadow: 0 2px 8px rgba(220,38,38,0.25); font-weight: 600; }
    .print-btn:hover { background: #b91c1c; }
    /* ── Rodapé ── */
    .footer { text-align: center; font-size: 10px; color: #9ca3af; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 30px; }
    .footer-brand { font-weight: 700; color: #1e40af; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <!-- Timbrado oficial FIC como fundo de página -->
  <div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="${window.location.origin}/TimbradoSISTEMA.png" style="width:100%;height:100%;object-fit:fill;" alt="">
  </div>

  <!-- Título e meta do documento -->
  <div class="header">
    <div class="header-doc-title">Dados do Processo de Emissão de Diploma Digital</div>
    <div class="meta">
      <strong>${esc(processo?.nome)}</strong>
      &nbsp;&middot;&nbsp;
      <span class="badge badge-${processo?.status === "concluido" ? "concluido" : "rascunho"}">${processo?.status?.toUpperCase()}</span>
      &nbsp;&middot;&nbsp;
      Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </div>
  </div>

  <!-- 1. Dados do Processo -->
  <div class="section">
    <div class="section-title">1. Dados do Processo</div>
    <div class="grid">
      <div class="field"><div class="label">Nome do Processo</div><div class="value">${esc(revisao.nome)}</div></div>
      <div class="field"><div class="label">Curso</div><div class="value">${esc(cursoInfo?.nome)} (${esc(cursoInfo?.grau)})</div></div>
      <div class="field"><div class="label">Turno</div><div class="value">${esc(revisao.turno)}</div></div>
      <div class="field"><div class="label">Período Letivo</div><div class="value">${esc(revisao.periodo_letivo)}</div></div>
      <div class="field"><div class="label">Data de Colação</div><div class="value">${formatarData(revisao.data_colacao)}</div></div>
      <div class="field"><div class="label">Observações</div><div class="value">${esc(revisao.observacoes) || "—"}</div></div>
    </div>
  </div>

  <!-- 2. Dados Pessoais -->
  <div class="section">
    <div class="section-title">2. Dados Pessoais do Diplomado</div>
    <div class="grid">
      <div class="field"><div class="label">Nome Completo</div><div class="value">${esc(revisao.nome_aluno)}</div></div>
      <div class="field"><div class="label">Nome Social</div><div class="value">${esc(revisao.nome_social) || "—"}</div></div>
      <div class="field"><div class="label">CPF</div><div class="value">${esc(revisao.cpf)}</div></div>
      <div class="field"><div class="label">Data de Nascimento</div><div class="value">${formatarData(revisao.data_nascimento)}</div></div>
      <div class="field"><div class="label">Sexo</div><div class="value">${esc(revisao.sexo)}</div></div>
      <div class="field"><div class="label">Nacionalidade</div><div class="value">${esc(revisao.nacionalidade)}</div></div>
      <div class="field"><div class="label">Naturalidade</div><div class="value">${esc(revisao.naturalidade_municipio)} - ${esc(revisao.naturalidade_uf)}</div></div>
      <div class="field"><div class="label">RG</div><div class="value">${esc(revisao.rg_numero)} (${esc(revisao.rg_orgao_expedidor)} - ${esc(revisao.rg_uf)})</div></div>
      <div class="field"><div class="label">Telefone</div><div class="value">${esc(revisao.telefone)}</div></div>
      <div class="field"><div class="label">E-mail</div><div class="value">${esc(revisao.email)}</div></div>
      <div class="field"><div class="label">Filiação</div><div class="value">${genitorText}</div></div>
    </div>
  </div>

  <!-- 3. Dados Acadêmicos -->
  <div class="section">
    <div class="section-title">3. Dados Acadêmicos / Histórico</div>
    <div class="grid">
      <div class="field"><div class="label">Forma de Acesso</div><div class="value">${esc(revisao.forma_acesso)}</div></div>
      <div class="field"><div class="label">Data de Ingresso</div><div class="value">${formatarData(revisao.data_ingresso)}</div></div>
      <div class="field"><div class="label">Data de Conclusão</div><div class="value">${formatarData(revisao.data_conclusao)}</div></div>
      <div class="field"><div class="label">Situação Discente</div><div class="value">${esc(revisao.situacao_discente)}</div></div>
      <div class="field"><div class="label">Código Currículo</div><div class="value">${esc(revisao.codigo_curriculo)}</div></div>
      <div class="field"><div class="label">CH Curso (prevista)</div><div class="value">${esc(revisao.carga_horaria_curso)}h</div></div>
      <div class="field"><div class="label">CH Integralizada (cumprida)</div><div class="value">${esc(revisao.carga_horaria_integralizada)}h</div></div>
      <div class="field"><div class="label">Hora-Aula (min)</div><div class="value">${esc(revisao.hora_aula)}</div></div>
    </div>
    <div style="margin-top:10px;padding:0 12px;">
      <div class="section-title" style="font-size:12px;margin-bottom:6px;">ENADE</div>
      <div class="grid-3">
        <div class="field"><div class="label">Situação do Curso</div><div class="value">${esc(revisao.enade_situacao)}</div></div>
        <div class="field"><div class="label">Condição do Aluno</div><div class="value">${esc(revisao.enade_condicao)}</div></div>
        <div class="field"><div class="label">Edição/Ano</div><div class="value">${esc(revisao.enade_edicao)}</div></div>
      </div>
    </div>
  </div>

  <!-- 4. Disciplinas -->
  <div class="section">
    <div class="section-title">4. Disciplinas (${revisao.disciplinas?.length || 0} disciplinas)</div>
    ${revisao.disciplinas?.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Código</th><th>Disciplina</th><th style="text-align:center;">CH</th><th style="text-align:center;">Nota</th><th style="text-align:center;">Situação</th><th>Docente</th><th style="text-align:center;">Período</th>
        </tr>
      </thead>
      <tbody>${discRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma disciplina cadastrada.</p>"}
  </div>

  <!-- 5. Atividades Complementares -->
  <div class="section">
    <div class="section-title">5. Atividades Complementares (${revisao.atividades_complementares?.length || 0})</div>
    ${revisao.atividades_complementares?.length > 0 ? `
    <table>
      <thead><tr><th>Descrição</th><th style="text-align:center;">CH</th><th style="text-align:center;">Início</th><th style="text-align:center;">Fim</th></tr></thead>
      <tbody>${ativRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma atividade complementar.</p>"}
  </div>

  <!-- 6. Estágios -->
  <div class="section">
    <div class="section-title">6. Estágios (${revisao.estagios?.length || 0})</div>
    ${revisao.estagios?.length > 0 ? `
    <table>
      <thead><tr><th>Concedente</th><th style="text-align:center;">CH</th><th style="text-align:center;">Início</th><th style="text-align:center;">Fim</th></tr></thead>
      <tbody>${estagRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhum estágio cadastrado.</p>"}
  </div>

  <!-- 7. Assinantes -->
  <div class="section">
    <div class="section-title">7. Assinantes do Diploma</div>
    <div class="grid" style="margin-bottom:8px;">
      <div class="field"><div class="label">e-CNPJ Emissora</div><div class="value">${esc(revisao.ecnpj_emissora)}</div></div>
    </div>
    ${revisao.assinantes_diploma?.length > 0 ? `
    <table>
      <thead><tr><th>Nome</th><th style="text-align:center;">CPF</th><th>Cargo</th></tr></thead>
      <tbody>${assinRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhum assinante cadastrado.</p>"}
  </div>

  <!-- 8. Habilitações -->
  <div class="section">
    <div class="section-title">8. Habilitações (${revisao.habilitacoes?.length || 0})</div>
    ${revisao.habilitacoes?.length > 0
      ? revisao.habilitacoes.map(h => `<div style="padding:4px 12px;font-size:12px;"><strong>${esc(h.nome)}</strong> — ${formatarData(h.data)}</div>`).join("")
      : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma habilitação.</p>"}
  </div>

  <!-- 9. Decisão Judicial -->
  <div class="section">
    <div class="section-title">9. Decisão Judicial</div>
    ${revisao.decisao_judicial ? `
    <div class="grid">
      <div class="field"><div class="label">Nº Processo</div><div class="value">${esc(revisao.dj_numero_processo)}</div></div>
      <div class="field"><div class="label">Nome do Juiz</div><div class="value">${esc(revisao.dj_nome_juiz)}</div></div>
      <div class="field"><div class="label">Decisão</div><div class="value">${esc(revisao.dj_decisao)}</div></div>
      <div class="field"><div class="label">Declarações</div><div class="value">${esc(revisao.dj_declaracoes)}</div></div>
    </div>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Não se aplica — emissão sem decisão judicial.</p>"}
  </div>

  <div class="footer">
    <span class="footer-brand">FIC</span> — Faculdades Integradas de Cassilândia &middot; Sistema de Gestão Integrado — Diploma Digital &middot; Documento gerado automaticamente
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }, [revisao, processo, cursos]);

  // ─── Initial Load ──────────────────────────────────────────────────────
  useEffect(() => {
    carregarProcesso();
    carregarCursos();
    carregarIES();
    carregarArquivos();
  }, [carregarProcesso, carregarCursos, carregarIES, carregarArquivos]);

  // ─── Render: Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Carregando processo...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Not Found ─────────────────────────────────────────────────
  if (!processo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processo não encontrado</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 text-violet-600 hover:underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Main ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition mt-1"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-bold text-gray-900">
                    {processo.nome}
                  </h1>
                  <StatusBadge status={processo.status} />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  {cursos.find((c) => c.id === processo.curso_id) && (
                    <>
                      <span>
                        {cursos.find((c) => c.id === processo.curso_id)?.nome}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>
                        {cursos.find((c) => c.id === processo.curso_id)?.grau}
                      </span>
                      <span className="text-gray-400">•</span>
                    </>
                  )}
                  <span>{processo.periodo_letivo}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportarPDF}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium"
                title="Exportar dados do processo em PDF"
              >
                <Printer className="w-4 h-4" />
                Exportar PDF
              </button>
              {readOnly && (
                <button
                  onClick={() =>
                    router.push(
                      `/diploma/diplomas/${processo.diploma_id || processo.id}`
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium"
                >
                  Avançar para Pipeline
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Drop Zone (rascunho only) */}
        {isRascunho && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-3">
                <FileUp className="w-5 h-5 text-violet-600 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">
                    Documentos de Origem
                  </h2>
                  <p className="text-sm text-gray-600">
                    Documentos salvos para compor o acervo acadêmico e para dupla checagem com IA
                  </p>
                </div>
              </div>
              {arquivosSalvos.length > 0 && (
                <span className="flex-shrink-0 text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-medium border border-violet-200">
                  {arquivosSalvos.length} arquivo{arquivosSalvos.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Lista de arquivos salvos */}
            {loadingArquivos ? (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                <Loader2 size={15} className="animate-spin" /> Carregando arquivos...
              </div>
            ) : arquivosSalvos.length > 0 ? (
              <div className="space-y-1.5">
                {arquivosSalvos.map((arq) => (
                  <div
                    key={arq.id}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 group"
                  >
                    <div className="p-1 bg-white border border-gray-200 rounded flex-shrink-0">
                      <FileText size={13} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{arq.nome_original}</p>
                      <p className="text-xs text-gray-500">
                        {arq.tipo_documento || "Tipo detectado pela IA"}
                        {arq.tamanho_bytes ? ` · ${(arq.tamanho_bytes / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {arq.url_assinada && (
                        <a
                          href={arq.url_assinada}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Visualizar arquivo"
                        >
                          <FileUp size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => excluirArquivo(arq.id, arq.nome_original)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Remover arquivo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Upload zone */}
            <div className="relative">
              {uploadandoArquivos && (
                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-violet-700 font-medium">
                    <Loader2 size={16} className="animate-spin" />
                    Enviando e detectando tipo...
                  </div>
                </div>
              )}
              <DropZone
                onFilesSelected={handleFilesSelected}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
              />
            </div>

            <button
              onClick={() => {
                alert(
                  "Reprocessar com IA (será implementado em versão futura)"
                );
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 text-violet-600 rounded-lg hover:bg-violet-100 transition text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reprocessar Dados com IA
            </button>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          {/* Seção 1: Processo */}
          <SecaoProcesso
            revisao={revisao}
            setRevisao={setRevisao}
            cursos={cursos}
            readOnly={readOnly}
            secaoAberta={secoes.has("processo")}
            onToggle={() => toggleSecao("processo")}
          />

          {/* Seção 2: Pessoais */}
          <SecaoPessoais
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("pessoais")}
            onToggle={() => toggleSecao("pessoais")}
          />

          {/* Seção 3: Curso */}
          <SecaoCurso
            dadosCurso={dadosCurso}
            secaoAberta={secoes.has("curso")}
            onToggle={() => toggleSecao("curso")}
          />

          {/* Seção 4: Emissora */}
          <SecaoEmissora
            dadosEmissora={dadosEmissora}
            secaoAberta={secoes.has("emissora")}
            onToggle={() => toggleSecao("emissora")}
            listaIES={iesLista}
            iesId={processo?.curso_id || ""}
            onSelectIES={handleSelectIES}
          />

          {/* Seção 5: Acadêmicos */}
          <SecaoAcademicos
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("academicos")}
            onToggle={() => toggleSecao("academicos")}
          />

          {/* Seção 6: Disciplinas */}
          <SecaoDisciplinas
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("disciplinas")}
            onToggle={() => toggleSecao("disciplinas")}
          />

          {/* Seção 7: Atividades */}
          <SecaoAtividades
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("atividades")}
            onToggle={() => toggleSecao("atividades")}
          />

          {/* Seção 8: Estágio */}
          <SecaoEstagio
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("estagio")}
            onToggle={() => toggleSecao("estagio")}
          />

          {/* Seção 9: Assinantes */}
          <SecaoAssinantes
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("assinantes")}
            onToggle={() => toggleSecao("assinantes")}
          />

          {/* Seção 10: Habilitações */}
          <SecaoHabilitacoes
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("habilitacoes")}
            onToggle={() => toggleSecao("habilitacoes")}
          />

          {/* Seção 11: Decisão Judicial */}
          <SecaoDecisaoJudicial
            revisao={revisao}
            setRevisao={setRevisao}
            readOnly={readOnly}
            secaoAberta={secoes.has("decisao")}
            onToggle={() => toggleSecao("decisao")}
          />
        </div>

        {/* Action Bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-2">
          {/* Feedback de sucesso */}
          {rascunhoSalvoEm && (
            <div className="flex items-center gap-2 justify-end animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700 font-medium">
                Rascunho salvo com sucesso às {rascunhoSalvoEm}
              </p>
            </div>
          )}

          {/* Feedback de erro */}
          {error && (
            <div className="flex items-center gap-2 justify-end">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
          {/* Se já existe um diploma vinculado (processo criado via novo fluxo),
              mostrar "Ir para Pipeline" independente do status de rascunho */}
          {processo?.diploma_id ? (
            <>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Voltar
              </button>
              <button
                onClick={() => router.push(`/diploma/diplomas/${processo.diploma_id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium"
              >
                <ArrowRight className="w-4 h-4" />
                Ir para Pipeline (Gerar XML / Assinar)
              </button>
            </>
          ) : isRascunho ? (
            <>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Cancelar
              </button>
              <div className="flex gap-3">
                <button
                  onClick={salvarRascunho}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition text-sm font-medium"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar Rascunho"}
                </button>
                <button
                  onClick={criarProcesso}
                  disabled={saving || !revisao.cpf || !revisao.nome_aluno}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Criando..." : "Confirmar e Criar Processo"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div />
              <button
                onClick={() =>
                  router.push(
                    `/diploma/diplomas/${processo.diploma_id || processo.id}`
                  )
                }
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium"
              >
                Avançar para Pipeline
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          </div>
        </div>
      </div>

    </div>
  );
}
