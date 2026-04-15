"use client";

import { useEffect, useState } from "react";
import {
  LayoutTemplate, Plus, Edit3, Eye, ToggleLeft, ToggleRight,
  FileText, AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";
import type { AcervoTemplate, TemplateVariaveis } from "@/types/acervo";

// ── Templates padrão de exemplo para criação rápida ───────
const TEMPLATES_EXEMPLO: Array<{
  nome: string;
  tipo: string;
  descricao: string;
  orientacao_pdf: "portrait" | "landscape";
  variaveis: TemplateVariaveis;
  conteudo_html: string;
}> = [
  {
    nome: "Declaração de Matrícula",
    tipo: "declaracao_matricula",
    descricao: "Declara que o aluno está regularmente matriculado",
    orientacao_pdf: "portrait",
    variaveis: {
      curso: { label: "Curso", tipo: "text", obrigatorio: true, placeholder: "Ex: Administração" },
      semestre: { label: "Semestre atual", tipo: "text", obrigatorio: true, placeholder: "Ex: 1º Semestre" },
      finalidade: { label: "Finalidade", tipo: "text", obrigatorio: false, placeholder: "Ex: fins de emprego" },
    },
    conteudo_html: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Faculdades Integradas de Cassilândia — FIC</h2>
    <h1 style="font-size: 22px; font-weight: bold; margin-top: 8px;">DECLARAÇÃO DE MATRÍCULA</h1>
  </div>
  <p style="text-align: justify; line-height: 1.8; font-size: 14px;">
    Declaramos, para os devidos fins{{#if finalidade}} de <strong>{{finalidade}}</strong>{{/if}}, que
    <strong>{{destinatario_nome}}</strong>{{#if destinatario_cpf}}, CPF <strong>{{destinatario_cpf}}</strong>,{{/if}}
    encontra-se regularmente matriculado(a) no curso de <strong>{{curso}}</strong>,
    no <strong>{{semestre}}</strong> do ano letivo de <strong>{{ano_emissao}}</strong>,
    nesta Instituição de Ensino Superior.
  </p>
  <p style="text-align: justify; line-height: 1.8; font-size: 14px; margin-top: 16px;">
    Por ser verdade, firmamos a presente declaração.
  </p>
  <div style="margin-top: 60px; text-align: center;">
    <p style="font-size: 13px;">Cassilândia/MS, {{data_emissao}}</p>
  </div>
  <div style="margin-top: 60px; text-align: center; border-top: 1px solid #333; width: 300px; margin-left: auto; margin-right: auto; padding-top: 8px;">
    <p style="font-size: 13px; font-weight: bold;">Secretaria Acadêmica</p>
    <p style="font-size: 12px; color: #666;">Faculdades Integradas de Cassilândia</p>
  </div>
</div>`,
  },
  {
    nome: "Atestado de Conclusão de Curso",
    tipo: "atestado_conclusao",
    descricao: "Atesta que o aluno concluiu o curso",
    orientacao_pdf: "portrait",
    variaveis: {
      curso: { label: "Curso", tipo: "text", obrigatorio: true, placeholder: "Ex: Administração" },
      data_colacao: { label: "Data da Colação de Grau", tipo: "date", obrigatorio: true },
      finalidade: { label: "Finalidade", tipo: "text", obrigatorio: false, placeholder: "Ex: fins de emprego" },
    },
    conteudo_html: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Faculdades Integradas de Cassilândia — FIC</h2>
    <h1 style="font-size: 22px; font-weight: bold; margin-top: 8px;">ATESTADO DE CONCLUSÃO DE CURSO</h1>
  </div>
  <p style="text-align: justify; line-height: 1.8; font-size: 14px;">
    Atestamos, para os devidos fins{{#if finalidade}} de <strong>{{finalidade}}</strong>{{/if}}, que
    <strong>{{destinatario_nome}}</strong>{{#if destinatario_cpf}}, CPF <strong>{{destinatario_cpf}}</strong>,{{/if}}
    concluiu com aprovação todos os créditos exigidos para a obtenção do grau de
    Bacharel em <strong>{{curso}}</strong>, tendo colado grau em <strong>{{data_colacao}}</strong>.
  </p>
  <p style="text-align: justify; line-height: 1.8; font-size: 14px; margin-top: 16px;">
    O Diploma Digital está em processo de emissão conforme Portaria MEC 70/2025.
  </p>
  <div style="margin-top: 60px; text-align: center;">
    <p style="font-size: 13px;">Cassilândia/MS, {{data_emissao}}</p>
  </div>
  <div style="margin-top: 60px; text-align: center; border-top: 1px solid #333; width: 300px; margin-left: auto; margin-right: auto; padding-top: 8px;">
    <p style="font-size: 13px; font-weight: bold;">Secretaria Acadêmica</p>
    <p style="font-size: 12px; color: #666;">Faculdades Integradas de Cassilândia</p>
  </div>
</div>`,
  },
];

// ── Card de template ──────────────────────────────────────
function CardTemplate({
  template,
  onToggle,
  onEmitir,
}: {
  template: AcervoTemplate;
  onToggle: () => void;
  onEmitir: () => void;
}) {
  const varCount = Object.keys(template.variaveis ?? {}).length;
  const obrigCount = Object.values(template.variaveis ?? {}).filter((v) => v.obrigatorio).length;

  return (
    <div className={`bg-white border rounded-xl p-5 transition-all ${
      template.ativo ? "border-gray-200" : "border-gray-100 opacity-60"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={15} className={template.ativo ? "text-teal-600" : "text-gray-400"} />
            <h3 className="text-sm font-bold text-gray-900 truncate">{template.nome}</h3>
          </div>
          <p className="text-xs text-gray-400">
            {TIPO_DOC_LABELS[template.tipo as keyof typeof TIPO_DOC_LABELS] ?? template.tipo}
            {" · "}{template.orientacao_pdf === "landscape" ? "Paisagem" : "Retrato"}
            {" · "}{template.formato_papel}
            {" · "}v{template.versao}
          </p>
        </div>
        <button
          onClick={onToggle}
          title={template.ativo ? "Desativar template" : "Ativar template"}
          className={`flex-shrink-0 transition-colors ${
            template.ativo ? "text-teal-500 hover:text-teal-700" : "text-gray-300 hover:text-gray-500"
          }`}
        >
          {template.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

      {template.descricao && (
        <p className="text-xs text-gray-500 mb-3">{template.descricao}</p>
      )}

      {/* Variáveis */}
      {varCount > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1.5">
            {varCount} campo{varCount !== 1 ? "s" : ""} ·{" "}
            {obrigCount} obrigatório{obrigCount !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(template.variaveis ?? {}).map(([key, def]) => (
              <span
                key={key}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  def.obrigatorio
                    ? "bg-teal-50 text-teal-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {def.obrigatorio ? "* " : ""}{def.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={onEmitir}
          disabled={!template.ativo}
          className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={13} /> Emitir documento
        </button>
      </div>
    </div>
  );
}

// ── Modal para emitir a partir de template ────────────────
function ModalEmitir({
  template,
  onClose,
  onSucesso,
}: {
  template: AcervoTemplate;
  onClose: () => void;
  onSucesso: (docId: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [destinatarioCpf, setDestinatarioCpf] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinatarioNome) { setErro("Nome do destinatário é obrigatório."); return; }
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/acervo/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          destinatario_nome: destinatarioNome,
          destinatario_cpf: destinatarioCpf || undefined,
          variaveis_valores: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSucesso(data.documento_id);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Emitir: {template.nome}</h2>
            <p className="text-xs text-gray-400">
              {TIPO_DOC_LABELS[template.tipo as keyof typeof TIPO_DOC_LABELS] ?? template.tipo}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{erro}</div>
          )}

          {/* Destinatário */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Destinatário</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Nome do aluno"
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CPF</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="000.000.000-00"
                value={destinatarioCpf}
                onChange={(e) => setDestinatarioCpf(e.target.value)}
              />
            </div>
          </div>

          {/* Variáveis do template */}
          {Object.keys(template.variaveis ?? {}).length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Dados do documento
              </p>
              {Object.entries(template.variaveis ?? {}).map(([key, def]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {def.label}
                    {def.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {def.tipo === "textarea" ? (
                    <textarea
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                      placeholder={def.placeholder ?? ""}
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  ) : def.tipo === "select" ? (
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {def.opcoes?.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <input
                      type={def.tipo === "date" ? "date" : "text"}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      placeholder={def.placeholder ?? ""}
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {enviando ? "Emitindo..." : "Emitir documento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal criar template exemplo ──────────────────────────
function ModalCriarExemplo({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const handleCriar = async () => {
    if (selecionado === null) return;
    setCriando(true);
    setErro("");
    try {
      const res = await fetch("/api/acervo/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEMPLATES_EXEMPLO[selecionado]),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCriado();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Criar template a partir de exemplo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {erro && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{erro}</div>}

          <p className="text-xs text-gray-500">Selecione um template base para começar:</p>

          <div className="space-y-2">
            {TEMPLATES_EXEMPLO.map((tmpl, i) => (
              <button
                key={i}
                onClick={() => setSelecionado(i)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                  selecionado === i
                    ? "border-teal-400 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{tmpl.nome}</p>
                <p className="text-xs text-gray-400">{tmpl.descricao}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCriar}
              disabled={selecionado === null || criando}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {criando ? "Criando..." : "Criar template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<AcervoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalEmitir, setModalEmitir] = useState<AcervoTemplate | null>(null);
  const [docEmitido, setDocEmitido] = useState<string | null>(null);

  const carregarTemplates = () => {
    setLoading(true);
    fetch("/api/acervo/templates?incluir_inativos=1")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregarTemplates(); }, []);

  const handleToggle = async (template: AcervoTemplate) => {
    // Otimista
    setTemplates((prev) =>
      prev.map((t) => t.id === template.id ? { ...t, ativo: !t.ativo } : t)
    );
    try {
      const supabase = await import("@/lib/supabase/client").then((m) => m.createClient());
      await supabase.from("acervo_templates").update({ ativo: !template.ativo }).eq("id", template.id);
    } catch {
      // Reverte
      setTemplates((prev) =>
        prev.map((t) => t.id === template.id ? { ...t, ativo: template.ativo } : t)
      );
    }
  };

  const handleDocEmitido = (docId: string) => {
    setModalEmitir(null);
    setDocEmitido(docId);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutTemplate size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Templates de Documentos</h1>
          </div>
          <p className="text-sm text-gray-500">
            Modelos para emissão de documentos nato-digitais (declarações, atestados, etc.)
          </p>
        </div>
        <button
          onClick={() => setModalCriar(true)}
          className="flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} /> Novo template
        </button>
      </div>

      {/* Aviso se emissão bem-sucedida */}
      {docEmitido && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-800 font-semibold">Documento emitido com sucesso!</p>
            <p className="text-xs text-green-600">
              ID: {docEmitido} · Aguardando assinatura ICP-Brasil
            </p>
          </div>
          <button onClick={() => setDocEmitido(null)} className="text-green-400 hover:text-green-700 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Aviso sem templates */}
      {!loading && templates.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Nenhum template cadastrado. Crie um a partir dos exemplos pré-configurados ou desenvolva um template personalizado com HTML.
          </p>
        </div>
      )}

      {/* Grid de templates */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <CardTemplate
              key={template.id}
              template={template}
              onToggle={() => handleToggle(template)}
              onEmitir={() => setModalEmitir(template)}
            />
          ))}
        </div>
      )}

      {/* Info sobre HTML */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Como funcionam os templates
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-500">
          <div className="flex items-start gap-2">
            <span className="text-teal-500 font-bold mt-0.5">1</span>
            <p>Templates são escritos em HTML. Variáveis são substituídas como <code className="bg-gray-100 px-1 rounded">{"{{nome_variavel}}"}</code></p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-teal-500 font-bold mt-0.5">2</span>
            <p>Ao emitir, o sistema renderiza o HTML, gera o PDF e registra o documento com código de verificação</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-teal-500 font-bold mt-0.5">3</span>
            <p>O documento aguarda assinatura ICP-Brasil e é publicado no portal de verificação</p>
          </div>
        </div>
      </div>

      {/* Modais */}
      {modalCriar && (
        <ModalCriarExemplo
          onClose={() => setModalCriar(false)}
          onCriado={() => { setModalCriar(false); carregarTemplates(); }}
        />
      )}

      {modalEmitir && (
        <ModalEmitir
          template={modalEmitir}
          onClose={() => setModalEmitir(null)}
          onSucesso={handleDocEmitido}
        />
      )}
    </div>
  );
}
