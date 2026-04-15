import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, ClipboardCheck, Wrench, Eye, Key, Settings, Zap, AlertTriangle } from "lucide-react";
import { lazy, Suspense } from "react";
import { useCreateInspection } from "@/hooks/useInspections";
import { useContracts } from "@/hooks/useContracts";
import { useTerminations } from "@/hooks/useTerminations";
const MaintenanceCustomizationTab = lazy(() => import("@/components/inspections/MaintenanceCustomizationTab"));
import {
  useInspections,
  inspectionTypeLabels,
  inspectionStatusLabels,
  inspectionStatusColors,
} from "@/hooks/useInspections";
import {
  useMaintenanceRequests,
  useCreateMaintenanceRequest,
  useUpdateMaintenanceRequest,
  maintenanceStatusLabels,
  maintenanceStatusColors,
  maintenancePriorityLabels,
  maintenancePriorityColors,
  responsibilityLabels,
} from "@/hooks/useMaintenanceRequests";
import { useProperties } from "@/hooks/useProperties";
import { format } from "date-fns";

export default function MaintenanceInspections() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("vistorias");
  const { data: inspections = [], isLoading: loadingInspections } = useInspections();
  const { data: maintenanceList = [], isLoading: loadingMaintenance } = useMaintenanceRequests();
  const { data: properties = [] } = useProperties({});
  const createMaintenance = useCreateMaintenanceRequest();
  const updateMaintenance = useUpdateMaintenanceRequest();

  const [mDialog, setMDialog] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [mForm, setMForm] = useState({ property_id: "", title: "", description: "", priority: "media", responsibility: "" });

  const filteredInspections = inspections.filter((i) =>
    (i.properties?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredMaintenance = maintenanceList.filter((m) =>
    (m.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.properties?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  function handleCreateMaintenance() {
    if (!mForm.property_id || !mForm.title) return;
    createMaintenance.mutate(mForm, {
      onSuccess: () => {
        setMDialog(false);
        setMForm({ property_id: "", title: "", description: "", priority: "media", responsibility: "" });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Manutenção & Vistorias</h1>
          <p className="text-muted-foreground text-sm">Gestão de vistorias, manutenções e entrega de chaves</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "manutencoes" && (
            <Button onClick={() => setMDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova Manutenção</Button>
          )}
          <Button variant="outline" onClick={() => setCustomizeOpen(true)}><Settings className="h-4 w-4 mr-1" /> Personalizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inspections.filter((i) => i.status === "agendada").length}</p>
                <p className="text-xs text-muted-foreground">Vistorias Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{maintenanceList.filter((m) => m.status === "aberto").length}</p>
                <p className="text-xs text-muted-foreground">Manutenções Abertas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Wrench className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{maintenanceList.filter((m) => m.status === "concluido").length}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Key className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Entregas de Chaves</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="vistorias">Vistorias</TabsTrigger>
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          <TabsTrigger value="chaves">Entrega de Chaves</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por imóvel ou título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <TabsContent value="vistorias">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Data Conclusão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInspections ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredInspections.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhuma vistoria encontrada.</TableCell></TableRow>
                  ) : (
                    filteredInspections.map((insp) => (
                      <TableRow key={insp.id}>
                        <TableCell className="font-medium">{insp.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{inspectionTypeLabels[insp.inspection_type]}</Badge></TableCell>
                        <TableCell><Badge className={inspectionStatusColors[insp.status]}>{inspectionStatusLabels[insp.status]}</Badge></TableCell>
                        <TableCell>{insp.scheduled_date ? format(new Date(insp.scheduled_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{insp.completed_date ? format(new Date(insp.completed_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm">Ver</Button></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manutencoes">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Responsabilidade</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Abertura</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMaintenance ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredMaintenance.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhum chamado de manutenção encontrado.</TableCell></TableRow>
                  ) : (
                    filteredMaintenance.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell>{m.properties?.title || "—"}</TableCell>
                        <TableCell>
                          {m.responsibility ? (
                            <Badge variant="outline">{responsibilityLabels[m.responsibility] || m.responsibility}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">A definir</span>
                          )}
                        </TableCell>
                        <TableCell><Badge className={maintenancePriorityColors[m.priority]}>{maintenancePriorityLabels[m.priority] || m.priority}</Badge></TableCell>
                        <TableCell>
                          <Select value={m.status} onValueChange={(v: any) => updateMaintenance.mutate({ id: m.id, status: v })}>
                            <SelectTrigger className="w-36 h-8"><Badge className={maintenanceStatusColors[m.status]}>{maintenanceStatusLabels[m.status] || m.status}</Badge></SelectTrigger>
                            <SelectContent>
                              {Object.entries(maintenanceStatusLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{format(new Date(m.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm">Ver</Button></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chaves">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <Key className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma entrega de chaves agendada.</p>
                <p className="text-xs mt-1">As entregas de chaves serão vinculadas a contratos e vistorias.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Maintenance Dialog */}
      <Dialog open={mDialog} onOpenChange={setMDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Chamado de Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Imóvel *</Label>
              <Select value={mForm.property_id} onValueChange={(v) => setMForm({ ...mForm, property_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar imóvel" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={mForm.title} onChange={(e) => setMForm({ ...mForm, title: e.target.value })} placeholder="Ex: Vazamento no banheiro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={mForm.priority} onValueChange={(v) => setMForm({ ...mForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(maintenancePriorityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsabilidade</Label>
                <Select value={mForm.responsibility} onValueChange={(v) => setMForm({ ...mForm, responsibility: v })}>
                  <SelectTrigger><SelectValue placeholder="A definir" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(responsibilityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateMaintenance} disabled={createMaintenance.isPending}>Criar Chamado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customization Dialog */}
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalizar Manutenção & Vistorias</DialogTitle></DialogHeader>
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Carregando...</div>}>
            <MaintenanceCustomizationTab />
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
}
