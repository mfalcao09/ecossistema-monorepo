// =============================================
// Defaults & Types for Maintenance Customization
// =============================================

export interface InspectionItem {
  name: string;
  has_condition: boolean;
}

export interface InspectionCategory {
  name: string;
  items: InspectionItem[];
}

export interface InspectionPropertyType {
  label: string;
  categories: InspectionCategory[];
}

export interface MaintenanceCategory {
  name: string;
  services: string[];
}

export interface MaintenancePropertyType {
  label: string;
  categories: MaintenanceCategory[];
}

export type WorkflowStepType = "juridico" | "financeiro" | "vistoria" | "registro" | "operacional";

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  required: boolean;
  description: string;
  order: number;
}

export interface MaintenanceCustomization {
  inspection_templates: Record<string, InspectionPropertyType>;
  maintenance_types: Record<string, MaintenancePropertyType>;
  key_delivery_workflow: { steps: WorkflowStep[] };
}

// ---- Helpers ----
const items = (...names: string[]): InspectionItem[] =>
  names.map((n) => ({ name: n, has_condition: true }));

// ---- INSPECTION DEFAULTS ----
const defaultInspectionTemplates: Record<string, InspectionPropertyType> = {
  residencial: {
    label: "Residencial",
    categories: [
      { name: "Sala de Estar/Jantar", items: items("Piso", "Paredes", "Teto/Forro", "Rodapés", "Portas", "Janelas", "Fechaduras", "Tomadas/Interruptores", "Iluminação") },
      { name: "Cozinha", items: items("Piso", "Paredes", "Teto", "Bancada", "Pia/Cuba", "Torneira", "Rejunte/Azulejos", "Armários", "Exaustor/Coifa", "Tomadas") },
      { name: "Banheiro", items: items("Piso", "Paredes", "Teto", "Box/Divisória", "Vaso Sanitário", "Pia/Lavatório", "Chuveiro", "Torneira", "Espelho", "Rejunte", "Ralo") },
      { name: "Quarto", items: items("Piso", "Paredes", "Teto", "Portas", "Janelas", "Armário Embutido", "Tomadas", "Iluminação") },
      { name: "Área de Serviço", items: items("Piso", "Paredes", "Tanque", "Torneira", "Tomadas", "Varal") },
      { name: "Área Externa/Varanda", items: items("Piso", "Guarda-corpo", "Teto", "Iluminação", "Ralo") },
      { name: "Instalações Gerais", items: items("Quadro Elétrico", "Registro de Água/Gás", "Interfone/Porteiro", "Fechaduras/Maçanetas", "Chaves Entregues", "Controle Portão/Garagem", "Pintura Geral", "Limpeza Geral") },
    ],
  },
  comercial: {
    label: "Comercial",
    categories: [
      { name: "Recepção/Hall", items: items("Piso", "Paredes", "Forro", "Iluminação", "Portas de Vidro", "Ar-condicionado") },
      { name: "Salas/Escritórios", items: items("Piso", "Paredes", "Divisórias", "Tomadas", "Pontos de Rede/Telefone", "Iluminação", "Ar-condicionado") },
      { name: "Copa/Cozinha", items: items("Piso", "Paredes", "Pia", "Torneira", "Bancada") },
      { name: "Banheiros", items: items("Piso", "Paredes", "Vaso", "Pia", "Torneira", "Espelho", "Ralo") },
      { name: "Estacionamento", items: items("Piso", "Sinalização", "Portão", "Vagas Demarcadas") },
      { name: "Fachada/Externo", items: items("Fachada", "Letreiro/Placa", "Calçada", "Iluminação Externa") },
      { name: "Segurança/AVCB", items: items("Extintores", "Saída de Emergência", "CFTV", "Alarme", "Sinalização") },
    ],
  },
  industrial: {
    label: "Industrial/Galpão",
    categories: [
      { name: "Piso Industrial", items: items("Piso", "Juntas de Dilatação", "Drenagem", "Nivelamento") },
      { name: "Cobertura/Estrutura", items: items("Telhado", "Calhas", "Estrutura Metálica", "Telhas Translúcidas") },
      { name: "Docas/Acesso", items: items("Docas de Carga", "Portões", "Rampas", "Niveladores") },
      { name: "Instalações Elétricas", items: items("Cabine Primária", "Quadro Geral", "Iluminação Industrial", "Tomadas Industriais") },
      { name: "Instalações Hidráulicas/Incêndio", items: items("Reservatório", "Hidrantes", "Sprinklers", "Esgoto Industrial") },
      { name: "Área Administrativa", items: items("Piso", "Paredes", "Ar-condicionado", "Tomadas", "Iluminação") },
      { name: "Área Externa", items: items("Cerca/Muro", "Portaria", "Pátio de Manobra", "Estacionamento") },
    ],
  },
  terreno: {
    label: "Terreno",
    categories: [
      { name: "Terreno", items: items("Cercamento/Muro", "Limpeza", "Nivelamento", "Drenagem", "Acesso", "Sinalização", "Vegetação", "Marcos/Divisas") },
    ],
  },
};

