"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /diploma/migracao — Módulo de Migração de Diplomas Legados
//
// Permite importar diplomas gerados em sistemas anteriores para a nova plataforma.
// Dois modos:
//   - Migração em Lote: upload de arquivos ZIP contendo XMLs + PDFs do legado
//   - Migração Individual: localizar e migrar um diploma específico
//
// Layout: 2 colunas (painel de migração | assistente de IA)
//
// Fluxo lote:
//   1. Admin seleciona arquivo(s) ZIP
//   2. Sistema faz upload para Supabase Storage
//   3. API processa ZIP: extrai XMLs, parsa dados, cria registros no banco
//   4. Para cada diploma: nova RVDD é gerada com URL do novo portal
//   5. Progress em tempo real via polling
//   6. Assistente IA acompanha o processo e responde dúvidas em tempo real
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, ArrowRight, FileText, User,
  GraduationCap, Clock, X, ChevronDown, ChevronUp,
  Info, Layers, Package, FolderOpen, FilePlus2,
  FileSpreadsheet, Sparkles, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AssistenteMigracao } from "@/components/ia/AssistenteMigracao";
import type { ContextoMigracao } from "@/lib/ai/prompts/system-migracao";
import {
  criarArquivoCarregado,
  crossReference,
  montarKitsFromMapeamentoIA,
  serializarArquivosParaIA,
  serializarKitsParaIA,
  type ArquivoCarregado,
  type MapeamentoIA,
  type ResultadoCrossRef,
} from "@/lib/migracao/cross-reference";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface JobStatus {
  id: string;
  tipo: "lote" | "individual";
  status: "pendente" | "processando" | "concluido" | "com_erros" | "cancelado";
  total: number;
  processados: number;
  erros: number;
  ignorados: number;
  arquivo_fonte: string | null;
  logs: LogEntry[];
  detalhes: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  ts: string;
  nivel: "info" | "ok" | "erro" | "aviso";
  mensagem: string;
  diploma_nome?: string;
}

interface ResultadoIndividual {
  encontrado: boolean;
  diploma_id?: string;
  nome?: string;
  curso?: string;
  codigo_validacao?: string;
  status_atual?: string;
  ja_migrado?: boolean;
  mensagem?: string;
}

// ── Sub-componente: Barra de progresso ───────────────────────────────────────

