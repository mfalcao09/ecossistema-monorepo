"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Image,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
} from "lucide-react";

interface CredenciamentoFields {
  tipo_credenciamento: string;
  numero_credenciamento: string;
  data_credenciamento: string;
  veiculo_publicacao: string;
  numero_dou: string;
  data_publicacao_dou: string;
  secao_dou: string;
  pagina_dou: string;
}

interface SmartUploadCredenciamentoProps {
  onDataExtracted: (data: Partial<CredenciamentoFields>) => void;
}

interface UploadedFile {
  file: File;
  preview?: string;
  status: "uploading" | "processed" | "image_preview" | "error";
  errorMsg?: string;
}

// ============================================================
// EXTRAÇÃO DE TEXTO DE PDF NO NAVEGADOR
// Usa pdfjs-dist via CDN (carregado dinamicamente)
// Funciona 100% no cliente — sem dependência do servidor
// ============================================================
async function extrairTextoPDFNoBrowser(file: File): Promise<string> {
  try {
    // Carrega pdf.js do CDN (versão legacy para máxima compatibilidade)
    const pdfjsVersion = "4.4.168";
    const cdnBase = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}`;

    // Verifica se já foi carregado
    const win = window as unknown as Record<string, unknown>;
    if (!win.pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `${cdnBase}/pdf.min.mjs`;
        script.type = "module";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Falha ao carregar pdf.js"));
        document.head.appendChild(script);
      });
    }

    // Fallback: carrega via import dinâmico
    const pdfjsLib = await import(
      /* webpackIgnore: true */
      `${cdnBase}/pdf.min.mjs`
    );

    // Configura o worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.mjs`;

    // Lê o arquivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    });

    const doc = await loadingTask.promise;
    const textParts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: Record<string, unknown>) => "str" in item)
        .map((item: Record<string, unknown>) => item.str as string)
        .join(" ");
      textParts.push(pageText);
    }

    await doc.destroy();
    return textParts.join("\n");
  } catch (err) {
    console.error("Erro ao extrair texto do PDF no browser:", err);
    return "";
  }
}