// ---- MAINTENANCE TYPE DEFAULTS ----
const defaultMaintenanceTypes: Record<string, MaintenancePropertyType> = {
  residencial: {
    label: "Residencial",
    categories: [
      { name: "Hidráulica", services: ["Vazamento", "Entupimento", "Troca de Torneira", "Registro", "Caixa d'Água", "Aquecedor"] },
      { name: "Elétrica", services: ["Curto-circuito", "Troca de Disjuntor", "Tomada/Interruptor", "Iluminação", "Quadro Elétrico"] },
      { name: "Estrutural", services: ["Trinca/Fissura", "Infiltração", "Mofo/Bolor", "Telhado", "Forro/Laje"] },
      { name: "Acabamento", services: ["Pintura", "Piso", "Rejunte", "Porta/Janela", "Fechadura", "Vidro"] },
      { name: "Equipamentos", services: ["Ar-condicionado", "Portão Eletrônico", "Interfone", "Aquecedor", "Exaustor"] },
    ],
  },
  comercial: {
    label: "Comercial",
    categories: [
      { name: "Hidráulica", services: ["Vazamento", "Entupimento", "Troca de Torneira", "Registro", "Caixa d'Água"] },
      { name: "Elétrica", services: ["Curto-circuito", "Troca de Disjuntor", "Tomada/Interruptor", "Iluminação", "Quadro Elétrico"] },
      { name: "Estrutural", services: ["Trinca/Fissura", "Infiltração", "Mofo/Bolor", "Telhado", "Forro/Laje"] },
      { name: "Acabamento", services: ["Pintura", "Piso", "Rejunte", "Porta/Janela", "Fechadura", "Vidro"] },
      { name: "Climatização", services: ["HVAC Central", "Split", "Dutos", "Filtragem"] },
      { name: "TI/Infraestrutura", services: ["Cabeamento", "Rack", "Ponto de Rede", "No-break"] },
      { name: "Segurança", services: ["CFTV", "Alarme", "Controle de Acesso", "Extintores"] },
    ],
  },
  industrial: {
    label: "Industrial/Galpão",
    categories: [
      { name: "Hidráulica", services: ["Vazamento", "Entupimento", "Registro", "Caixa d'Água"] },
      { name: "Elétrica", services: ["Curto-circuito", "Disjuntor", "Iluminação Industrial", "Quadro Geral"] },
      { name: "Estrutural", services: ["Trinca/Fissura", "Infiltração", "Telhado", "Estrutura Metálica"] },
      { name: "Climatização", services: ["HVAC Central", "Split", "Dutos", "Filtragem"] },
      { name: "Industrial", services: ["Piso Industrial", "Docas", "Pontes Rolantes", "Compressores"] },
      { name: "Combate a Incêndio", services: ["Sprinklers", "Hidrantes", "Detectores", "Central de Alarme"] },
    ],
  },
};

