import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  UserPlus, Building2, FileText, DollarSign, AlertTriangle,
  ArrowUpRight, Wrench, Briefcase, Calendar
} from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  path: string;
}

function getActionsForRoles(roles: string[]): QuickAction[] {
  const actions: QuickAction[] = [];

  if (roles.includes("corretor") || roles.includes("admin") || roles.includes("gerente")) {
    actions.push(
      { label: "Novo Lead", icon: <UserPlus className="h-4 w-4" />, path: "/leads" },
      { label: "Meus Negócios", icon: <Briefcase className="h-4 w-4" />, path: "/negocios" },
    );
  }

  if (roles.includes("financeiro") || roles.includes("admin") || roles.includes("gerente")) {
    actions.push(
      { label: "Contas a Receber", icon: <DollarSign className="h-4 w-4" />, path: "/financeiro/receitas" },
      { label: "Inadimplentes", icon: <AlertTriangle className="h-4 w-4" />, path: "/financeiro/inadimplentes" },
    );
  }

  if (roles.includes("admin") || roles.includes("gerente")) {
    actions.push(
      { label: "Novo Imóvel", icon: <Building2 className="h-4 w-4" />, path: "/imoveis" },
      { label: "Novo Contrato", icon: <FileText className="h-4 w-4" />, path: "/contratos" },
    );
  }

  if (roles.includes("manutencao")) {
    actions.push(
      { label: "Chamados", icon: <Wrench className="h-4 w-4" />, path: "/manutencao" },
    );
  }

  // Deduplicate and limit to 5
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.path)) return false;
    seen.add(a.path);
    return true;
  }).slice(0, 5);
}

export function QuickActions() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const actions = getActionsForRoles(roles);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.path}
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => navigate(a.path)}
        >
          {a.icon}
          {a.label}
        </Button>
      ))}
    </div>
  );
}
