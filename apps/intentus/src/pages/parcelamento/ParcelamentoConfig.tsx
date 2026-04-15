/**
 * ParcelamentoConfig.tsx — Configuração do Módulo (STUB)
 *
 * Sessão 130 CONT3 Passo 5.3: stub das configurações do módulo. Escopo
 * exato a definir com Marcelo — provavelmente: defaults por padrão de
 * empreendimento (Lei 6.766), templates de relatório, permissões granulares
 * por tenant, integrações externas.
 */
import { Settings, Mountain, Sparkles } from "lucide-react";

export default function ParcelamentoConfig() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Mountain className="h-3.5 w-3.5" />
          <span>Parcelamento de Solo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-lime-600" />
          Configuração do Módulo
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajustes e preferências do módulo de Parcelamento de Solo para este tenant.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="h-7 w-7 text-lime-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Em breve</h3>
        <p className="text-sm text-gray-500 max-w-md">
          As configurações do módulo serão habilitadas em fase futura. Escopo a definir:
          defaults por padrão de empreendimento, templates de relatório e integrações.
        </p>
      </div>
    </div>
  );
}