function BarraProgresso({ total, processados, erros, ignorados }: {
  total: number; processados: number; erros: number; ignorados: number;
}) {
  const pct = total > 0 ? Math.round((processados / total) * 100) : 0;
  const pctErros = total > 0 ? Math.round((erros / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{processados} de {total} processados</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct - pctErros}%` }}
        />
        {erros > 0 && (
          <div
            className="h-full bg-red-400 transition-all duration-500"
            style={{ width: `${pctErros}%` }}
          />
        )}
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-emerald-600">✓ {processados - erros} importados</span>
        {erros > 0 && <span className="text-red-500">✗ {erros} erros</span>}
        {ignorados > 0 && <span className="text-amber-500">↷ {ignorados} ignorados</span>}
      </div>
    </div>
  );
}

// ── Sub-componente: Log de eventos ───────────────────────────────────────────

function PainelLog({ logs, expandido, onToggle }: {
  logs: LogEntry[];
  expandido: boolean;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandido && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, expandido]);

  const corNivel = {
    info: "text-blue-600",
    ok: "text-emerald-600",
    erro: "text-red-600",
    aviso: "text-amber-600",
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <FileText size={14} />
          Log de execução ({logs.length} entradas)
        </span>
        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expandido && (
        <div
          ref={scrollRef}
          className="max-h-60 overflow-y-auto bg-gray-950 p-3 font-mono text-xs space-y-0.5"
        >
          {logs.length === 0 ? (
            <p className="text-gray-500">Aguardando início...</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} className={`leading-relaxed ${corNivel[log.nivel]}`}>
                <span className="text-gray-500 mr-2">
                  {new Date(log.ts).toLocaleTimeString("pt-BR")}
                </span>
                {log.mensagem}
                {log.diploma_nome && (
                  <span className="text-gray-400 ml-1">— {log.diploma_nome}</span>
                )}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Aba: Migração em Lote ─────────────────────────────────────────────────────

interface AbaLoteProps {
  onJobChange: (job: JobStatus | null) => void;
  onContextoChange: (arquivos: ArquivoCarregado[], csvContents: string[], ref: ResultadoCrossRef | null) => void;
  onMensagemAutomatica: (msg: string) => void;
  importacaoConfirmada: boolean;
  onImportacaoIniciada: () => void;
  /** crossRef atualizado externamente pela IA (via [ACAO:MAPEAMENTO]) */
  crossRefExterno?: ResultadoCrossRef | null;
}

function AbaLote({
  onJobChange,
  onContextoChange,
  onMensagemAutomatica,
  importacaoConfirmada,
  onImportacaoIniciada,
  crossRefExterno,
}: AbaLoteProps) {
  // Arquivos acumulados de todas as pastas selecionadas
  const [arquivosAcum, setArquivosAcum] = useState<ArquivoCarregado[]>([]);
  // Mapa de nome de arquivo → objeto File real (para fazer o upload)
  const [fileMap, setFileMap] = useState<Map<string, File>>(new Map());
  const [csvContents, setCsvContents] = useState<string[]>([]);
  // Nomes dos CSVs carregados (para exibição)
  const [csvNomes, setCsvNomes] = useState<string[]>([]);
  const [crossRef, setCrossRef] = useState<ResultadoCrossRef | null>(null);

  const [jobAtivo, setJobAtivo] = useState<JobStatus | null>(null);
  const [logExpandido, setLogExpandido] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  // Etapa visual da migração para feedback ao usuário
  const [etapaMigracao, setEtapaMigracao] = useState<
    "preparando" | "enviando" | "registrando" | "concluido" | null
  >(null);

  const pastaInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Propaga jobAtivo para o pai
  useEffect(() => {
    onJobChange(jobAtivo);
  }, [jobAtivo, onJobChange]);

  // Propaga contexto de arquivos/crossRef para o pai (para o assistente IA)
  useEffect(() => {
    onContextoChange(arquivosAcum, csvContents, crossRef);
  }, [arquivosAcum, csvContents, crossRef, onContextoChange]);

  // Quando a IA devolve um mapeamento via [ACAO:MAPEAMENTO], usa-o como crossRef
  useEffect(() => {
    if (crossRefExterno) {
      setCrossRef(crossRefExterno);
    }
  }, [crossRefExterno]);

  // ── Adicionar pasta (acumulativo) ─────────────────────────────────
  const handleAdicionarPasta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const novosArquivos: ArquivoCarregado[] = [];
    const novoFileMap = new Map(fileMap);

    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["xml", "pdf"].includes(ext)) continue;

      const arq = criarArquivoCarregado(f);
      novosArquivos.push(arq);
      // Chave única: pasta/nome para evitar colisões
      novoFileMap.set(`${arq.pastaOrigem}/${arq.nome}`, f);
    }

    setArquivosAcum(prev => [...prev, ...novosArquivos]);
    setFileMap(novoFileMap);
    setCrossRef(null); // invalidar análise anterior
    setErroUpload(null);
    e.target.value = "";
  };

  // ── Adicionar CSV de mapeamento ───────────────────────────────────
  const handleAdicionarCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const novosTextos: string[] = [];
    const novosNomes: string[] = [];
    for (const file of files) {
      const texto = await file.text();
      // Guarda o CSV completo — a IA precisa de todos os nomes de arquivo para montar os kits
      novosTextos.push(texto);
      novosNomes.push(file.name);
    }
    setCsvContents(prev => [...prev, ...novosTextos]);
    setCsvNomes(prev => [...prev, ...novosNomes]);
    setCrossRef(null); // invalidar análise anterior
    e.target.value = "";
  };

  const removerCSV = (idx: number) => {
    setCsvContents(prev => prev.filter((_, i) => i !== idx));
    setCsvNomes(prev => prev.filter((_, i) => i !== idx));
    setCrossRef(null);
  };

  // ── Remover uma pasta da lista ────────────────────────────────────
  const removerPasta = (nomePasta: string) => {
    setArquivosAcum(prev => prev.filter(a => a.pastaOrigem !== nomePasta));
    setFileMap(prev => {
      const novo = new Map(prev);
      for (const key of Array.from(novo.keys())) {
        if (key.startsWith(`${nomePasta}/`)) novo.delete(key);
      }
      return novo;
    });
    setCrossRef(null);
  };

  // ── Analisar com IA ───────────────────────────────────────────────
  const handleAnalisarComIA = () => {
    if (arquivosAcum.length === 0) return;

    // Executa cross-reference local (CPF ou CSV) — concatena todos os CSVs
    const csvCombinado = csvContents.length > 0 ? csvContents.join("\n") : undefined;
    const resultado = crossReference(arquivosAcum, csvCombinado);
    setCrossRef(resultado);

    // Serializa arquivos como texto legível para a mensagem da IA (lista completa)
    const arquivosSerializados = serializarArquivosParaIA(arquivosAcum);
    const arquivosStr = arquivosSerializados.map(a =>
      `  • ${a.pasta ? a.pasta + "/" : ""}${a.nome} [${a.extensao}]${a.cpf ? ` CPF=${a.cpf}` : ""}`
    ).join("\n");

    // Serializa kits como texto legível
    const kitsSerializados = serializarKitsParaIA(resultado.kits);
    const kitsStr = kitsSerializados.map(k =>
      `  • ${k.id}${k.nome ? ` (${k.nome})` : ""}: ${k.completo ? "✅ completo" : `❌ incompleto — ${k.problemas.join("; ")}`} [${k.xmls} XMLs, ${k.pdfs} PDFs]`
    ).join("\n");

    const mensagem = [
      `Arquivos carregados para migração (${arquivosSerializados.length} total):\n${arquivosStr}`,
      csvContents.length > 0 ? (() => {
        // Para cada CSV, envia o cabeçalho + primeiras 50 linhas (suficiente para inferir o schema)
        // A lista completa de arquivos já é enviada acima — a IA cruza pelo schema inferido
        const resumoCSVs = csvContents.map((csv, i) => {
          const linhas = csv.split(/\r?\n/).filter(l => l.trim());
          const amostra = linhas.slice(0, 51).join("\n"); // header + 50 linhas de dados
          const rodape = linhas.length > 51 ? `\n  ... e mais ${linhas.length - 51} linhas (total: ${linhas.length - 1} alunos)` : "";
          return `CSV ${i + 1} (${csvNomes[i]}):\n${amostra}${rodape}`;
        }).join("\n\n");
        return `\nCSVs de mapeamento (${csvContents.length} arquivo(s)):\n${resumoCSVs}`;
      })() : "",
      `\nResultado do cross-reference (método: ${resultado.metodo}):\n${kitsStr}`,
      `\nTotal: ${resultado.kits.length} kits identificados, ${resultado.kits.filter(k => k.completo).length} completos.`,
      `\nPor favor, analise estes arquivos e me diga se posso prosseguir com a importação.`,
    ].filter(Boolean).join("");

    onMensagemAutomatica(mensagem);
  };

  // ── Limpar tudo ───────────────────────────────────────────────────
  const limpar = () => {
    setArquivosAcum([]);
    setFileMap(new Map());
    setCsvContents([]);
    setCsvNomes([]);
    setCrossRef(null);
    setErroUpload(null);
    setJobAtivo(null);
    setProcessando(false);
    setUploadProgress(null);
    setEtapaMigracao(null);
  };

  // ── Polling de status ─────────────────────────────────────────────
  const iniciarPolling = useCallback((jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/diplomas/migracao/${jobId}`);
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJobAtivo(data);
        if (["concluido", "com_erros", "cancelado"].includes(data.status)) {
          clearInterval(pollingRef.current!);
          setProcessando(false);
        }
      } catch {
        // silencia erro de polling
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // ── Iniciar migração (chamado após confirmação da IA) ─────────────
  const iniciarMigracao = async () => {
    if (!crossRef || crossRef.kits.length === 0) return;

    const kitsCompletos = crossRef.kits.filter(k => k.completo);
    if (kitsCompletos.length === 0) {
      setErroUpload("Nenhum kit completo encontrado. Cada aluno precisa de 2 XMLs + 1 PDF.");
      return;
    }

    setProcessando(true);
    setJobAtivo(null);
    setErroUpload(null);
    setEtapaMigracao("preparando");
    onImportacaoIniciada();

    try {
      // 1. Monta lista de arquivos a partir dos kits completos
      const listaArquivos: { pasta: string; nome: string }[] = [];
      for (const kit of kitsCompletos) {
        for (const arq of kit.arquivos) {
          listaArquivos.push({ pasta: kit.identificador, nome: arq.nome });
        }
      }

      // 2. Solicitar URLs assinadas em BATCHES de 30
      const BATCH_SIZE = 30;
      const batches: Array<{ pasta: string; nome: string }>[] = [];
      for (let i = 0; i < listaArquivos.length; i += BATCH_SIZE) {
        batches.push(listaArquivos.slice(i, i + BATCH_SIZE));
      }

      let jobId: string | null = null;
      let storagePrefix: string | null = null;
      let sessionToken: string | null = null;
      const todosUploads: Array<{ pasta: string; nome: string; path: string; signed_url: string; token: string }> = [];

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const body: Record<string, unknown> = {
          files: batch,
          total_arquivos: listaArquivos.length,
        };

        // Chamadas subsequentes enviam job_id + session_token
        if (jobId && storagePrefix && sessionToken) {
          body.job_id = jobId;
          body.storage_prefix = storagePrefix;
          body.session_token = sessionToken;
        }

        const prepRes = await fetch("/api/diplomas/migracao/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const prep = await prepRes.json();

        if (!prepRes.ok && prepRes.status !== 207) {
          throw new Error(prep.error ?? "Falha ao preparar upload.");
        }

        // Captura job_id na primeira resposta
        if (!jobId) {
          jobId = prep.job_id;
          storagePrefix = prep.storage_prefix;
          sessionToken = prep.session_token;
        }

        todosUploads.push(...prep.uploads);
      }

      if (!jobId || !storagePrefix) {
        throw new Error("Não foi possível criar o job de migração.");
      }

      // 3. Upload direto ao Supabase Storage via URLs assinadas
      setEtapaMigracao("enviando");
      const supabase = createClient();
      let uploadados = 0;
      setUploadProgress({ done: 0, total: listaArquivos.length });

      for (const kit of kitsCompletos) {
        for (const arq of kit.arquivos) {
          const chaveFile = `${arq.pastaOrigem}/${arq.nome}`;
          const file = fileMap.get(chaveFile);
          if (!file) {
            console.warn(`File object não encontrado para ${chaveFile}`);
            continue;
          }

          const slot = todosUploads.find(
            (u) => u.pasta === kit.identificador && u.nome === arq.nome
          );
          if (!slot) {
            console.warn(`Slot de upload não encontrado para ${kit.identificador}/${arq.nome}`);
            continue;
          }

          const buffer = await file.arrayBuffer();
          await supabase.storage
            .from("documentos-digitais")
            .uploadToSignedUrl(slot.path, slot.token, buffer, {
              contentType: arq.extensao === "pdf" ? "application/pdf" : "application/xml",
            });

          uploadados++;
          setUploadProgress({ done: uploadados, total: listaArquivos.length });
        }
      }

      setUploadProgress(null);

      // 4. Disparar processamento na API (registrar no banco)
      setEtapaMigracao("registrando");
      const loteRes = await fetch("/api/diplomas/migracao/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          storage_prefix: storagePrefix,
          arquivo_fonte: `Pastas (${kitsCompletos.length} kits completos)`,
        }),
      });

      const loteData = await loteRes.json();

      if (loteData.job_id) {
        iniciarPolling(loteData.job_id);
        const statusRes = await fetch(`/api/diplomas/migracao/${loteData.job_id}`);
        if (statusRes.ok) setJobAtivo(await statusRes.json());
      }

      setEtapaMigracao("concluido");
      // Limpa a etapa após 5s para não ficar permanentemente na tela
      setTimeout(() => setEtapaMigracao(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setErroUpload(msg);
      setProcessando(false);
      setUploadProgress(null);
      setEtapaMigracao(null);
    }
  };

  // Quando a importação é confirmada pelo usuário via assistente IA, inicia
  // (declarado após iniciarMigracao para evitar temporal dead zone)
  useEffect(() => {
    if (importacaoConfirmada && crossRef && !processando) {
      iniciarMigracao();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importacaoConfirmada]);

  const statusLabel: Record<string, { label: string; cor: string; icone: React.ReactNode }> = {
    pendente: { label: "Aguardando", cor: "text-gray-500", icone: <Clock size={14} /> },
    processando: { label: "Processando...", cor: "text-blue-600", icone: <Loader2 size={14} className="animate-spin" /> },
    concluido: { label: "Concluído", cor: "text-emerald-600", icone: <CheckCircle2 size={14} /> },
    com_erros: { label: "Concluído com erros", cor: "text-amber-600", icone: <AlertCircle size={14} /> },
    cancelado: { label: "Cancelado", cor: "text-red-500", icone: <X size={14} /> },
  };

  // Pastas únicas presentes
  const pastasUnicas = Array.from(new Set(arquivosAcum.map(a => a.pastaOrigem))).filter(Boolean);
  const totalArquivos = arquivosAcum.length;

  return (
    <div className="space-y-6">
      {/* Instrução */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Como funciona a migração em lote</p>
          <p>Seus arquivos estão organizados por <strong>tipo</strong> (pasta de diplomas, pasta de históricos,
          pasta de RVDDs)? Adicione cada pasta separadamente. O assistente IA fará o cruzamento
          automático pelo CPF ou pelo CSV de mapeamento.</p>
        </div>
      </div>

      {/* Área de seleção de pastas */}
      <div className="space-y-3">
        {/* Pastas já adicionadas */}
        {pastasUnicas.length > 0 && (
          <div className="border border-gray-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Pastas carregadas
              </span>
              <span className="text-xs text-gray-400">{totalArquivos} arquivos no total</span>
            </div>
            {pastasUnicas.map((pasta) => {
              const arqsPasta = arquivosAcum.filter(a => a.pastaOrigem === pasta);
              const xmls = arqsPasta.filter(a => a.extensao === "xml").length;
              const pdfs = arqsPasta.filter(a => a.extensao === "pdf").length;
              return (
                <div key={pasta} className="flex items-center gap-2 text-xs bg-gray-50 rounded-xl px-3 py-2">
                  <FolderOpen size={13} className="text-indigo-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700 truncate flex-1">{pasta}</span>
                  <span className="text-gray-400 flex-shrink-0">{xmls} XMLs · {pdfs} PDFs</span>
                  {!processando && (
                    <button
                      onClick={() => removerPasta(pasta)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
                      title="Remover pasta"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CSVs carregados */}
        {csvNomes.map((nome, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <FileSpreadsheet size={13} className="text-emerald-500 flex-shrink-0" />
            <span className="text-emerald-700 font-medium flex-1 truncate">{nome}</span>
            {!processando && (
              <button
                onClick={() => removerCSV(idx)}
                className="text-emerald-300 hover:text-red-400 transition-colors flex-shrink-0"
                title="Remover CSV"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {/* Botões de ação */}
        {!processando && (
          <div className="flex gap-2 flex-wrap">
            {/* Input oculto para pasta */}
            <input
              ref={pastaInputRef}
              type="file"
              // @ts-ignore — webkitdirectory não consta nos tipos React, mas funciona em todos os browsers modernos
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={handleAdicionarPasta}
            />
            {/* Input oculto para CSV */}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              multiple
              className="hidden"
              onChange={handleAdicionarCSV}
            />

            <button
              onClick={() => pastaInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-medium bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 px-4 py-2.5 rounded-xl transition-all"
            >
              <FilePlus2 size={14} />
              {pastasUnicas.length === 0 ? "Adicionar pasta" : "Adicionar outra pasta"}
            </button>

            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-medium bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 px-4 py-2.5 rounded-xl transition-all"
            >
              <FileSpreadsheet size={14} />
              {csvNomes.length === 0 ? "CSV de mapeamento" : "Adicionar outro CSV"}
            </button>

            {arquivosAcum.length > 0 && (
              <>
                <button
                  onClick={handleAnalisarComIA}
                  className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Sparkles size={14} />
                  Analisar com IA
                </button>

                <button
                  onClick={limpar}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2.5 rounded-xl"
                  title="Limpar tudo"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Área vazia — convite para adicionar */}
        {pastasUnicas.length === 0 && (
          <div
            onClick={() => pastaInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-gray-50 rounded-2xl p-10 text-center cursor-pointer transition-all"
          >
            <FolderOpen size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">Clique para selecionar uma pasta</p>
            <p className="text-xs text-gray-400 mt-1">
              Adicione quantas pastas precisar — diplomas, históricos e RVDDs podem estar em pastas separadas
            </p>
          </div>
        )}
      </div>

      {/* Resultado do cross-reference */}
      {crossRef && (
        <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">
              Análise concluída — método: <span className="text-indigo-600">{crossRef.metodo}</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-lg font-bold text-gray-800">{crossRef.kits.length}</p>
              <p className="text-xs text-gray-500">Kits identificados</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-lg font-bold text-emerald-700">{crossRef.kits.filter(k => k.completo).length}</p>
              <p className="text-xs text-emerald-600">Completos</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-lg font-bold text-amber-700">{crossRef.kits.filter(k => !k.completo).length}</p>
              <p className="text-xs text-amber-600">Incompletos</p>
            </div>
          </div>
          {crossRef.aviso && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              {crossRef.aviso}
            </div>
          )}

          {/* Botão de confirmar importação — aparece quando há kits completos e não está processando */}
          {!processando && !jobAtivo && crossRef.kits.filter(k => k.completo).length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Pronto para importar
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {crossRef.kits.filter(k => k.completo).length} kits completos serão importados.
                    {crossRef.kits.filter(k => !k.completo).length > 0 && (
                      <> Os {crossRef.kits.filter(k => !k.completo).length} incompletos serão ignorados.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => iniciarMigracao()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Confirmar importação
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progresso da migração com etapas visuais */}
      {(etapaMigracao || uploadProgress) && (
        <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
          {/* Indicador de etapas */}
          <div className="flex items-center gap-2 text-sm">
            {/* Etapa 1: Preparando */}
            <div className={`flex items-center gap-1.5 ${
              etapaMigracao === "preparando" ? "text-indigo-600 font-semibold" :
              etapaMigracao && ["enviando", "registrando", "concluido"].includes(etapaMigracao) ? "text-emerald-600" :
              "text-gray-400"
            }`}>
              {etapaMigracao === "preparando" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : etapaMigracao && ["enviando", "registrando", "concluido"].includes(etapaMigracao) ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>Preparando</span>
            </div>
            <ArrowRight size={12} className="text-gray-300" />

            {/* Etapa 2: Enviando */}
            <div className={`flex items-center gap-1.5 ${
              etapaMigracao === "enviando" ? "text-indigo-600 font-semibold" :
              etapaMigracao && ["registrando", "concluido"].includes(etapaMigracao) ? "text-emerald-600" :
              "text-gray-400"
            }`}>
              {etapaMigracao === "enviando" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : etapaMigracao && ["registrando", "concluido"].includes(etapaMigracao) ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>Enviando</span>
            </div>
            <ArrowRight size={12} className="text-gray-300" />

            {/* Etapa 3: Registrando */}
            <div className={`flex items-center gap-1.5 ${
              etapaMigracao === "registrando" ? "text-indigo-600 font-semibold" :
              etapaMigracao === "concluido" ? "text-emerald-600" :
              "text-gray-400"
            }`}>
              {etapaMigracao === "registrando" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : etapaMigracao === "concluido" ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>Registrando</span>
            </div>
            <ArrowRight size={12} className="text-gray-300" />

            {/* Etapa 4: Concluído */}
            <div className={`flex items-center gap-1.5 ${
              etapaMigracao === "concluido" ? "text-emerald-600 font-semibold" :
              "text-gray-400"
            }`}>
              {etapaMigracao === "concluido" ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>Concluído</span>
            </div>
          </div>

          {/* Mensagem da etapa atual */}
          <div className={`text-xs rounded-xl px-3 py-2 ${
            etapaMigracao === "concluido" ? "bg-emerald-50 text-emerald-700" :
            etapaMigracao === "registrando" ? "bg-blue-50 text-blue-700" :
            "bg-gray-50 text-gray-600"
          }`}>
            {etapaMigracao === "preparando" && "Preparando URLs seguras para upload dos arquivos..."}
            {etapaMigracao === "enviando" && uploadProgress && (
              <>Enviando arquivos para o servidor... {uploadProgress.done}/{uploadProgress.total}</>
            )}
            {etapaMigracao === "registrando" && "Registrando no banco de dados... Isso pode levar alguns minutos."}
            {etapaMigracao === "concluido" && "Importação iniciada com sucesso! Acompanhe o progresso abaixo."}
          </div>

          {/* Barra de progresso (só aparece durante envio) */}
          {uploadProgress && etapaMigracao === "enviando" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{uploadProgress.done} de {uploadProgress.total} arquivos</span>
                <span>{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Erro de upload */}
      {erroUpload && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <p>{erroUpload}</p>
        </div>
      )}

      {/* Painel de status do job */}
      {jobAtivo && (
        <div className="border border-gray-200 rounded-2xl p-5 space-y-4">
          {/* Cabeçalho do job */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statusLabel[jobAtivo.status]?.icone}
              <span className={`text-sm font-semibold ${statusLabel[jobAtivo.status]?.cor}`}>
                {statusLabel[jobAtivo.status]?.label}
              </span>
            </div>
            {jobAtivo.arquivo_fonte && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                {jobAtivo.arquivo_fonte}
              </span>
            )}
          </div>

          {/* Barra de progresso */}
          {jobAtivo.total > 0 && (
            <BarraProgresso
              total={jobAtivo.total}
              processados={jobAtivo.processados}
              erros={jobAtivo.erros}
              ignorados={jobAtivo.ignorados}
            />
          )}

          {/* Resumo final */}
          {["concluido", "com_erros"].includes(jobAtivo.status) && jobAtivo.detalhes && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
              <p className="font-semibold mb-1">Resumo da migração</p>
              <p>{jobAtivo.processados - jobAtivo.erros} diplomas importados com sucesso.</p>
              {jobAtivo.erros > 0 && (
                <p className="text-amber-600">{jobAtivo.erros} diplomas com erro — verifique o log ou pergunte ao assistente.</p>
              )}
              {jobAtivo.ignorados > 0 && (
                <p>{jobAtivo.ignorados} diplomas ignorados (já existiam no sistema).</p>
              )}
            </div>
          )}

          {/* Log */}
          <PainelLog
            logs={jobAtivo.logs}
            expandido={logExpandido}
            onToggle={() => setLogExpandido((v) => !v)}
          />
        </div>
      )}
    </div>
  );
}

// ── Aba: Migração Individual ──────────────────────────────────────────────────

function AbaIndividual() {
  const [busca, setBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"codigo" | "cpf" | "nome">("codigo");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoIndividual | null>(null);
  const [migrando, setMigrando] = useState(false);
  const [migrado, setMigrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const placeholders = {
    codigo: "Ex: 1606.694.000123",
    cpf: "Ex: 000.000.000-00",
    nome: "Nome completo do diplomado",
  };

  const buscarDiploma = async () => {
    if (!busca.trim()) return;
    setCarregando(true);
    setResultado(null);
    setErro(null);
    setMigrado(false);

    try {
      const params = new URLSearchParams({ tipo: tipoBusca, valor: busca.trim() });
      const res = await fetch(`/api/diplomas/migracao/individual?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? "Erro ao buscar diploma.");
      } else {
        setResultado(data);
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const migrarDiploma = async () => {
    if (!resultado?.diploma_id) return;
    setMigrando(true);
    setErro(null);

    try {
      const res = await fetch("/api/diplomas/migracao/individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diploma_id: resultado.diploma_id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? "Erro ao migrar diploma.");
      } else {
        setMigrado(true);
        setResultado((prev) => prev ? { ...prev, ja_migrado: true, status_atual: "rvdd_gerado" } : null);
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setMigrando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instrução */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Migração individual</p>
          <p>Localize um diploma específico pelo código de validação, CPF ou nome do diplomado.
          Útil quando um graduado solicita o acesso ao diploma no novo portal e ainda não foi migrado.</p>
        </div>
      </div>

      {/* Formulário de busca */}
      <div className="space-y-3">
        {/* Tipo de busca */}
        <div className="flex gap-2">
          {(["codigo", "cpf", "nome"] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setTipoBusca(tipo)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                tipoBusca === tipo
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {tipo === "codigo" ? "Código" : tipo === "cpf" ? "CPF" : "Nome"}
            </button>
          ))}
        </div>

        {/* Campo de busca */}
        <div className="flex gap-2">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscarDiploma()}
            placeholder={placeholders[tipoBusca]}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={buscarDiploma}
            disabled={!busca.trim() || carregando}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {carregando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {/* Resultado */}
      {resultado && !erro && (
        resultado.encontrado ? (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{resultado.nome}</p>
                <p className="text-xs text-gray-500">{resultado.curso}</p>
              </div>
              {resultado.ja_migrado && (
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
                  Já migrado
                </span>
              )}
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Código de validação</p>
                <p className="text-sm font-mono font-semibold text-indigo-700">
                  {resultado.codigo_validacao ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status atual</p>
                <p className="text-sm font-medium text-gray-700">
                  {resultado.status_atual ?? "—"}
                </p>
              </div>
            </div>

            <div className="px-4 pb-4">
              {migrado ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <CheckCircle2 size={16} />
                  Diploma migrado com sucesso! Nova RVDD gerada com link do novo portal.
                </div>
              ) : resultado.ja_migrado ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                  <Info size={15} />
                  Este diploma já foi migrado para a nova plataforma.
                  <a
                    href={`/rvdd/${resultado.diploma_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    Ver RVDD <ArrowRight size={13} />
                  </a>
                </div>
              ) : (
                <button
                  onClick={migrarDiploma}
                  disabled={migrando}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {migrando ? (
                    <><Loader2 size={15} className="animate-spin" /> Migrando...</>
                  ) : (
                    <><RefreshCw size={15} /> Migrar este diploma</>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
            <AlertCircle size={16} className="flex-shrink-0" />
            <div>
              <p className="font-semibold">Diploma não encontrado</p>
              <p className="text-amber-600 mt-0.5">
                {resultado.mensagem ?? "Não foi possível localizar um diploma com os dados informados. Verifique os dados e tente novamente."}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PageMigracao() {
  const [aba, setAba] = useState<"lote" | "individual">("lote");

  // Estado compartilhado com o assistente IA para contexto em tempo real
  const [jobAtivo, setJobAtivo] = useState<JobStatus | null>(null);

  // Contexto de arquivos/kits (vem da AbaLote)
  const [arquivosCarregados, setArquivosCarregados] = useState<ArquivoCarregado[]>([]);
  // Ref sempre atualizada para evitar closure stale em callbacks assíncronos (ex: handleMapeamentoIA)
  const arquivosCarregadosRef = useRef<ArquivoCarregado[]>([]);
  const [csvMapeamento, setCsvMapeamento] = useState<string | null>(null);
  const [crossRefAtual, setCrossRefAtual] = useState<ResultadoCrossRef | null>(null);

  // Mensagem automática para disparar no assistente IA
  const [mensagemAutomatica, setMensagemAutomatica] = useState<string>("");

  // Controle de confirmação de importação
  const [importacaoConfirmada, setImportacaoConfirmada] = useState(false);

  // Callback quando AbaLote atualiza seu contexto interno
  const handleContextoChange = useCallback((
    arquivos: ArquivoCarregado[],
    csvs: string[],
    ref: ResultadoCrossRef | null,
  ) => {
    arquivosCarregadosRef.current = arquivos; // mantém ref sempre atualizada
    setArquivosCarregados(arquivos);
    setCsvMapeamento(csvs.length > 0 ? csvs.join("\n") : null);
    setCrossRefAtual(ref);
  }, []);

  // Callback quando a IA emite [ACAO:MAPEAMENTO] — monta os kits cruzando com os arquivos reais
  // Usa ref para evitar closure stale: a IA responde de forma assíncrona, após o estado ter mudado
  const handleMapeamentoIA = useCallback((mapeamento: MapeamentoIA) => {
    const arquivos = arquivosCarregadosRef.current;
    if (arquivos.length === 0) return;
    const resultado = montarKitsFromMapeamentoIA(mapeamento, arquivos);
    setCrossRefAtual(resultado);
  }, []);

  // Callback quando a IA confirma a importação (os dados do marcador ficam disponíveis se precisarmos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleConfirmarImportacao = useCallback((_acao: any) => {
    setImportacaoConfirmada(true);
  }, []);

  // Reseta a flag depois que AbaLote iniciou a migração
  const handleImportacaoIniciada = useCallback(() => {
    setImportacaoConfirmada(false);
  }, []);

  // Monta o contexto do assistente IA com os dados atuais da interface
  const contextoIA: ContextoMigracao = {
    abaAtiva: aba,
    arquivosCarregados: arquivosCarregados.length > 0
      ? serializarArquivosParaIA(arquivosCarregados)
      : undefined,
    // Limita o CSV a 30000 chars no system prompt para não estourar contexto da IA
    // O estado interno (csvMapeamento) guarda o CSV completo para o cross-reference local
    csvMapeamento: csvMapeamento ? csvMapeamento.slice(0, 30000) + (csvMapeamento.length > 30000 ? `\n... (CSV truncado após 30000 chars — ${csvMapeamento.length} chars total)` : "") : undefined,
    crossRef: crossRefAtual ? {
      metodo: crossRefAtual.metodo,
      totalArquivos: crossRefAtual.totalArquivos,
      totalKits: crossRefAtual.kits.length,
      totalCompletos: crossRefAtual.kits.filter(k => k.completo).length,
      totalIncompletos: crossRefAtual.kits.filter(k => !k.completo).length,
      aviso: crossRefAtual.aviso,
      kitsSample: crossRefAtual.kits.slice(0, 10).map(k => ({
        id: k.identificador,
        nome: k.nomeAluno,
        completo: k.completo,
        xmls: k.arquivos.filter(a => a.extensao === "xml").length,
        pdfs: k.arquivos.filter(a => a.extensao === "pdf").length,
        problemas: k.problemas,
      })),
    } : undefined,
    jobStatus: jobAtivo ? {
      status: jobAtivo.status,
      total: jobAtivo.total,
      processados: jobAtivo.processados,
      rejeitadosIncompletos: Number(jobAtivo.detalhes?.rejeitadosIncompletos ?? 0),
      erros: jobAtivo.erros,
      ignorados: jobAtivo.ignorados,
      arquivo: jobAtivo.arquivo_fonte,
    } : undefined,
    // Envia os últimos 10 logs para o agente poder comentar sobre eles
    ultimosLogs: jobAtivo?.logs?.slice(-10).map(l => ({
      nivel: l.nivel,
      mensagem: l.mensagem,
      diploma_nome: l.diploma_nome,
    })),
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Layout: 2 colunas em telas grandes ─────────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">

        {/* ── Coluna principal: Painel de Migração ─────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Cabeçalho */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                <Layers size={18} className="text-violet-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Migração de Diplomas Legados</h1>
            </div>
            <p className="text-sm text-gray-500 ml-12">
              Importe diplomas emitidos em sistemas anteriores para a nova plataforma da FIC.
              Os XMLs originais assinados são preservados. Novas RVDDs são geradas com links do novo portal.
            </p>
          </div>

          {/* Banner informativo */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-6 h-6 bg-violet-200 rounded-lg flex items-center justify-center">
                <Info size={13} className="text-violet-700" />
              </div>
            </div>
            <div className="text-sm text-violet-800">
              <p className="font-semibold mb-1">O que acontece durante a migração?</p>
              <ul className="space-y-0.5 text-violet-700">
                <li>• XMLs assinados originais são preservados integralmente (XAdES AD-RA v1.05)</li>
                <li>• Dados dos diplomados são importados para o banco da nova plataforma</li>
                <li>• Nova RVDD é gerada com o QR Code apontando para diploma.ficcassilandia.com.br</li>
                <li>• O código de validação original (1606.694.XXXXXX) permanece o mesmo</li>
              </ul>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-100">
              {[
                { id: "lote", label: "Migração em Lote", icone: Package,
                  desc: "Importar múltiplos diplomas por pastas" },
                { id: "individual", label: "Migração Individual", icone: User,
                  desc: "Migrar um diploma específico" },
              ].map((tab) => {
                const Icone = tab.icone;
                const ativo = aba === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAba(tab.id as "lote" | "individual")}
                    className={`flex-1 flex items-center gap-3 px-6 py-4 transition-colors text-left ${
                      ativo
                        ? "bg-indigo-50 border-b-2 border-indigo-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      ativo ? "bg-indigo-100" : "bg-gray-100"
                    }`}>
                      <Icone size={15} className={ativo ? "text-indigo-600" : "text-gray-500"} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${ativo ? "text-indigo-700" : "text-gray-700"}`}>
                        {tab.label}
                      </p>
                      <p className="text-xs text-gray-400">{tab.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo da aba */}
            <div className="p-6">
              {aba === "lote" ? (
                <AbaLote
                  onJobChange={setJobAtivo}
                  onContextoChange={handleContextoChange}
                  onMensagemAutomatica={setMensagemAutomatica}
                  importacaoConfirmada={importacaoConfirmada}
                  onImportacaoIniciada={handleImportacaoIniciada}
                  crossRefExterno={crossRefAtual}
                />
              ) : (
                <AbaIndividual />
              )}
            </div>
          </div>
        </div>

        {/* ── Coluna lateral: Assistente de IA ─────────────────────────────── */}
        <div className="w-full xl:w-[380px] xl:sticky xl:top-6 flex-shrink-0">
          <AssistenteMigracao
            contexto={contextoIA}
            onConfirmarImportacao={handleConfirmarImportacao}
            onMapeamento={handleMapeamentoIA}
            mensagemAutomatica={mensagemAutomatica}
            className="h-auto"
          />
        </div>

      </div>
    </div>
  );
}
