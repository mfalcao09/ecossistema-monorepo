import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { Users, ShieldCheck, UserCog, PenTool } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "@/components/users/UsersTab";
import { PermissionsTab } from "@/components/users/PermissionsTab";
import { TeamsTab } from "@/components/users/TeamsTab";
import { SignatureDepartmentsTab } from "@/components/users/SignatureDepartmentsTab";

const TAB_MAP: Record<string, string> = {
  usuarios: "usuarios",
  permissoes: "permissoes",
  equipes: "equipes",
  departamentos: "departamentos",
};

export default function UserManagement() {
  const { isAdminOrGerente } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TAB_MAP[searchParams.get("tab") || ""] || "usuarios";

  const handleTabChange = (value: string) => {
    if (value === "usuarios") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  if (!isAdminOrGerente) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Acesso restrito a Administradores e Gerentes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuários, permissões e equipes do sistema</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <UserCog className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="equipes" className="gap-1.5">
            <Users className="h-4 w-4" />
            Equipes
          </TabsTrigger>
          <TabsTrigger value="departamentos" className="gap-1.5">
            <PenTool className="h-4 w-4" />
            Deptos. Assinatura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>
        <TabsContent value="permissoes">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="equipes">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="departamentos">
          <SignatureDepartmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
