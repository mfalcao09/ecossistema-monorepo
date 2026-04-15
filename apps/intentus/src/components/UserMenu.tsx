import { User, LogOut, UserCircle, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MyAccountDialog } from "@/components/MyAccountDialog";

export function UserMenu() {
  const { user, signOut, roles } = useAuth();
  const { viewMode, setViewMode, isSuperAdmin } = useSuperAdminView();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, avatar_url, department")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    staleTime: 300_000,
  });

  const toggleMode = () => {
    const newMode = viewMode === "gestao" ? "empresa" : "gestao";
    setViewMode(newMode);
    navigate(newMode === "gestao" ? "/sa" : "/");
  };

  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    .split(" ")[0]
    .slice(0, 2)
    .toUpperCase();

  const department = profile?.department || (roles.length > 0 ? roles[0] : "usuário");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">Dpto: {department}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setAccountOpen(true)}>
            <UserCircle className="h-4 w-4" />
            Minha conta
          </DropdownMenuItem>
          {isSuperAdmin && viewMode && (
            <>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={toggleMode}>
                <ArrowRightLeft className="h-4 w-4" />
                {viewMode === "gestao" ? "Ir para Empresa Master" : "Ir para Gestão Multi-Empresas"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sair do sistema
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyAccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