export default function SmartUploadCredenciamento({
  onDataExtracted,
}: SmartUploadCredenciamentoProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    confianca: string;
    campos_encontrados: string[];
    texto_extraido?: string;
  } | null>(null);
  const [showImageText, setShowImageText] = useState(false);
  const [imageText, setImageText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CAMPO_LABELS: Record<string, string> = {
    tipo_credenciamento: "Tipo de ato",
    numero_credenciamento: "Número",
    data_credenciamento: "Data do ato",
    veiculo_publicacao: "Veículo",
    numero_dou: "Nº DOU",
    data_publicacao_dou: "Data publicação",
    secao_dou: "Seção",
    pagina_dou: "Página",
  };

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const uf: UploadedFile = { file, status: "uploading" };

      if (file.type.startsWith("image/")) {
        uf.preview = URL.createObjectURL(file);
      }

      newFiles.push(uf);
    }

    setFiles((prev) => [...prev, ...newFiles]);

    for (const uf of newFiles) {
      await processFile(uf);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function processFile(uf: UploadedFile) {
    setProcessing(true);

    try {
      // Para imagens: mostra preview e pede texto manual
      if (uf.file.type.startsWith("image/")) {
        uf.status = "image_preview";
        setFiles((prev) => [...prev]);
        setShowImageText(true);
        setProcessing(false);
        return;
      }

      // Para PDFs: extrai texto NO NAVEGADOR e envia para a API
      if (uf.file.type === "application/pdf") {
        const textoExtraido = await extrairTextoPDFNoBrowser(uf.file);

        if (!textoExtraido.trim()) {
          uf.status = "error";
          uf.errorMsg = "PDF sem texto extraível (pode ser imagem escaneada)";
          setFiles((prev) => [...prev]);
          setProcessing(false);
          return;
        }

        // Envia o texto já extraído para a API (que só faz o parsing regex)
        await enviarTextoParaAPI(textoExtraido, uf);
        return;
      }

      // Para outros arquivos de texto
      const texto = await uf.file.text();
      await enviarTextoParaAPI(texto, uf);
    } catch {
      uf.status = "error";
      setFiles((prev) => [...prev]);
    } finally {
      setProcessing(false);
    }
  }

  async function enviarTextoParaAPI(texto: string, uf: UploadedFile) {
    const formData = new FormData();
    formData.append("texto", texto);

    const response = await fetch("/api/processar-documento", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.campos_encontrados?.length > 0) {
      uf.status = "processed";
      setFiles((prev) => [...prev]);

      const extracted: Partial<CredenciamentoFields> = {};
      if (data.tipo_credenciamento) extracted.tipo_credenciamento = data.tipo_credenciamento;
      if (data.numero_credenciamento) extracted.numero_credenciamento = data.numero_credenciamento;
      if (data.data_credenciamento) extracted.data_credenciamento = data.data_credenciamento;
      if (data.veiculo_publicacao) extracted.veiculo_publicacao = data.veiculo_publicacao;
      if (data.numero_dou) extracted.numero_dou = data.numero_dou;
      if (data.data_publicacao_dou) extracted.data_publicacao_dou = data.data_publicacao_dou;
      if (data.secao_dou) extracted.secao_dou = data.secao_dou;
      if (data.pagina_dou) extracted.pagina_dou = data.pagina_dou;

      onDataExtracted(extracted);
      setResult(data);
    } else {
      uf.status = "error";
      uf.errorMsg = "Nenhum dado de credenciamento encontrado no texto";
      setFiles((prev) => [...prev]);
    }
  }

  async function handleProcessImageText() {
    if (!imageText.trim()) return;

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("texto", imageText);

      const response = await fetch("/api/processar-documento", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.campos_encontrados?.length > 0) {
        const extracted: Partial<CredenciamentoFields> = {};
        if (data.tipo_credenciamento) extracted.tipo_credenciamento = data.tipo_credenciamento;
        if (data.numero_credenciamento) extracted.numero_credenciamento = data.numero_credenciamento;
        if (data.data_credenciamento) extracted.data_credenciamento = data.data_credenciamento;
        if (data.veiculo_publicacao) extracted.veiculo_publicacao = data.veiculo_publicacao;
        if (data.numero_dou) extracted.numero_dou = data.numero_dou;
        if (data.data_publicacao_dou) extracted.data_publicacao_dou = data.data_publicacao_dou;
        if (data.secao_dou) extracted.secao_dou = data.secao_dou;
        if (data.pagina_dou) extracted.pagina_dou = data.pagina_dou;

        onDataExtracted(extracted);
        setResult(data);
        setShowImageText(false);

        // Marca imagens como processadas
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "image_preview" ? { ...f, status: "processed" } : f
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setProcessing(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt.files) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < dt.files.length; i++) {
          dataTransfer.items.add(dt.files[i]);
        }
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  const confiancaColors = {
    alta: "bg-green-100 text-green-700 border-green-300",
    media: "bg-amber-100 text-amber-700 border-amber-300",
    baixa: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl p-4 text-center transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          <span className="text-primary-500 font-medium">Clique aqui</span> ou arraste arquivos
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDFs do DOU, prints do e-MEC, portarias (PDF, PNG, JPG)
        </p>
      </div>

      {/* Lista de arquivos */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 text-sm"
            >
              {uf.file.type.startsWith("image/") ? (
                <Image size={18} className="text-blue-500 shrink-0" />
              ) : (
                <FileText size={18} className="text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-gray-700 truncate block">{uf.file.name}</span>
                {uf.errorMsg && (
                  <span className="text-xs text-red-500">{uf.errorMsg}</span>
                )}
              </div>

              {uf.status === "uploading" && (
                <Loader2 size={16} className="animate-spin text-primary-500" />
              )}
              {uf.status === "processed" && (
                <CheckCircle2 size={16} className="text-green-500" />
              )}
              {uf.status === "image_preview" && (
                <Eye size={16} className="text-blue-500" />
              )}
              {uf.status === "error" && (
                <AlertCircle size={16} className="text-red-500" />
              )}

              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview de imagem + campo de texto */}
      {showImageText && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          {files.filter((f) => f.preview).map((f, idx) => (
            <div key={idx} className="rounded-lg overflow-hidden border border-blue-200 max-h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.preview}
                alt="Preview do documento"
                className="w-full h-auto max-h-48 object-contain bg-white"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
              <Sparkles size={12} />
              Cole aqui o texto visível na imagem
            </label>
            <textarea
              value={imageText}
              onChange={(e) => setImageText(e.target.value)}
              rows={4}
              placeholder="Ex: PORTARIA Nº 1.234, DE 15 DE MARÇO DE 2020. Publicado no DOU nº 52, Seção 1, página 45..."
              className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={handleProcessImageText}
            disabled={processing || !imageText.trim()}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            {processing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Processar texto
          </button>
        </div>
      )}

      {/* Resultado do processamento */}
      {result && result.campos_encontrados.length > 0 && (
        <div className={`rounded-xl p-3 border ${confiancaColors[result.confianca as keyof typeof confiancaColors] || confiancaColors.baixa}`}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} />
            <span className="text-xs font-bold uppercase">
              {result.campos_encontrados.length} campos extraídos
              {" "}— confiança {result.confianca}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.campos_encontrados.map((campo) => (
              <span
                key={campo}
                className="text-xs bg-white/60 rounded px-2 py-0.5"
              >
                {CAMPO_LABELS[campo] || campo}
              </span>
            ))}
          </div>
        </div>
      )}

      {processing && (
        <div className="flex items-center gap-2 text-xs text-primary-600">
          <Loader2 size={14} className="animate-spin" />
          Extraindo texto do documento...
        </div>
      )}
    </div>
  );
}
