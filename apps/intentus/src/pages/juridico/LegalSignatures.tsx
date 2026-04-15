import { useState, useEffect } from "react";
import { Search, Plus, PenTool, ArrowLeft, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSignatureDepartments } from "@/hooks/useSignatureDepartments";
import { useSignatureEnvelopes, type EnvelopeFilter } from "@/hooks/useSignatureEnvelopes";
import SignatureSidebar from "@/components/signatures/SignatureSidebar";
import SignatureDashboard from "@/components/signatures/SignatureDashboard";
import SignatureEnvelopeTable from "@/components/signatures/SignatureEnvelopeTable";
import SignatureEnvelopeDetail from "@/components/signatures/SignatureEnvelopeDetail";
import SignatureProviderConfigDialog from "@/components/signatures/SignatureProviderConfigDialog";
import SignatureEnvelopeWizard from "@/components/signatures/SignatureEnvelopeWizard";
import SignatureContacts from "@/components/signatures/SignatureContacts";

export default function LegalSignatures() {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EnvelopeFilter>("todos");
  const [configOpen, setConfigOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [quickFiles, setQuickFiles] = useState<File[]>([]);

  const { myDepartments, envelopeCounts, isLoading: deptsLoading } = useSignatureDepartments();
  const { envelopes, signersByEnvelope, isLoading, kpis, softDelete, restore, permanentDelete } =
    useSignatureEnvelopes(selectedDeptId, filter);

  // Auto-select single department
  useEffect(() => {
    if (!deptsLoading && myDepartments.length === 1 && !selectedDeptId) {
      setSelectedDeptId(myDepartments[0].id);
    }
  }, [deptsLoading, myDepartments, selectedDeptId]);

  // Quick upload → open wizard with pre-loaded files
  const handleQuickUpload = (files: File[]) => {
    setQuickFiles(files);
    setWizardOpen(true);
  };

  // No departments
  if (!deptsLoading && myDepartments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Assinaturas Digitais</h1>
          <p className="page-subtitle">Nenhum departamento configurado ou você não pertence a nenhum departamento.</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            <PenTool className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Solicite ao administrador para criar departamentos de assinatura e adicioná-lo como membro.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Department selection
  if (!selectedDeptId && !deptsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Assinaturas Digitais</h1>
          <p className="page-subtitle">Selecione o departamento para enviar e acompanhar documentos.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {myDepartments.map((dept: any) => {
            const count = envelopeCounts[dept.id] || 0;
            return (
              <Card
                key={dept.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/30"
                onClick={() => setSelectedDeptId(dept.id)}
              >
                <CardContent className="pt-6 text-center">
                  <div
                    className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: dept.color || "#8b5cf6" }}
                  >
                    {dept.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-semibold text-sm">{dept.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count} {count === 1 ? "envelope" : "envelopes"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedDept = myDepartments.find((d: any) => d.id === selectedDeptId);
  const hasMultipleDepts = myDepartments.length > 1;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          {hasMultipleDepts && (
            <Button variant="ghost" size="icon" onClick={() => { setSelectedDeptId(null); setFilter("todos"); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="page-title flex items-center gap-2">
              Assinaturas Digitais
              {selectedDept && (
                <Badge variant="outline" className="text-sm font-normal" style={{ borderColor: selectedDept.color || "#8b5cf6" }}>
                  {selectedDept.name}
                </Badge>
              )}
            </h1>
            <p className="page-subtitle">Hub de controle de assinaturas e evidências digitais.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />Configurações
          </Button>
          <Button onClick={() => { setQuickFiles([]); setWizardOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo Envelope
          </Button>
        </div>
      </div>

      {/* Main layout with sidebar */}
      <div className="flex gap-0 min-h-[60vh] border rounded-lg bg-card overflow-hidden">
        <SignatureSidebar
          activeFilter={filter}
          onFilterChange={setFilter}
          onOpenConfig={() => setConfigOpen(true)}
          kpis={kpis}
        />

        <div className="flex-1 p-4 space-y-4 overflow-auto">
          {filter === "contatos" ? (
            <SignatureContacts />
          ) : (
            <>
              {filter === "todos" && (
                <SignatureDashboard kpis={kpis} onQuickUpload={handleQuickUpload} />
              )}

              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar envelopes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>

              <SignatureEnvelopeTable
                envelopes={envelopes}
                signersByEnvelope={signersByEnvelope}
                filter={filter}
                search={search}
                onViewDetail={(id) => setDetailId(id)}
                onSoftDelete={(id) => softDelete.mutate(id)}
                onRestore={(id) => restore.mutate(id)}
                onPermanentDelete={(id) => permanentDelete.mutate(id)}
                isLoading={isLoading}
              />
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <SignatureProviderConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
      <SignatureEnvelopeWizard
        open={wizardOpen}
        onOpenChange={(v) => { setWizardOpen(v); if (!v) setQuickFiles([]); }}
        departmentTeamId={selectedDeptId || undefined}
        initialFiles={quickFiles}
      />
      <SignatureEnvelopeDetail
        envelopeId={detailId}
        open={!!detailId}
        onOpenChange={(v) => { if (!v) setDetailId(null); }}
      />
    </div>
  );
}
