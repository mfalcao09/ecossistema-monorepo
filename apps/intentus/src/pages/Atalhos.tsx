/**
 * Atalhos.tsx — Stub
 *
 * Sessão 130 CONT3 Passo 6: stub de Atalhos, acessível pela sidebar da Home.
 * Será construída depois — permitirá ao usuário fixar rotas e ações frequentes.
 */
import { Home as HomeIcon, Zap, Sparkles } from "lucide-react";

export default function Atalhos() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <HomeIcon className="h-3.5 w-3.5" />
          <span>Início</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Atalhos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Seus caminhos rápidos para as telas, relatórios e ações que você mais usa no dia a dia.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Em breve</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Você poderá fixar telas, relatórios e fluxos favoritos aqui — cada usuário monta
          a própria "mesa de trabalho".
        </p>
      </div>
    </div>
  );
}
