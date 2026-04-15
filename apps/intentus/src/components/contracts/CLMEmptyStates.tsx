import React from "react";
import { Button } from "@/components/ui/button";
import {
  FilePlus,
  Layout,
  Upload,
  Brain,
  BarChart3,
  FileText,
  Sparkles,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Zap,
} from "lucide-react";

// ============================================================
// CLMEmptyStates — Empty States educativos com CTAs
// Fase 4, Épico 3: Onboarding Guiado
// ============================================================

interface EmptyStateProps {
  onAction?: (action: string) => void;
}

// ============================================================
// Empty State: Nenhum Contrato
// ============================================================
export function ContractsEmptyState({ onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Ilustração */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#e2a93b]/15 to-[#e2a93b]/5 flex items-center justify-center border border-[#e2a93b]/20">
          <FileText className="h-12 w-12 text-[#e2a93b]" />
        </div>
        <div className="absolute -top-2 -right-2 bg-[#e2a93b] rounded-full p-1.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Texto principal */}
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Nenhum contrato ainda
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
        Comece criando seu primeiro contrato manualmente, usando IA para gerar automaticamente,
        ou importando um documento existente em PDF/Word.
      </p>

      {/* Cards de ação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-6">
        <ActionCard
          icon={<FilePlus className="h-5 w-5 text-[#e2a93b]" />}
          title="Criar com IA"
          description="Descreva e a IA gera"
          onClick={() => onAction?.("create_contract")}
        />
        <ActionCard
          icon={<Upload className="h-5 w-5 text-blue-600" />}
          title="Importar PDF"
          description="Extraia dados com IA"
          onClick={() => onAction?.("import_contract")}
        />
        <ActionCard
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          title="Manual"
          description="Preencha campo a campo"
          onClick={() => onAction?.("create_manual")}
        />
      </div>

      {/* Dica */}
      <TipBanner
        text="Dica: Use a criação com IA para gerar contratos completos em segundos — basta descrever o que você precisa!"
      />
    </div>
  );
}

// ============================================================
// Empty State: Nenhum Template
// ============================================================
export function TemplatesEmptyState({ onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center border border-purple-200">
          <Layout className="h-12 w-12 text-purple-600" />
        </div>
        <div className="absolute -top-2 -right-2 bg-purple-600 rounded-full p-1.5">
          <Zap className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Sem templates configurados
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
        Templates são modelos reutilizáveis que economizam tempo. Configure uma vez
        e crie contratos padronizados em um clique.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mb-6">
        <ActionCard
          icon={<Layout className="h-5 w-5 text-purple-600" />}
          title="Criar Template"
          description="Monte do zero"
          onClick={() => onAction?.("create_template")}
        />
        <ActionCard
          icon={<BookOpen className="h-5 w-5 text-[#e2a93b]" />}
          title="Ver Exemplos"
          description="Templates prontos"
          onClick={() => onAction?.("view_examples")}
        />
      </div>

      <TipBanner
        text="Templates populares: Contrato de Locação, Compra e Venda, Prestação de Serviços, Parceria Comercial."
      />
    </div>
  );
}

// ============================================================
// Empty State: Nenhum Relatório
// ============================================================
export function ReportsEmptyState({ onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center border border-emerald-200">
          <BarChart3 className="h-12 w-12 text-emerald-600" />
        </div>
        <div className="absolute -top-2 -right-2 bg-emerald-600 rounded-full p-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Relatórios aparecerão aqui
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
        Quando você tiver contratos cadastrados, os relatórios mostrarão KPIs,
        pipeline, vencimentos, análise de riscos e muito mais.
      </p>

      <Button
        onClick={() => onAction?.("create_contract")}
        className="bg-[#e2a93b] hover:bg-[#c99430] text-white mb-6"
      >
        <FilePlus className="h-4 w-4 mr-2" />
        Cadastre seu primeiro contrato
      </Button>

      <TipBanner
        text="Os relatórios são gerados automaticamente. Basta ter contratos cadastrados e os dashboards se preenchem sozinhos."
      />
    </div>
  );
}

// ============================================================
// Empty State: Nenhuma Análise de IA
// ============================================================
export function AIAnalysisEmptyState({ onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center border border-violet-200">
          <Brain className="h-10 w-10 text-violet-600" />
        </div>
        <div className="absolute -top-2 -right-2 bg-violet-600 rounded-full p-1.5">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Nenhuma análise de IA realizada
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
        A IA pode analisar este contrato para identificar riscos, cláusulas críticas,
        obrigações financeiras e sugestões de melhoria.
      </p>

      <Button
        onClick={() => onAction?.("run_ai_analysis")}
        className="bg-violet-600 hover:bg-violet-700 text-white"
        size="sm"
      >
        <Brain className="h-4 w-4 mr-2" />
        Executar Análise de IA
      </Button>
    </div>
  );
}

// ============================================================
// Empty State: Nenhum Documento Anexo
// ============================================================
export function DocumentsEmptyState({ onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center border border-cyan-200 mb-4">
        <Upload className="h-8 w-8 text-cyan-600" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Nenhum documento anexo
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        Anexe documentos relevantes: minutas, aditivos, comprovantes ou qualquer
        arquivo relacionado a este contrato.
      </p>

      <Button
        variant="outline"
        onClick={() => onAction?.("upload_document")}
        size="sm"
      >
        <Upload className="h-4 w-4 mr-2" />
        Anexar Documento
      </Button>
    </div>
  );
}

// ============================================================
// Componentes auxiliares reutilizáveis
// ============================================================

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-[#e2a93b]/50 hover:bg-[#e2a93b]/5 transition-all group"
    >
      <div className="mb-2 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-900">{title}</span>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  );
}

function TipBanner({ text }: { text: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-[#e2a93b] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">{text}</p>
      </div>
    </div>
  );
}
