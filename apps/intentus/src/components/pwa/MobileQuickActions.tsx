import { useState } from "react";
import { Plus, X, UserPlus, Building2, Calendar, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}

export function MobileQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!isMobile) return null;

  const actions: QuickAction[] = [
    {
      icon: UserPlus,
      label: "Novo Lead",
      color: "bg-blue-500",
      onClick: () => {
        navigate("/comercial/leads");
        setIsOpen(false);
      },
    },
    {
      icon: Building2,
      label: "Novo Imóvel",
      color: "bg-emerald-500",
      onClick: () => {
        navigate("/imoveis");
        setIsOpen(false);
      },
    },
    {
      icon: Calendar,
      label: "Agendar Visita",
      color: "bg-purple-500",
      onClick: () => {
        navigate("/comercial/visitas");
        setIsOpen(false);
      },
    },
    {
      icon: MessageCircle,
      label: "Nova Interação",
      color: "bg-orange-500",
      onClick: () => {
        navigate("/comercial/pipeline");
        setIsOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className="fixed right-4 bottom-20 z-50 flex flex-col-reverse items-end gap-3">
        {isOpen &&
          actions.map((action, i) => (
            <div
              key={action.label}
              className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="bg-background text-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={action.onClick}
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center text-white shadow-lg",
                  "active:scale-95 transition-transform touch-manipulation",
                  action.color
                )}
              >
                <action.icon className="h-5 w-5" />
              </button>
            </div>
          ))}

        {/* FAB trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center text-white shadow-xl",
            "active:scale-95 transition-all duration-200 touch-manipulation",
            isOpen ? "bg-muted-foreground rotate-45" : "bg-primary"
          )}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
