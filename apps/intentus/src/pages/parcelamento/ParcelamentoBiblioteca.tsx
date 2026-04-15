/**
 * ParcelamentoBiblioteca.tsx — Biblioteca de Conhecimento (STUB)
 *
 * Sessão 130 CONT3 Passo 5.3: stub da Biblioteca de Conhecimento Jurídico.
 * Página real será construída na Fase 5 Bloco B (RAG pgvector com Lei 6.766,
 * Lei 4.591, normas ABNT, jurisprudência, detector de zoneamento municipal).
 * Ver: memory/projects/parcelamento-solo-KNOWLEDGE-BASE.md
 */
import { BookText, Mountain, Sparkles } from "lucide-react";

export default function ParcelamentoBiblioteca() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Mountain className="h-3.5 w-3.5" />
          <span>Parcelamento de Solo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookText className="h-6 w-6 text-lime-600" />
          Biblioteca de Conhecimento
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Base de conhecimento jurídico do parcelamento de solo — Lei 6.766/79, Lei 4.591/64,
          jurisprudência, normas ABNT e leis municipais de zoneamento.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="h-7 w-7 text-lime-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Em breve</h3>
        <p className="text-sm text-gray-500 max-w-md">
          A Biblioteca de Conhecimento será liberada na próxima fase do módulo, com busca
          semântica via RAG (pgvector), detector automático de leis municipais aplicáveis e
          citações contextualizadas por projeto.
        </p>
      </div>
    </div>
  );
}
