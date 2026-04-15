import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function InstallBanner() {
  const { isInstallable, promptInstall, dismissInstall } = useInstallPrompt();
  const isMobile = useIsMobile();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-16 left-2 right-2 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-xl p-3 shadow-lg flex items-center gap-3">
        <div className="bg-white/20 rounded-lg p-2 shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {isMobile ? "Instalar Intentus" : "Instalar o app"}
          </p>
          <p className="text-xs opacity-80 mt-0.5 leading-tight">
            {isMobile
              ? "Adicione à tela inicial para acesso rápido"
              : "Acesse o Intentus como um app desktop"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-3 text-xs font-semibold bg-white text-primary hover:bg-white/90"
            onClick={promptInstall}
          >
            Instalar
          </Button>
          <button
            onClick={dismissInstall}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
