import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ShieldCheck, AlertTriangle, FileText, DollarSign } from "lucide-react";
import {
  useInsurancePolicies, useInsuranceClaims, useCreatePolicy, useUpdatePolicy, useDeletePolicy,
  useCreateClaim, useUpdateClaim, insuranceTypeLabels, claimStatusLabels
} from "@/hooks/useInsurancePolicies";
import { format, differenceInDays } from "date-fns";

export default function RelationshipInsurance() {
  const { data: policies = [], isLoading: loadingPolicies } = useInsurancePolicies();
  const { data: claims = [], isLoading: loadingClaims } = useInsuranceClaims();
  const createPolicy = useCreatePolicy();
  const deletePolicy = useDeletePolicy();
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim();

  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);

  // Policy form
  const [pContractId, setPContractId] = useState("");
  const [pInsurer, setPInsurer] = useState("");
  const [pType, setPType] = useState("fianca");
  const [pPolicyNum, setPPolicyNum] = useState("");
  const [pPremium, setPPremium] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");

  // Claim form
  const [cPolicyId, setCPolicyId] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cClaimDate, setCClaimDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cAmount, setCAmount] = useState("");

  // KPIs
  const activePolicies = policies.filter(p => p.status === "ativa").length;
  const expiringSoon = policies.filter(p => {
    if (p.status !== "ativa") return false;
    const days = differenceInDays(new Date(p.end_date), new Date());
    return days >= 0 && days <= 30;
  }).length;
  const openClaims = claims.filter(c => ["aberto", "em_analise"].includes(c.status)).length;
  const totalInAnalysis = claims.filter(c => c.status === "em_analise").reduce((s, c) => s + Number(c.amount_claimed || 0), 0);

  const handleSavePolicy = () => {
    if (!pContractId || !pInsurer || !pStart || !pEnd) return;
    createPolicy.mutate({
      contract_id: pContractId,
      insurer_name: pInsurer,
      insurance_type: pType,
      policy_number: pPolicyNum || null,
      premium_value: parseFloat(pPremium) || 0,
      start_date: pStart,
      end_date: pEnd,
      status: "ativa",
      alert_days_before: 30,
      notes: null,
      file_url: null,
      file_name: null,
    });
    setShowPolicyDialog(false);
    setPContractId(""); setPInsurer(""); setPType("fianca"); setPPolicyNum(""); setPPremium(""); setPStart(""); setPEnd("");
  };

  const handleSaveClaim = () => {
    if (!cPolicyId || !cDescription) return;
    createClaim.mutate({
      policy_id: cPolicyId,
      description: cDescription,
      claim_date: cClaimDate,
      amount_claimed: parseFloat(cAmount) || undefined,
    });
    setShowClaimDialog(false);
    setCPolicyId(""); setCDescription(""); setCAmount("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seguros & Sinistros</h1>
          <p className="text-muted-foreground">Gestão de apólices e sinistros vinculados a contratos</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <ShieldCheck className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold">{activePolicies}</p>
          <p className="text-xs text-muted-foreground">Apólices Ativas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{expiringSoon}</p>
          <p className="text-xs text-muted-foreground">Vencendo em 30d</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <FileText className="h-5 w-5 mx-auto text-destructive mb-1" />
          <p className="text-2xl font-bold">{openClaims}</p>
          <p className="text-xs text-muted-foreground">Sinistros Abertos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">R$ {totalInAnalysis.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Valor em Análise</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="apolices">
        <TabsList>
          <TabsTrigger value="apolices">Apólices</TabsTrigger>
          <TabsTrigger value="sinistros">Sinistros</TabsTrigger>
        </TabsList>

        <TabsContent value="apolices" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPolicyDialog(true)}><Plus className="h-4 w-4 mr-1" />Nova Apólice</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nº Apólice</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Prêmio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPolicies ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : policies.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma apólice cadastrada</TableCell></TableRow>
                ) : policies.map(p => {
                  const daysLeft = differenceInDays(new Date(p.end_date), new Date());
                  const expiring = p.status === "ativa" && daysLeft >= 0 && daysLeft <= 30;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.insurer_name}</TableCell>
                      <TableCell>{insuranceTypeLabels[p.insurance_type] || p.insurance_type}</TableCell>
                      <TableCell>{p.policy_number || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(p.start_date), "dd/MM/yy")} - {format(new Date(p.end_date), "dd/MM/yy")}
                        {expiring && <Badge variant="destructive" className="ml-2 text-[10px]">Vencendo</Badge>}
                      </TableCell>
                      <TableCell>R$ {Number(p.premium_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ativa" ? "default" : p.status === "vencida" ? "destructive" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePolicy.mutate(p.id)}>Excluir</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sinistros" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowClaimDialog(true)}><Plus className="h-4 w-4 mr-1" />Novo Sinistro</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor Solicitado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingClaims ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : claims.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum sinistro registrado</TableCell></TableRow>
                ) : claims.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.insurance_policies?.insurer_name || "—"}</TableCell>
                    <TableCell>{insuranceTypeLabels[c.insurance_policies?.insurance_type || ""] || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.description}</TableCell>
                    <TableCell>{format(new Date(c.claim_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{c.amount_claimed ? `R$ ${Number(c.amount_claimed).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "aprovado" ? "default" : c.status === "negado" ? "destructive" : "secondary"}>
                        {claimStatusLabels[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={(v) => updateClaim.mutate({ id: c.id, status: v })}>
                        <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(claimStatusLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Apólice */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Apólice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ID do Contrato</Label><Input value={pContractId} onChange={e => setPContractId(e.target.value)} placeholder="UUID do contrato" /></div>
            <div><Label>Seguradora</Label><Input value={pInsurer} onChange={e => setPInsurer(e.target.value)} /></div>
            <div><Label>Tipo</Label>
              <Select value={pType} onValueChange={setPType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(insuranceTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nº Apólice</Label><Input value={pPolicyNum} onChange={e => setPPolicyNum(e.target.value)} /></div>
            <div><Label>Valor do Prêmio</Label><Input type="number" value={pPremium} onChange={e => setPPremium(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="date" value={pStart} onChange={e => setPStart(e.target.value)} /></div>
              <div><Label>Fim</Label><Input type="date" value={pEnd} onChange={e => setPEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePolicy} disabled={createPolicy.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Sinistro */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Sinistro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Apólice</Label>
              <Select value={cPolicyId} onValueChange={setCPolicyId}>
                <SelectTrigger><SelectValue placeholder="Selecione a apólice..." /></SelectTrigger>
                <SelectContent>
                  {policies.filter(p => p.status === "ativa").map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.insurer_name} - {p.policy_number || insuranceTypeLabels[p.insurance_type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={cDescription} onChange={e => setCDescription(e.target.value)} placeholder="Descreva o sinistro..." /></div>
            <div><Label>Data do Sinistro</Label><Input type="date" value={cClaimDate} onChange={e => setCClaimDate(e.target.value)} /></div>
            <div><Label>Valor Solicitado</Label><Input type="number" value={cAmount} onChange={e => setCAmount(e.target.value)} placeholder="R$" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveClaim} disabled={createClaim.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
