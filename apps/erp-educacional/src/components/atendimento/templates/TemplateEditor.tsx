"use client";

/**
 * TemplateEditor — modal 3-step para criar templates WABA.
 *
 * Step 1: nome + categoria + language
 * Step 2: componentes (HEADER/BODY/FOOTER/BUTTONS)
 * Step 3: preview + botão "Enviar para aprovação Meta"
 *
 * Regra Meta: botões são mutuamente exclusivos — QUICK_REPLY ou CTA, não os dois.
 */

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Send } from "lucide-react";
import TemplatePreview from "./TemplatePreview";
import type { MetaComponent } from "@/lib/atendimento/meta-templates";

interface Inbox {
  id: string;
  name: string;
}

interface Props {
  inboxes: Inbox[];
  onClose: () => void;
  onSaved: (templateId: string) => void;
}

type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";
type ButtonMode = "none" | "quick_reply" | "cta";

interface QuickReplyBtn { text: string }
interface CtaBtn { type: "URL" | "PHONE_NUMBER"; text: string; url?: string; phone?: string }

export default function TemplateEditor({ inboxes, onClose, onSaved }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [inboxId, setInboxId] = useState(inboxes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("UTILITY");
  const [language, setLanguage] = useState("pt_BR");

  // Step 2
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttonMode, setButtonMode] = useState<ButtonMode>("none");
  const [quickReplies, setQuickReplies] = useState<QuickReplyBtn[]>([]);
  const [ctaButtons, setCtaButtons] = useState<CtaBtn[]>([]);

  // Validações
  const nameValid = /^[a-z0-9_]+$/.test(name) && name.length >= 3;
  const bodyValid = bodyText.trim().length > 0;
  const step1Valid = nameValid && !!inboxId;
  const step2Valid = bodyValid;

  const components: MetaComponent[] = [];
  if (headerText.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
  }
  if (bodyText.trim()) {
    components.push({ type: "BODY", text: bodyText.trim() });
  }
  if (footerText.trim()) {
    components.push({ type: "FOOTER", text: footerText.trim() });
  }
  if (buttonMode === "quick_reply" && quickReplies.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: quickReplies.map((b) => ({ type: "QUICK_REPLY" as const, text: b.text })),
    });
  } else if (buttonMode === "cta" && ctaButtons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: ctaButtons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.type === "URL" ? { url: b.url ?? "" } : {}),
        ...(b.type === "PHONE_NUMBER" ? { phone_number: b.phone ?? "" } : {}),
      })),
    });
  }

  async function handleSave(submitToMeta: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/atendimento/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inbox_id: inboxId, name, category, language, components }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Erro ${res.status}`);
      }
      const { template } = await res.json();

      if (submitToMeta) {
        const subRes = await fetch(`/api/atendimento/templates/${template.id}/submit`, {
          method: "POST",
        });
        if (!subRes.ok) {
          const j = await subRes.json().catch(() => ({}));
          throw new Error(`Salvo como rascunho, mas Meta recusou: ${j.error ?? subRes.status}`);
        }
      }
      onSaved(template.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">Criar template WABA</h2>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
              <StepDot active={step >= 1} done={step > 1}>1</StepDot>
              <span>Dados</span>
              <div className="w-6 h-px bg-gray-300" />
              <StepDot active={step >= 2} done={step > 2}>2</StepDot>
              <span>Componentes</span>
              <div className="w-6 h-px bg-gray-300" />
              <StepDot active={step >= 3}>3</StepDot>
              <span>Revisar</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            {step === 1 && (
              <Step1
                inboxes={inboxes}
                inboxId={inboxId}
                name={name}
                category={category}
                language={language}
                nameValid={nameValid}
                onChange={{ setInboxId, setName, setCategory, setLanguage }}
              />
            )}
            {step === 2 && (
              <Step2
                headerText={headerText}
                bodyText={bodyText}
                footerText={footerText}
                buttonMode={buttonMode}
                quickReplies={quickReplies}
                ctaButtons={ctaButtons}
                onChange={{
                  setHeaderText,
                  setBodyText,
                  setFooterText,
                  setButtonMode,
                  setQuickReplies,
                  setCtaButtons,
                }}
              />
            )}
            {step === 3 && (
              <Step3
                name={name}
                category={category}
                language={language}
                componentsCount={components.length}
                error={error}
              />
            )}
          </div>

          <div className="md:sticky md:top-0">
            <div className="text-xs text-gray-500 mb-2 font-medium">Preview</div>
            <TemplatePreview components={components} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              <ChevronLeft size={14} /> Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !step1Valid : !step2Valid}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={submitting}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-40"
              >
                Salvar rascunho
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                <Send size={14} /> Enviar para Meta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

function StepDot({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <span
      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done
          ? "bg-green-600 text-white"
          : active
            ? "bg-green-100 text-green-700 border border-green-500"
            : "bg-gray-200 text-gray-500"
      }`}
    >
      {children}
    </span>
  );
}

