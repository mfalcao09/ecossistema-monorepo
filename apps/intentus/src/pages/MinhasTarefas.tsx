/**
 * MinhasTarefas.tsx — Stub
 *
 * Sessão 130 CONT3 Passo 6: stub de Minhas Tarefas, acessível pela sidebar da Home.
 * Será construída depois — integração com Asana/Linear ou task manager interno.
 */
import { Home as HomeIcon, CheckSquare, Sparkles } from "lucide-react";

export default function MinhasTarefas() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <HomeIcon className="h-3.5 w-3.5" />
          <span>Início</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-slate-700" />
          Minhas Tarefas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Centralize todas as suas pendências, lembretes e tarefas atribuídas — de todos
          os módulos — em um único lugar.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="h-7 w-7 text-slate-700" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Em breve</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Aqui você verá todas as tarefas que precisa acompanhar — contratos para assinar,
          leads para responder, aprovações pendentes e lembretes pessoais.
        </p>
      </div>
    </div>
  );
}
