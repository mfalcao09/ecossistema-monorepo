import { useSearchParams } from "react-router-dom";
import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldsTab } from "@/components/admin/FieldsTab";
import { AutomationsTab } from "@/components/admin/AutomationsTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";
import { IntegrationsTab } from "@/components/admin/IntegrationsTab";

const TAB_MAP: Record<string, string> = {
  campos: "campos",
  automacoes: "automacoes",
  notificacoes: "notificacoes",
  integracoes: "integracoes",
};

export default function GlobalSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TAB_MAP[searchParams.get("tab") || ""] || "campos";

  const handleTabChange = (value: string) => {
    if (value === "campos") searchParams.delete("tab");
    else searchParams.set("tab", value);
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações Globais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie campos personalizados, automações, notificações e integrações do sistema.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="campos">Campos</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="campos">
          <FieldsTab />
        </TabsContent>

        <TabsContent value="automacoes">
          <AutomationsTab />
        </TabsContent>

        <TabsContent value="notificacoes">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="integracoes">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
