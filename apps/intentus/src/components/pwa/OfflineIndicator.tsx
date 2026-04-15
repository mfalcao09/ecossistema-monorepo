import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline, queueCount, isSyncing, processQueue } = useOfflineSync();

  // Online with no pending items — don't show anything
  if (isOnline && queueCount === 0 && !isSyncing) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 pointer-events-auto animate-in slide-in-from-top duration-300">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Sem conexão — alterações serão salvas offline</span>
          {queueCount > 0 && (
            <span className="bg-white/20 rounded-full px-2 py-0.5 text-[10px]">
              {queueCount} pendente{queueCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Syncing indicator */}
      {isOnline && isSyncing && (
        <div className="bg-blue-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 pointer-events-auto animate-in slide-in-from-top duration-300">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Sincronizando {queueCount} item{queueCount !== 1 ? "s" : ""}...</span>
        </div>
      )}

      {/* Pending sync (online but has queue) */}
      {isOnline && !isSyncing && queueCount > 0 && (
        <div className="bg-orange-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 pointer-events-auto animate-in slide-in-from-top duration-300">
          <CloudOff className="h-3.5 w-3.5" />
          <span>{queueCount} ação pendente</span>
          <button
            onClick={processQueue}
            className="underline hover:no-underline ml-1"
          >
            Sincronizar agora
          </button>
        </div>
      )}
    </div>
  );
}