// ---- KEY DELIVERY WORKFLOW DEFAULTS ----
const defaultKeyDeliveryWorkflow: { steps: WorkflowStep[] } = {
  steps: [
    { id: "contrato_assinado", name: "Verificar Contrato Assinado", type: "juridico", required: true, description: "Confirmar que o contrato foi devidamente assinado por todas as partes.", order: 1 },
    { id: "vistoria_concluida", name: "Vistoria de Entrada/Saída Concluída", type: "vistoria", required: true, description: "Assegurar que a vistoria do imóvel foi realizada e documentada.", order: 2 },
    { id: "laudo_aprovado", name: "Laudo de Vistoria Aprovado", type: "vistoria", required: true, description: "Laudo assinado por ambas as partes com registro fotográfico.", order: 3 },
    { id: "garantia_validada", name: "Garantia Locatícia Validada", type: "financeiro", required: false, description: "Verificar que a garantia (caução, fiador, seguro) está ativa.", order: 4 },
    { id: "pagamento_confirmado", name: "Primeiro Pagamento Confirmado", type: "financeiro", required: false, description: "Confirmar recebimento do primeiro aluguel ou taxa de intermediação.", order: 5 },
    { id: "termo_entrega", name: "Assinatura do Termo de Entrega de Chaves", type: "juridico", required: true, description: "Assinar o termo de entrega de chaves com todas as partes.", order: 6 },
    { id: "registro_fotografico", name: "Registro Fotográfico de Entrega", type: "registro", required: false, description: "Fotografar o ato de entrega e o estado das chaves.", order: 7 },
    { id: "leitura_medidores", name: "Leitura de Medidores (água, luz, gás)", type: "registro", required: false, description: "Registrar leituras dos medidores no momento da entrega.", order: 8 },
    { id: "entrega_fisica", name: "Entrega Física das Chaves", type: "operacional", required: true, description: "Entregar as chaves ao inquilino/comprador com registro.", order: 9 },
    { id: "confirmacao_sistema", name: "Confirmação no Sistema", type: "operacional", required: true, description: "Registrar a conclusão da entrega no sistema.", order: 10 },
  ],
};

export function getDefaultMaintenanceCustomization(): MaintenanceCustomization {
  return {
    inspection_templates: JSON.parse(JSON.stringify(defaultInspectionTemplates)),
    maintenance_types: JSON.parse(JSON.stringify(defaultMaintenanceTypes)),
    key_delivery_workflow: JSON.parse(JSON.stringify(defaultKeyDeliveryWorkflow)),
  };
}

export function mergeMaintenanceCustomization(
  saved?: Partial<MaintenanceCustomization> | null
): MaintenanceCustomization {
  const defaults = getDefaultMaintenanceCustomization();
  if (!saved) return defaults;
  return {
    inspection_templates: saved.inspection_templates && Object.keys(saved.inspection_templates).length
      ? saved.inspection_templates as Record<string, InspectionPropertyType>
      : defaults.inspection_templates,
    maintenance_types: saved.maintenance_types && Object.keys(saved.maintenance_types).length
      ? saved.maintenance_types as Record<string, MaintenancePropertyType>
      : defaults.maintenance_types,
    key_delivery_workflow: saved.key_delivery_workflow?.steps?.length
      ? saved.key_delivery_workflow as { steps: WorkflowStep[] }
      : defaults.key_delivery_workflow,
  };
}

export const stepTypeLabels: Record<WorkflowStepType, string> = {
  juridico: "Jurídico",
  financeiro: "Financeiro",
  vistoria: "Vistoria",
  registro: "Registro",
  operacional: "Operacional",
};

export const stepTypeColors: Record<WorkflowStepType, string> = {
  juridico: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  financeiro: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  vistoria: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  registro: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  operacional: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};
