import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, ArrowLeft, ArrowRight, Send, UserPlus, Trash2 } from "lucide-react";
import { useSignatureProviders } from "@/hooks/useSignatureProviders";
import { useSignatureAuditLog } from "@/hooks/useSignatureAuditLog";
import { PROVIDER_LABELS, type SignatureProviderKey } from "@/lib/signatureProvidersDefaults";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import DocumentUploadArea, { computeSha256, type FileWithHash } from "./DocumentUploadArea";
import { EMPTY_SIGNER, type SignerData } from "./SignerForm";
import SignerEditDialog from "./SignerEditDialog";
import ObserverForm, { EMPTY_OBSERVER, type ObserverData } from "./ObserverForm";
import EnvelopeConfigSection, { DEFAULT_CONFIG, type EnvelopeConfig } from "./EnvelopeConfigSection";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departmentTeamId?: string;
  initialFiles?: File[];
}

export default function SignatureEnvelopeWizard({ open, onOpenChange, departmentTeamId, initialFiles }: Props) {
  const { enabledProviders } = useSignatureProviders();
  const { addLog } = useSignatureAuditLog(null);
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<SignatureProviderKey>("manual");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<FileWithHash[]>([]);
  const [signers, setSigners] = useState<SignerData[]>([]);
  const [observers, setObservers] = useState<ObserverData[]>([]);
  const [config, setConfig] = useState<EnvelopeConfig>({ ...DEFAULT_CONFIG });
  const [sequenceEnabled, setSequenceEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [observersOpen, setObserversOpen] = useState(false);
  const [signerDialogOpen, setSignerDialogOpen] = useState(false);
  const [editingSignerIndex, setEditingSignerIndex] = useState<number | null>(null);

  const allProviders: SignatureProviderKey[] = ["manual", ...enabledProviders as SignatureProviderKey[]];

  // Load initial files from quick upload
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      handleFilesSelected(initialFiles);
    }
  }, [open, initialFiles]);

  const handleFilesSelected = useCallback(async (newFiles: File[]) => {
    const withHash: FileWithHash[] = await Promise.all(
      newFiles.map(async (file) => {
        const hash = await computeSha256(file);
        return { file, hash };
      })
    );
    setFiles((prev) => [...prev, ...withHash]);
  }, []);

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const updateSigner = (i: number, field: keyof SignerData, val: any) => {
    setSigners((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  };
  const removeSigner = (i: number) => setSigners((p) => p.filter((_, idx) => idx !== i));

  const updateObserver = (i: number, field: keyof ObserverData, val: any) => {
    setObservers((p) => p.map((o, idx) => (idx === i ? { ...o, [field]: val } : o)));
  };
  const removeObserver = (i: number) => setObservers((p) => p.filter((_, idx) => idx !== i));

  const updateConfig = (field: keyof EnvelopeConfig, val: any) => {
    setConfig((prev) => ({ ...prev, [field]: val }));
  };

  const resetForm = () => {
    setStep(0);
    setProvider("manual");
    setTitle("");
    setFiles([]);
    setSigners([]);
    setObservers([]);
    setConfig({ ...DEFAULT_CONFIG });
    setSequenceEnabled(false);
    setObserversOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      // Create envelope
      const { data: envelope, error } = await supabase.from("legal_signature_envelopes").insert({
        title,
        provider,
        status: "rascunho",
        notes: config.email_message || null,
        tenant_id,
        created_by: user.id,
        department_team_id: departmentTeamId || null,
        signature_type: config.signature_type,
        deadline_at: config.deadline_at || null,
        reminder_interval: config.reminder_interval || null,
        locale: config.locale,
        pause_on_rejection: config.pause_on_rejection,
        closing_mode: config.closing_mode,
        email_subject: config.email_subject || null,
        email_message: config.email_message || null,
      } as any).select("id").single();
      if (error) throw error;

      // Upload documents
      for (const f of files) {
        const path = `${tenant_id}/${envelope.id}/${f.file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("signature-documents")
          .upload(path, f.file);
        if (uploadErr) console.error("Upload error:", uploadErr);

        await supabase.from("legal_signature_documents").insert({
          envelope_id: envelope.id,
          file_name: f.file.name,
          file_path: path,
          file_size: f.file.size,
          mime_type: f.file.type,
          hash_sha256: f.hash || null,
          uploaded_by: user.id,
          tenant_id,
        } as any);
      }

      // Insert signers
      const validSigners = signers.filter((s) => s.email || s.name);
      if (validSigners.length > 0) {
        const signerRows = validSigners.map((s, idx) => ({
          envelope_id: envelope.id,
          name: s.name,
          email: s.email,
          cpf: s.cpf || null,
          phone: s.phone || null,
          role: JSON.stringify(s.roles),
          auth_method: JSON.stringify(s.auth_methods),
          sign_order: sequenceEnabled ? (s.sign_order || 1) : 1,
          status: "pendente",
          tenant_id,
        }));
        const { error: sigErr } = await supabase.from("legal_signature_signers").insert(signerRows);
        if (sigErr) throw sigErr;
      }

      // Insert observers
      const validObservers = observers.filter((o) => o.email);
      if (validObservers.length > 0) {
        const obsRows = validObservers.map((o) => ({
          envelope_id: envelope.id,
          name: o.name || null,
          email: o.email,
          notify_on: o.notify_on,
          receive_final: o.receive_final,
          tenant_id,
        }));
        await supabase.from("legal_signature_observers").insert(obsRows as any);
      }

      // Audit log
      addLog.mutate({
        envelopeId: envelope.id,
        action: "criado",
        details: { provider, signature_type: config.signature_type, signers_count: validSigners.length, documents_count: files.length },
      });

      qc.invalidateQueries({ queryKey: ["signature-envelopes"] });
      qc.invalidateQueries({ queryKey: ["signature-kpis"] });
      toast.success("Envelope criado com sucesso!");
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar envelope");
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ["Documentos", "Signatários", "Configurações", "Plataforma", "Revisão"];

  const canGoNext = () => {
    if (step === 0) return files.length > 0 && title.trim().length > 0;
    if (step === 1) return signers.some((s) => s.email || s.name);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Envelope de Assinatura</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STEPS.map((label, i) => (
            <Badge key={i} variant={step === i ? "default" : "outline"} className="text-xs cursor-pointer" onClick={() => i < step && setStep(i)}>
              {i + 1}. {label}
            </Badge>
          ))}
        </div>

        {/* Step 0: Documents */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Envelope *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Contrato de Locação - João Silva" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Documentos *</Label>
              <p className="text-xs text-muted-foreground mb-2">O hash SHA-256 é calculado automaticamente para garantia de integridade.</p>
              <DocumentUploadArea
                onFilesSelected={handleFilesSelected}
                files={files}
                onRemoveFile={removeFile}
              />
            </div>
          </div>
        )}

        {/* Step 1: Signers */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Signatários</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Ordem de assinatura</Label>
                  <Switch checked={sequenceEnabled} onCheckedChange={setSequenceEnabled} />
                </div>
                <Button size="sm" variant="outline" onClick={() => { setEditingSignerIndex(signers.length); setSignerDialogOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-1" />Adicionar
                </Button>
              </div>
            </div>

            {signers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-lg text-muted-foreground gap-2">
                <UserPlus className="h-8 w-8" />
                <p className="text-sm">Adicione um signatário para continuar</p>
              </div>
            )}

            {signers.length > 0 && !sequenceEnabled && signers.map((s, i) => (
              <div key={i} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name || s.email || "Signatário sem nome"}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingSignerIndex(i); setSignerDialogOpen(true); }}>
                    Editar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeSigner(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {signers.length > 0 && sequenceEnabled && (() => {
              const groups: Record<number, { signer: SignerData; originalIndex: number }[]> = {};
              signers.forEach((s, i) => {
                const order = s.sign_order || 1;
                if (!groups[order]) groups[order] = [];
                groups[order].push({ signer: s, originalIndex: i });
              });
              const sortedKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
              return sortedKeys.map((groupKey) => (
                <div key={groupKey} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grupo {groupKey}</p>
                  {groups[groupKey].map(({ signer: s, originalIndex: i }) => (
                    <div key={i} className="flex items-center gap-3 border rounded-lg p-3">
                      <Input
                        type="number"
                        min={1}
                        value={s.sign_order || 1}
                        onChange={(e) => updateSigner(i, "sign_order", Math.max(1, Number(e.target.value) || 1))}
                        className="w-14 h-8 text-center text-sm shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name || s.email || "Signatário sem nome"}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingSignerIndex(i); setSignerDialogOpen(true); }}>
                          Editar
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeSigner(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}

            <SignerEditDialog
              open={signerDialogOpen}
              onOpenChange={setSignerDialogOpen}
              signer={editingSignerIndex !== null && editingSignerIndex < signers.length ? signers[editingSignerIndex] : null}
              index={editingSignerIndex ?? 0}
              onSave={(idx, data) => {
                if (idx >= signers.length) {
                  setSigners((p) => [...p, data]);
                } else {
                  setSigners((p) => p.map((s, i) => (i === idx ? data : s)));
                }
                setEditingSignerIndex(null);
              }}
            />

            {/* Observers (collapsible) */}
            <Collapsible open={observersOpen} onOpenChange={setObserversOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-primary transition-colors">
                <ChevronDown className={`h-4 w-4 transition-transform ${observersOpen ? "rotate-0" : "-rotate-90"}`} />
                Observadores ({observers.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {observers.map((o, i) => (
                  <ObserverForm key={i} observer={o} index={i} onChange={updateObserver} onRemove={removeObserver} />
                ))}
                <Button size="sm" variant="outline" onClick={() => setObservers((p) => [...p, { ...EMPTY_OBSERVER }])}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar observador
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Step 2: Config */}
        {step === 2 && (
          <EnvelopeConfigSection config={config} onChange={updateConfig} />
        )}

        {/* Step 3: Provider */}
        {step === 3 && (
          <div className="space-y-4">
            <Label>Selecione a plataforma</Label>
            <div className="grid grid-cols-2 gap-3">
              {allProviders.map((p) => (
                <Button key={p} variant={provider === p ? "default" : "outline"} className="h-auto py-4 flex-col gap-1" onClick={() => setProvider(p)}>
                  <span className="font-medium">{PROVIDER_LABELS[p]}</span>
                  <span className="text-xs text-muted-foreground">{p === "manual" ? "Sem integração" : "API integrada"}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-2 text-sm">
              <div><strong>Título:</strong> {title}</div>
              <div><strong>Plataforma:</strong> {PROVIDER_LABELS[provider]}</div>
              <div><strong>Tipo de Assinatura:</strong> {config.signature_type === "simples" ? "Simples" : config.signature_type === "qualificada" ? "Qualificada (ICP-Brasil)" : "Avançada"}</div>
              {config.deadline_at && <div><strong>Prazo:</strong> {config.deadline_at}</div>}
              <div className="pt-2 border-t">
                <strong>Documentos ({files.length}):</strong>
                <ul className="list-disc list-inside mt-1">
                  {files.map((f, i) => (
                    <li key={i} className="text-xs">{f.file.name} <span className="font-mono text-muted-foreground">SHA-256: {f.hash?.slice(0, 12)}…</span></li>
                  ))}
                </ul>
              </div>
              <div className="pt-2 border-t">
                <strong>Signatários ({signers.filter((s) => s.email || s.name).length}):</strong>
                <ul className="list-disc list-inside mt-1">
                  {signers.filter((s) => s.email || s.name).map((s, i) => (
                    <li key={i} className="text-xs">
                      {s.name || "—"} ({s.email || "—"}) — {s.roles?.map((r: string) => r).join(", ")} | {s.auth_methods?.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
              {observers.length > 0 && (
                <div className="pt-2 border-t">
                  <strong>Observadores ({observers.length}):</strong>
                  <ul className="list-disc list-inside mt-1">
                    {observers.map((o, i) => (
                      <li key={i} className="text-xs">{o.name || o.email}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
            {step < 4 ? (
              <Button disabled={!canGoNext()} onClick={() => setStep((s) => s + 1)}>
                Próximo<ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button disabled={saving || !title.trim()} onClick={handleSave}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Send className="h-4 w-4 mr-1" />Criar Envelope</>}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
