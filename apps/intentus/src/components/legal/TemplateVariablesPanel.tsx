import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Home, FileText, DollarSign, PenTool, UserCheck, Building2, Stamp } from "lucide-react";

const VARIABLE_CATEGORIES = [
  {
    key: "partes",
    label: "Partes",
    icon: Users,
    variables: [
      { key: "nome_locatario", label: "Nome do Locatário" },
      { key: "cpf_locatario", label: "CPF do Locatário" },
      { key: "rg_locatario", label: "RG do Locatário" },
      { key: "endereco_locatario", label: "Endereço do Locatário" },
      { key: "nome_locador", label: "Nome do Locador" },
      { key: "cpf_locador", label: "CPF do Locador" },
      { key: "endereco_locador", label: "Endereço do Locador" },
    ],
  },
  {
    key: "imovel",
    label: "Imóvel",
    icon: Home,
    variables: [
      { key: "endereco_imovel", label: "Endereço do Imóvel" },
      { key: "tipo_imovel", label: "Tipo do Imóvel" },
      { key: "area_imovel", label: "Área do Imóvel" },
      { key: "matricula", label: "Matrícula" },
      { key: "inscricao_municipal", label: "Inscrição Municipal" },
    ],
  },
  {
    key: "contrato",
    label: "Contrato",
    icon: FileText,
    variables: [
      { key: "valor_aluguel", label: "Valor do Aluguel" },
      { key: "valor_venda", label: "Valor de Venda" },
      { key: "data_inicio", label: "Data de Início" },
      { key: "data_fim", label: "Data de Fim" },
      { key: "prazo_meses", label: "Prazo (meses)" },
      { key: "indice_reajuste", label: "Índice de Reajuste" },
      { key: "dia_vencimento", label: "Dia de Vencimento" },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    variables: [
      { key: "valor_caucao", label: "Valor da Caução" },
      { key: "taxa_administracao", label: "Taxa de Administração" },
      { key: "comissao", label: "Comissão" },
      { key: "juros_mora", label: "Juros de Mora" },
      { key: "multa_rescisoria", label: "Multa Rescisória" },
    ],
  },
  {
    key: "assinatura",
    label: "Assinatura",
    icon: PenTool,
    variables: [
      { key: "campo_assinatura_locatario", label: "Assinatura Locatário" },
      { key: "campo_assinatura_locador", label: "Assinatura Locador" },
      { key: "campo_assinatura_fiador", label: "Assinatura Fiador" },
      { key: "campo_assinatura_testemunha1", label: "Assinatura Testemunha 1" },
      { key: "campo_assinatura_testemunha2", label: "Assinatura Testemunha 2" },
      { key: "local_data", label: "Local e Data" },
    ],
  },
];

const QUALIFICATION_BLOCKS = [
  {
    key: "pf",
    label: "Qualificação Pessoa Física",
    icon: UserCheck,
    html: `<p><strong>{{nome_locatario}}</strong>, brasileiro(a), {{estado_civil}}, {{profissao}}, portador(a) do RG nº <strong>{{rg_locatario}}</strong>, inscrito(a) no CPF sob o nº <strong>{{cpf_locatario}}</strong>, residente e domiciliado(a) à <strong>{{endereco_locatario}}</strong>.</p>`,
  },
  {
    key: "pj",
    label: "Qualificação Pessoa Jurídica",
    icon: Building2,
    html: `<p><strong>{{razao_social}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>{{cnpj}}</strong>, com sede à <strong>{{endereco_sede}}</strong>, neste ato representada por seu(sua) representante legal, Sr(a). <strong>{{nome_representante}}</strong>, portador(a) do RG nº <strong>{{rg_representante}}</strong> e CPF nº <strong>{{cpf_representante}}</strong>.</p>`,
  },
  {
    key: "assinaturas",
    label: "Bloco de Assinaturas",
    icon: Stamp,
    html: `<br/><p style="text-align:center"><strong>{{local_data}}</strong></p><br/><table style="width:100%;border:none"><tr><td style="width:50%;text-align:center;border:none;padding:20px"><p>_______________________________</p><p><strong>{{campo_assinatura_locador}}</strong></p><p>LOCADOR</p></td><td style="width:50%;text-align:center;border:none;padding:20px"><p>_______________________________</p><p><strong>{{campo_assinatura_locatario}}</strong></p><p>LOCATÁRIO</p></td></tr><tr><td style="width:50%;text-align:center;border:none;padding:20px"><p>_______________________________</p><p><strong>{{campo_assinatura_testemunha1}}</strong></p><p>TESTEMUNHA 1</p></td><td style="width:50%;text-align:center;border:none;padding:20px"><p>_______________________________</p><p><strong>{{campo_assinatura_testemunha2}}</strong></p><p>TESTEMUNHA 2</p></td></tr></table>`,
  },
];

interface Props {
  onInsertVariable: (variable: string) => void;
  onInsertHtml: (html: string) => void;
}

export default function TemplateVariablesPanel({ onInsertVariable, onInsertHtml }: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Variáveis do Sistema</h3>
          <p className="text-xs text-muted-foreground mb-3">Clique para inserir na posição do cursor</p>
          <Accordion type="multiple" defaultValue={["partes"]} className="space-y-1">
            {VARIABLE_CATEGORIES.map((cat) => (
              <AccordionItem key={cat.key} value={cat.key} className="border rounded-md px-2">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  <span className="flex items-center gap-2">
                    <cat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {cat.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0">
                  <div className="flex flex-wrap gap-1">
                    {cat.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => onInsertVariable(v.key)}
                        className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 cursor-pointer"
                        title={`Inserir {{${v.key}}}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2">Modelos Pré-Prontos</h3>
          <p className="text-xs text-muted-foreground mb-3">Insere bloco completo no editor</p>
          <div className="space-y-2">
            {QUALIFICATION_BLOCKS.map((block) => (
              <Button
                key={block.key}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-auto py-2"
                onClick={() => onInsertHtml(block.html)}
              >
                <block.icon className="h-3.5 w-3.5 mr-2 shrink-0" />
                {block.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