function Step1({
  inboxes,
  inboxId,
  name,
  category,
  language,
  nameValid,
  onChange,
}: {
  inboxes: Inbox[];
  inboxId: string;
  name: string;
  category: Category;
  language: string;
  nameValid: boolean;
  onChange: {
    setInboxId: (v: string) => void;
    setName: (v: string) => void;
    setCategory: (v: Category) => void;
    setLanguage: (v: string) => void;
  };
}) {
  return (
    <div className="space-y-4">
      <Field label="Inbox (canal WhatsApp)">
        <select
          value={inboxId}
          onChange={(e) => onChange.setInboxId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {inboxes.length === 0 && <option value="">— nenhum canal WhatsApp habilitado —</option>}
          {inboxes.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Nome (apenas minúsculas, números e _)">
        <input
          value={name}
          onChange={(e) => onChange.setName(e.target.value.toLowerCase())}
          placeholder="fic_boas_vindas_matricula"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
        {!nameValid && name && (
          <p className="text-[11px] text-red-600 mt-1">
            Use apenas minúsculas, números e underscore (mín. 3 caracteres)
          </p>
        )}
      </Field>

      <Field label="Categoria">
        <div className="grid grid-cols-3 gap-2">
          {(["UTILITY", "MARKETING", "AUTHENTICATION"] as const).map((c) => (
            <button
              key={c}
              onClick={() => onChange.setCategory(c)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                category === c
                  ? "bg-green-50 border-green-500 text-green-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c === "UTILITY" ? "Utilitário" : c === "MARKETING" ? "Marketing" : "Autenticação"}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Idioma">
        <select
          value={language}
          onChange={(e) => onChange.setLanguage(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="pt_BR">Português (Brasil)</option>
          <option value="en_US">English (US)</option>
          <option value="es_ES">Español</option>
        </select>
      </Field>
    </div>
  );
}

function Step2({
  headerText,
  bodyText,
  footerText,
  buttonMode,
  quickReplies,
  ctaButtons,
  onChange,
}: {
  headerText: string;
  bodyText: string;
  footerText: string;
  buttonMode: ButtonMode;
  quickReplies: QuickReplyBtn[];
  ctaButtons: CtaBtn[];
  onChange: {
    setHeaderText: (v: string) => void;
    setBodyText: (v: string) => void;
    setFooterText: (v: string) => void;
    setButtonMode: (v: ButtonMode) => void;
    setQuickReplies: (v: QuickReplyBtn[]) => void;
    setCtaButtons: (v: CtaBtn[]) => void;
  };
}) {
  return (
    <div className="space-y-3">
      <Field label="Cabeçalho (opcional, máx 60 chars)">
        <input
          value={headerText}
          maxLength={60}
          onChange={(e) => onChange.setHeaderText(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: FIC — Matrícula 2026/2"
        />
      </Field>

      <Field label="Corpo * (use {{1}}, {{2}} para variáveis)">
        <textarea
          value={bodyText}
          onChange={(e) => onChange.setBodyText(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Olá {{1}}, vi seu interesse em {{2}}. Posso ajudar?"
        />
      </Field>

      <Field label="Rodapé (opcional, máx 60 chars)">
        <input
          value={footerText}
          maxLength={60}
          onChange={(e) => onChange.setFooterText(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="FIC — Faculdades Integradas de Cassilândia"
        />
      </Field>

      <Field label="Botões (exclusivos — Quick Reply OU CTA)">
        <div className="flex items-center gap-2 mb-2">
          {(["none", "quick_reply", "cta"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange.setButtonMode(m)}
              className={`px-2.5 py-1 text-[11px] rounded-md border ${
                buttonMode === m
                  ? "bg-green-50 border-green-500 text-green-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {m === "none" ? "Nenhum" : m === "quick_reply" ? "Quick Reply" : "CTA"}
            </button>
          ))}
        </div>

        {buttonMode === "quick_reply" && (
          <div className="space-y-1.5">
            {quickReplies.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={b.text}
                  onChange={(e) => {
                    const next = [...quickReplies];
                    next[i] = { text: e.target.value };
                    onChange.setQuickReplies(next);
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  placeholder="Texto do botão"
                  maxLength={25}
                />
                <button
                  onClick={() =>
                    onChange.setQuickReplies(quickReplies.filter((_, idx) => idx !== i))
                  }
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {quickReplies.length < 3 && (
              <button
                onClick={() => onChange.setQuickReplies([...quickReplies, { text: "" }])}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
              >
                <Plus size={12} /> Adicionar quick reply
              </button>
            )}
          </div>
        )}

        {buttonMode === "cta" && (
          <div className="space-y-1.5">
            {ctaButtons.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={b.type}
                  onChange={(e) => {
                    const next = [...ctaButtons];
                    next[i] = { ...b, type: e.target.value as CtaBtn["type"] };
                    onChange.setCtaButtons(next);
                  }}
                  className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs"
                >
                  <option value="URL">URL</option>
                  <option value="PHONE_NUMBER">Telefone</option>
                </select>
                <input
                  value={b.text}
                  onChange={(e) => {
                    const next = [...ctaButtons];
                    next[i] = { ...b, text: e.target.value };
                    onChange.setCtaButtons(next);
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  placeholder="Texto do botão"
                  maxLength={25}
                />
                <input
                  value={b.type === "URL" ? b.url ?? "" : b.phone ?? ""}
                  onChange={(e) => {
                    const next = [...ctaButtons];
                    next[i] =
                      b.type === "URL"
                        ? { ...b, url: e.target.value }
                        : { ...b, phone: e.target.value };
                    onChange.setCtaButtons(next);
                  }}
                  className="w-36 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono"
                  placeholder={b.type === "URL" ? "https://..." : "+5567..."}
                />
                <button
                  onClick={() =>
                    onChange.setCtaButtons(ctaButtons.filter((_, idx) => idx !== i))
                  }
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {ctaButtons.length < 2 && (
              <button
                onClick={() =>
                  onChange.setCtaButtons([...ctaButtons, { type: "URL", text: "" }])
                }
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
              >
                <Plus size={12} /> Adicionar CTA
              </button>
            )}
          </div>
        )}
      </Field>
    </div>
  );
}

function Step3({
  name,
  category,
  language,
  componentsCount,
  error,
}: {
  name: string;
  category: Category;
  language: string;
  componentsCount: number;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        <Row label="Nome" value={name} />
        <Row label="Categoria" value={category} />
        <Row label="Idioma" value={language} />
        <Row label="Componentes" value={`${componentsCount} bloco(s)`} />
      </div>

      <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
        ⏱ Após enviar para a Meta, aguarde <strong>24-48h</strong> para aprovação.
        Enquanto isso o template ficará com status <code>PENDING</code>.
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
