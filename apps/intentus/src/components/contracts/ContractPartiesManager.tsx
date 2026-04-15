/**
 * ContractPartiesManager — Gerenciador de Partes Contratuais
 *
 * Componente para adicionar, editar e remover partes de um contrato.
 * Inclui busca de pessoas (autocomplete) e seleção de papel/role.
 *
 * Épico 3 — CLM Fase 2
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  Trash2,
  Search,
  UserCircle,
  Building2,
  Percent,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useContractParties,
  useSearchPeople,
  useCreateContractParty,
  useDeleteContractParty,
  PARTY_ROLE_LABELS,
  ALL_PARTY_ROLES,
  type ContractPartyRole,
  type PersonSearchResult,
} from "@/hooks/useContractParties";

// ── Props ──────────────────────────────────────────────────────────────
interface ContractPartiesManagerProps {
  contractId: string;
  readOnly?: boolean;
}

// ── Role badge colors ──────────────────────────────────────────────────
const ROLE_COLORS: Record<ContractPartyRole, string> = {
  comprador: "bg-green-100 text-green-800 border-green-200",
  vendedor: "bg-blue-100 text-blue-800 border-blue-200",
  locatario: "bg-cyan-100 text-cyan-800 border-cyan-200",
  locador: "bg-indigo-100 text-indigo-800 border-indigo-200",
  proprietario: "bg-purple-100 text-purple-800 border-purple-200",
  fiador: "bg-amber-100 text-amber-800 border-amber-200",
  administrador: "bg-gray-100 text-gray-800 border-gray-200",
  intermediador: "bg-pink-100 text-pink-800 border-pink-200",
  testemunha: "bg-slate-100 text-slate-700 border-slate-200",
};

// ── Componente principal ───────────────────────────────────────────────
export default function ContractPartiesManager({
  contractId,
  readOnly = false,
}: ContractPartiesManagerProps) {
  const { toast } = useToast();
  const { data: parties, isLoading } = useContractParties(contractId);
  const createParty = useCreateContractParty();
  const deleteParty = useDeleteContractParty();

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<ContractPartyRole>("comprador");
  const [ownershipPercentage, setOwnershipPercentage] = useState<string>("");
  const [legalRepName, setLegalRepName] = useState("");
  const [legalRepCpf, setLegalRepCpf] = useState("");

  // People search
  const { data: searchResults, isLoading: isSearching } = useSearchPeople(searchQuery);

  // ── Handlers ──────────────────────────────────────────────────────────
  function resetForm() {
    setSearchQuery("");
    setSelectedPerson(null);
    setSelectedRole("comprador");
    setOwnershipPercentage("");
    setLegalRepName("");
    setLegalRepCpf("");
  }

  function handleOpenAdd() {
    resetForm();
    setShowAddDialog(true);
  }

  async function handleAdd() {
    if (!selectedPerson) {
      toast({ title: "Selecione uma pessoa", variant: "destructive" });
      return;
    }

    // Check duplicate
    const alreadyAdded = parties?.some(
      (p) => p.person_id === selectedPerson.id && p.role === selectedRole
    );
    if (alreadyAdded) {
      toast({
        title: "Duplicado",
        description: `${selectedPerson.name} já está como ${PARTY_ROLE_LABELS[selectedRole]}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await createParty.mutateAsync({
        contract_id: contractId,
        person_id: selectedPerson.id,
        role: selectedRole,
        ownership_percentage: ownershipPercentage
          ? parseFloat(ownershipPercentage)
          : undefined,
        legal_representative_name: legalRepName || undefined,
        legal_representative_cpf: legalRepCpf || undefined,
      });

      toast({ title: "Parte adicionada com sucesso" });
      setShowAddDialog(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: "Erro ao adicionar parte",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteParty.mutateAsync(deleteTarget);
      toast({ title: "Parte removida" });
    } catch (err: any) {
      toast({
        title: "Erro ao remover",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Partes do Contrato
              {parties && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {parties.length}
                </Badge>
              )}
            </CardTitle>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={handleOpenAdd} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !parties || parties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma parte adicionada</p>
              {!readOnly && (
                <p className="text-xs mt-1">
                  Clique em "Adicionar" para incluir compradores, vendedores, fiadores etc.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {parties.map((party) => (
                <div
                  key={party.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {party.person?.entity_type === "juridica" ? (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {party.person?.name || "—"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[party.role] || ""}`}
                      >
                        {PARTY_ROLE_LABELS[party.role]}
                      </Badge>
                      {party.ownership_percentage != null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Percent className="h-3 w-3" />
                          {party.ownership_percentage}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {party.person?.cpf_cnpj && <span>{party.person.cpf_cnpj}</span>}
                      {party.person?.email && <span>{party.person.email}</span>}
                      {party.person?.phone && <span>{party.person.phone}</span>}
                    </div>
                    {party.legal_representative_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rep. Legal: {party.legal_representative_name}
                        {party.legal_representative_cpf && ` (${party.legal_representative_cpf})`}
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(party.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ ADD DIALOG ══ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Parte ao Contrato</DialogTitle>
            <DialogDescription>
              Busque uma pessoa cadastrada e defina seu papel no contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Search */}
            <div className="space-y-2">
              <Label>Buscar Pessoa</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF/CNPJ ou e-mail..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedPerson(null);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Results */}
              {searchQuery.length >= 2 && !selectedPerson && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Buscando...
                    </div>
                  ) : !searchResults || searchResults.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhuma pessoa encontrada
                    </div>
                  ) : (
                    searchResults.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => {
                          setSelectedPerson(person);
                          setSearchQuery(person.name);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{person.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[person.cpf_cnpj, person.email].filter(Boolean).join(" · ")}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected indicator */}
              {selectedPerson && (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md text-sm">
                  <UserCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-800 font-medium">{selectedPerson.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => {
                      setSelectedPerson(null);
                      setSearchQuery("");
                    }}
                  >
                    Alterar
                  </Button>
                </div>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Papel no Contrato</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as ContractPartyRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PARTY_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {PARTY_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ownership % */}
            <div className="space-y-2">
              <Label>
                Percentual de Participação{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="Ex: 50"
                value={ownershipPercentage}
                onChange={(e) => setOwnershipPercentage(e.target.value)}
              />
            </div>

            {/* Legal Representative */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Rep. Legal{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="Nome do representante"
                  value={legalRepName}
                  onChange={(e) => setLegalRepName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  CPF Rep. Legal{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="000.000.000-00"
                  value={legalRepCpf}
                  onChange={(e) => setLegalRepCpf(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedPerson || createParty.isPending}
            >
              {createParty.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ DELETE CONFIRMATION ══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parte do contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove o vínculo da pessoa com este contrato. A pessoa não será excluída do
              cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
