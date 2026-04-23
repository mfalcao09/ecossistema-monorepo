"use client";

import { useState, useRef } from "react";
import {
  BookOpen,
  Upload,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  X,
} from "lucide-react";

interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  source_url: string | null;
  created_at: string;
}

interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  score: number;
}

interface KnowledgePanelProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function KnowledgePanel({
  agentId,
  agentName,
  onClose,
}: KnowledgePanelProps) {
  const [chunks, setChunks] = useState<KnowledgeChunk[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadOk, setUploadOk] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<RetrievedChunk[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [showTextForm, setShowTextForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadChunks() {
    setLoading(true);
    try {
      const r = await fetch(`/api/atendimento/ds-agentes/${agentId}/knowledge`);
      const j = await r.json();
      setChunks(j.chunks ?? []);
    } finally {
      setLoading(false);
    }
  }

  // Carrega na primeira vez
  if (chunks === null && !loading) loadChunks();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadOk("");
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    try {
      const r = await fetch(
        `/api/atendimento/ds-agentes/${agentId}/knowledge`,
        {
          method: "POST",
          body: form,
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Erro ao fazer upload");
      setUploadOk(
        `✅ ${j.chunks_created} chunk(s) criado(s) de "${file.name}"`,
      );
      await loadChunks();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTextIngest() {
    if (!textTitle.trim() || !textContent.trim()) return;
    setUploading(true);
    setUploadError("");
    setUploadOk("");
    try {
      const r = await fetch(
        `/api/atendimento/ds-agentes/${agentId}/knowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: textTitle.trim(),
            content: textContent.trim(),
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Erro");
      setUploadOk(`✅ ${j.chunks_created} chunk(s) criado(s)`);
      setTextTitle("");
      setTextContent("");
      setShowTextForm(false);
      await loadChunks();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(chunkId: string) {
    if (!confirm("Remover este chunk da base de conhecimento?")) return;
    await fetch(`/api/atendimento/ds-agentes/${agentId}/knowledge/${chunkId}`, {
      method: "DELETE",
    });
    setChunks((prev) => (prev ?? []).filter((c) => c.id !== chunkId));
  }

  async function handleTestRetrieval() {
    if (!testQuery.trim()) return;
    setTesting(true);
    try {
      const r = await fetch(`/api/atendimento/ds-agentes/${agentId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_text: testQuery, dry_run: true }),
      });
      const j = await r.json();
      setTestResults(j.rag_chunks ?? []);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-indigo-600" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">
                Base de Conhecimento
              </h2>
              <p className="text-xs text-gray-400">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Upload */}
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700 mb-3">
              Adicionar conhecimento
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Upload size={14} />
                {uploading ? "Enviando…" : "Upload arquivo (.txt, .md, .pdf)"}
              </button>
              <button
                onClick={() => setShowTextForm(!showTextForm)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <FileText size={14} /> Colar texto
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf"
              className="hidden"
              onChange={handleFileUpload}
            />

            {showTextForm && (
              <div className="mt-3 space-y-2">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Título (ex: Regulamento Acadêmico Cap. 3)"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                />
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  rows={6}
                  placeholder="Cole o conteúdo aqui…"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleTextIngest}
                    disabled={
                      uploading || !textTitle.trim() || !textContent.trim()
                    }
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {uploading ? "Processando…" : "Ingerir texto"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTextForm(false);
                      setTextTitle("");
                      setTextContent("");
                    }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {uploadOk && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                <CheckCircle2 size={14} /> {uploadOk}
              </div>
            )}
            {uploadError && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle size={14} /> {uploadError}
              </div>
            )}
          </div>

          {/* Teste de retrieval */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Testar retrieval
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Ex: Qual a data de matrícula?"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestRetrieval()}
              />
              <button
                onClick={handleTestRetrieval}
                disabled={testing || !testQuery.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                {testing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Search size={12} />
                )}
                Buscar
              </button>
            </div>
            {testResults !== null && (
              <div className="mt-3 space-y-2">
                {testResults.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Nenhum chunk encontrado acima do limiar de similaridade.
                  </p>
                ) : (
                  testResults.map((r, i) => (
                    <div
                      key={r.id}
                      className="bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          [{i + 1}] {r.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          {(r.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-3">
                        {r.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lista de chunks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">
                Chunks cadastrados ({chunks?.length ?? 0})
              </p>
              <button
                onClick={loadChunks}
                className="text-xs text-indigo-600 hover:underline"
              >
                Atualizar
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
                <Loader2 size={14} className="animate-spin" /> Carregando…
              </div>
            )}

            {!loading && (chunks ?? []).length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">
                Nenhum conhecimento cadastrado ainda. Faça upload de um
                documento.
              </p>
            )}

            <div className="space-y-2">
              {(chunks ?? []).map((chunk) => (
                <div
                  key={chunk.id}
                  className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-200 transition-colors"
                >
                  <FileText
                    size={14}
                    className="text-gray-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {chunk.title}
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                      {chunk.content}
                    </p>
                    {chunk.source_url && (
                      <p className="text-[10px] text-indigo-500 mt-0.5 truncate">
                        {chunk.source_url}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(chunk.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
