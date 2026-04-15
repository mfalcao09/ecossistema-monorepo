/**
 * ParcelamentoDrive.tsx — Drive de Arquivos do Módulo (STUB)
 *
 * Sessão 130 CONT3 Passo 5.3: stub do Drive do módulo. Página real será
 * construída na Fase 5 Bloco C (PDF) e evoluirá para repositório completo
 * de KMZs, PDFs regulatórios, contratos, memoriais descritivos e arquivos
 * CAD (futuro Bloco D com Three.js + Civil 3D).
 */
import { FolderTree, Mountain, Sparkles } from "lucide-react";

export default function ParcelamentoDrive() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Mountain className="h-3.5 w-3.5" />
          <span>Parcelamento de Solo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-lime-600" />
          Drive
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Repositório central de arquivos do módulo — KMZs, PDFs de projetos, memoriais
          descritivos, contratos e anexos técnicos.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="h-7 w-7 text-lime-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Em breve</h3>
        <p className="text-sm text-gray-500 max-w-md">
          O Drive centralizado será liberado em fase futura do módulo, integrando todos os
          arquivos dos projetos em um repositório único com versionamento e busca.
        </p>
      </div>
    </div>
  );
}
