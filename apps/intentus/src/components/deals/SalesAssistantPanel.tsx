import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Copy, Loader2, Zap, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateScript,
  usePrepareVisit,
  useGenerateProposal,
  useHandleObjection,
  SalesScript,
  VisitPrep,
  CommercialProposal,
  ObjectionResponse,
  OBJECTION_CATEGORY_LABELS,
} from "@/hooks/useSalesAssistant";
import { Textarea } from "@/components/ui/textarea";

interface SalesAssistantPanelProps {
  dealId: string;
  leadId?: string;
  propertyId?: string;
}

export function SalesAssistantPanel({
  dealId,
  leadId,
  propertyId,
}: SalesAssistantPanelProps) {
  const generateScript = useGenerateScript();
  const prepareVisit = usePrepareVisit();
  const generateProposal = useGenerateProposal();
  const handleObjection = useHandleObjection();

  const [objectionText, setObjectionText] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para área de transferência");
  };

  return (
    <Tabs defaultValue="script" className="w-full">
      <TabsList className="grid w-full grid-cols-4 gap-1">
        <TabsTrigger value="script" className="text-xs sm:text-sm">
          Script
        </TabsTrigger>
        <TabsTrigger value="visit" className="text-xs sm:text-sm">
          Visita
        </TabsTrigger>
        <TabsTrigger value="proposal" className="text-xs sm:text-sm">
          Proposta
        </TabsTrigger>
        <TabsTrigger value="objection" className="text-xs sm:text-sm">
          Objeções
        </TabsTrigger>
      </TabsList>

      {/* Script de Vendas Tab */}
      <TabsContent value="script" className="space-y-4">
        <Button
          onClick={() =>
            generateScript.mutate({
              deal_id: dealId,
              lead_id: leadId,
            })
          }
          disabled={generateScript.isPending}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {generateScript.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <Zap className="mr-2 h-4 w-4" />
          Gerar Script
        </Button>

        {generateScript.data && !generateScript.error && (
          <ScriptDisplay script={generateScript.data} onCopy={copyToClipboard} />
        )}

        {generateScript.error && (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Erro ao gerar script</p>
                <p className="text-sm text-red-700">
                  {String(generateScript.error)}
                </p>
              </div>
            </div>
          </Card>
        )}
      </TabsContent>

      {/* Preparar Visita Tab */}
      <TabsContent value="visit" className="space-y-4">
        <Button
          onClick={() =>
            prepareVisit.mutate({
              deal_id: dealId,
              property_id: propertyId,
              lead_id: leadId,
            })
          }
          disabled={prepareVisit.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {prepareVisit.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <BookOpen className="mr-2 h-4 w-4" />
          Preparar Visita
        </Button>

        {prepareVisit.data && !prepareVisit.error && (
          <VisitPrepDisplay prep={prepareVisit.data} onCopy={copyToClipboard} />
        )}

        {prepareVisit.error && (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Erro ao preparar visita
              </p>
            </div>
          </Card>
        )}
      </TabsContent>

      {/* Proposta Comercial Tab */}
      <TabsContent value="proposal" className="space-y-4">
        <Button
          onClick={() =>
            generateProposal.mutate({
              deal_id: dealId,
              include_pricing: true,
            })
          }
          disabled={generateProposal.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {generateProposal.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <Zap className="mr-2 h-4 w-4" />
          Gerar Proposta
        </Button>

        {generateProposal.data && !generateProposal.error && (
          <ProposalDisplay
            proposal={generateProposal.data}
            onCopy={copyToClipboard}
          />
        )}

        {generateProposal.error && (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Erro ao gerar proposta
              </p>
            </div>
          </Card>
        )}
      </TabsContent>

      {/* Objeções Tab */}
      <TabsContent value="objection" className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Objeção do cliente:</label>
          <Textarea
            placeholder="Ex: 'O preço está muito alto para esta região'"
            value={objectionText}
            onChange={(e) => setObjectionText(e.target.value)}
            rows={3}
          />
          <Button
            onClick={() =>
              handleObjection.mutate({
                objection_text: objectionText,
                deal_id: dealId,
              })
            }
            disabled={handleObjection.isPending || !objectionText.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {handleObjection.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <AlertCircle className="mr-2 h-4 w-4" />
            Analisar Objeção
          </Button>
        </div>

        {handleObjection.data && !handleObjection.error && (
          <ObjectionDisplay
            response={handleObjection.data}
            onCopy={copyToClipboard}
          />
        )}

        {handleObjection.error && (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Erro ao analisar objeção
              </p>
            </div>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

// Script Display Component
function ScriptDisplay({
  script,
  onCopy,
}: {
  script: SalesScript;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-purple-900 mb-2">Abertura</h3>
            <p className="text-sm text-purple-800 leading-relaxed">
              {script.opening}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCopy(script.opening)}
              className="mt-2 h-7"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 p-4">
        <div>
          <h3 className="font-semibold text-blue-900 mb-3">
            Perguntas de Descoberta
          </h3>
          <ul className="space-y-2">
            {script.discovery_questions.map((q, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-blue-800 leading-relaxed"
              >
                <span className="font-semibold flex-shrink-0">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 p-4">
        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Proposição de Valor
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {script.value_proposition}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopy(script.value_proposition)}
            className="mt-2 h-7"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 p-4">
        <div>
          <h3 className="font-semibold text-orange-900 mb-3">
            Tratamento de Objeções
          </h3>
          <div className="space-y-3">
            {script.objection_handlers.map((handler, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-orange-900">
                  • {handler.objection}
                </p>
                <p className="text-orange-800 mt-1 ml-4">{handler.response}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 p-4">
        <div>
          <h3 className="font-semibold text-red-900 mb-2">
            Técnica de Fechamento
          </h3>
          <p className="text-sm text-red-800 leading-relaxed">
            {script.closing_technique}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopy(script.closing_technique)}
            className="mt-2 h-7"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200 p-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Fatos Principais</h3>
          <ul className="space-y-1">
            {script.key_facts.map((fact, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-gray-400">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

// Visit Prep Display Component
function VisitPrepDisplay({
  prep,
  onCopy,
}: {
  prep: VisitPrep;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Checklist</h3>
        <div className="space-y-2">
          {prep.checklist.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-800">{item}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 p-4">
        <h3 className="font-semibold text-emerald-900 mb-3">
          Pontos de Conversa
        </h3>
        <ul className="space-y-2">
          {prep.talking_points.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-emerald-800">
              <span className="font-semibold flex-shrink-0">{i + 1}.</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 p-4">
        <h3 className="font-semibold text-purple-900 mb-2">
          Posicionamento vs Comparáveis
        </h3>
        <p className="text-sm text-purple-800 leading-relaxed">
          {prep.comparables_pitch}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCopy(prep.comparables_pitch)}
          className="mt-2 h-7"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </Button>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 p-4">
        <h3 className="font-semibold text-orange-900 mb-2">
          Notas Específicas do Cliente
        </h3>
        <p className="text-sm text-orange-800 leading-relaxed">
          {prep.client_specific_notes}
        </p>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 p-4">
        <h3 className="font-semibold text-red-900 mb-2">Plano de Follow-up</h3>
        <p className="text-sm text-red-800 leading-relaxed">
          {prep.follow_up_plan}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCopy(prep.follow_up_plan)}
          className="mt-2 h-7"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </Button>
      </Card>
    </div>
  );
}

// Proposal Display Component
function ProposalDisplay({
  proposal,
  onCopy,
}: {
  proposal: CommercialProposal;
  onCopy: (text: string) => void;
}) {
  const fullText = `
${proposal.proposal_title}

${proposal.executive_summary}

Descrição do Imóvel:
${proposal.property_description}

Justificativa de Preço:
${proposal.pricing_justification}

Condições de Pagamento:
${proposal.payment_conditions}

Diferenciais:
${proposal.differentials}

Próximos Passos:
${proposal.next_steps}

Validade: ${proposal.validity_period}
  `.trim();

  return (
    <div className="space-y-4">
      <Button
        onClick={() => onCopy(fullText)}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        size="sm"
      >
        <Copy className="h-4 w-4 mr-2" />
        Copiar Proposta Completa
      </Button>

      <Card className="border-emerald-200 bg-emerald-50 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-emerald-900 mb-2">
            {proposal.proposal_title}
          </h2>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Sumário Executivo
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {proposal.executive_summary}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Descrição do Imóvel
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {proposal.property_description}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Justificativa de Preço
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {proposal.pricing_justification}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Condições de Pagamento
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {proposal.payment_conditions}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Diferenciais
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {proposal.differentials}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-emerald-900 mb-2">
            Próximos Passos
          </h3>
          <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-line">
            {proposal.next_steps}
          </p>
        </div>

        <div className="pt-4 border-t border-emerald-200">
          <p className="text-xs text-emerald-700 font-medium">
            Validade: {proposal.validity_period}
          </p>
        </div>
      </Card>
    </div>
  );
}

// Objection Response Display Component
function ObjectionDisplay({
  response,
  onCopy,
}: {
  response: ObjectionResponse;
  onCopy: (text: string) => void;
}) {
  const successChance = Math.round(response.success_probability * 100);

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-orange-50 p-4">
        <div className="mb-4">
          <div className="inline-block">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-200 text-orange-800">
              {OBJECTION_CATEGORY_LABELS[response.objection_category as keyof typeof OBJECTION_CATEGORY_LABELS] ||
                "Outra"}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-orange-900 mb-2">
              Resposta com Empatia
            </h3>
            <p className="text-sm text-orange-800 leading-relaxed">
              {response.empathy_response}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCopy(response.empathy_response)}
              className="mt-2 h-7"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
          </div>

          <div>
            <h3 className="font-semibold text-orange-900 mb-2">
              Contra-argumentos
            </h3>
            <ul className="space-y-2">
              {response.counter_arguments.map((arg, i) => (
                <li key={i} className="flex gap-2 text-sm text-orange-800">
                  <span className="font-semibold flex-shrink-0">{i + 1}.</span>
                  <span>{arg}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-orange-900 mb-2">
              Técnica de Reframing
            </h3>
            <p className="text-sm text-orange-800 leading-relaxed italic">
              {response.reframe_technique}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-orange-200">
            <span className="text-sm font-semibold text-orange-900">
              Probabilidade de Sucesso:
            </span>
            <div className="flex-1 bg-orange-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-orange-600 h-full rounded-full transition-all"
                style={{ width: `${successChance}%` }}
              />
            </div>
            <span className="text-sm font-bold text-orange-900">
              {successChance}%
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
