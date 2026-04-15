import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Kanban, FileText, MoreHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Início", path: "/comercial" },
  { icon: Users, label: "Leads", path: "/comercial/leads" },
  { icon: Kanban, label: "Pipeline", path: "/comercial/pipeline" },
  { icon: FileText, label: "CLM", path: "/contratos" },
];

const MORE_ITEMS: NavItem[] = [
  { icon: Users, label: "Pessoas", path: "/pessoas" },
  { icon: FileText, label: "Imóveis", path: "/imoveis" },
  { icon: Kanban, label: "Follow-up IA", path: "/comercial/follow-up" },
  { icon: Users, label: "Nurturing", path: "/comercial/nurturing" },
  { icon: Kanban, label: "Deal Forecast", path: "/comercial/deal-forecast" },
  { icon: FileText, label: "Portais BR", path: "/comercial/portais" },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!isMobile) return null;

  const isActive = (path: string) => {
    if (path === "/comercial") return location.pathname === "/comercial" || location.pathname === "/comercial/dashboard";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg transition-colors",
                "active:bg-muted/50 touch-manipulation",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More button */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg text-muted-foreground active:bg-muted/50 touch-manipulation">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] leading-none font-medium">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader>
              <SheetTitle className="text-left text-sm">Mais opções</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 py-4">
              {MORE_ITEMS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-colors",
                    "active:bg-muted/50 touch-manipulation",
                    isActive(item.path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
