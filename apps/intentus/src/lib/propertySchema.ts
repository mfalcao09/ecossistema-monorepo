import { z } from "zod";

export const propertySchema = z.object({
  title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres").max(200),
  property_code: z.string().trim().max(20).optional().or(z.literal("")),
  property_type: z.enum(["casa", "apartamento", "terreno", "lote", "comercial", "rural", "industrial"]),
  purpose: z.enum(["venda", "locacao", "ambos"]),
  status: z.enum(["disponivel", "reservado", "vendido", "alugado", "indisponivel", "inativo"]),

  // Address
  condominium_name: z.string().trim().max(200).optional().or(z.literal("")),
  zip_code: z.string().trim().max(10).optional().or(z.literal("")),
  street: z.string().trim().max(200).optional().or(z.literal("")),
  number: z.string().trim().max(20).optional().or(z.literal("")),
  complement: z.string().trim().max(100).optional().or(z.literal("")),
  neighborhood: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  region: z.string().trim().max(100).optional().or(z.literal("")),

  // Rooms
  rooms: z.coerce.number().int().min(0).optional(),
  suites: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  parking_spots: z.coerce.number().int().min(0).optional(),

  // Areas
  area_total: z.coerce.number().min(0).optional(),
  area_built: z.coerce.number().min(0).optional(),
  private_area: z.coerce.number().min(0).optional(),
  industrial_area: z.coerce.number().min(0).optional(),
  leasable_area: z.coerce.number().min(0).optional(),

  // Industrial
  ceiling_height: z.coerce.number().min(0).optional(),
  docks: z.coerce.number().int().min(0).optional(),
  power_capacity: z.string().trim().max(100).optional().or(z.literal("")),

  // Classificação técnica
  category: z.string().trim().max(50).optional().or(z.literal("")),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  habite_se_status: z.string().trim().max(50).optional().or(z.literal("")),
  avcb_expiry: z.string().optional().or(z.literal("")),

  // Values
  sale_price: z.coerce.number().min(0).optional(),
  rental_price: z.coerce.number().min(0).optional(),
  condominium_fee: z.coerce.number().min(0).optional(),
  iptu: z.coerce.number().min(0).optional(),
  accepts_exchange: z.boolean().optional(),
  exchange_value: z.coerce.number().min(0).optional(),

  // Flags
  show_on_website: z.boolean().optional(),
  highlight_web: z.boolean().optional(),
  has_sign: z.boolean().optional(),
  has_income: z.boolean().optional(),

  // Other
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  development_id: z.string().optional().or(z.literal("")),
  // Registro
  registration_number: z.string().trim().max(50).optional().or(z.literal("")),
  registry_office: z.string().trim().max(200).optional().or(z.literal("")),
  municipal_registration: z.string().trim().max(50).optional().or(z.literal("")),
});

export type PropertyFormValues = z.infer<typeof propertySchema>;

export const propertyTypeLabels: Record<string, string> = {
  casa: "Casa / Sobrado",
  apartamento: "Apartamento",
  terreno: "Terreno",
  lote: "Lote",
  comercial: "Comercial",
  rural: "Rural / Chácara",
  industrial: "Industrial / Galpão",
};

export const propertyCategoryLabels: Record<string, string> = {
  popular: "Popular",
  padrao: "Padrão",
  alto_padrao: "Alto Padrão",
  luxo: "Luxo",
};

export const habiteSeStatusLabels: Record<string, string> = {
  aprovado: "Aprovado",
  pendente: "Pendente",
  nao_aplicavel: "Não Aplicável",
};

export const propertyPurposeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Venda e Locação",
};

export const propertyStatusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  indisponivel: "Indisponível",
  inativo: "Inativo",
};

export const propertyStatusColors: Record<string, string> = {
  disponivel: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  reservado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  vendido: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  alugado: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  indisponivel: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  inativo: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
};

export const brazilianStates = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const defaultPropertyValues: PropertyFormValues = {
  title: "",
  property_code: "",
  property_type: "casa",
  purpose: "venda",
  status: "disponivel",
  condominium_name: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  region: "",
  rooms: 0,
  suites: 0,
  bathrooms: 0,
  parking_spots: 0,
  area_total: undefined,
  area_built: undefined,
  private_area: undefined,
  industrial_area: undefined,
  leasable_area: undefined,
  ceiling_height: undefined,
  docks: 0,
  power_capacity: "",
  category: "",
  latitude: undefined,
  longitude: undefined,
  habite_se_status: "",
  avcb_expiry: "",
  sale_price: undefined,
  rental_price: undefined,
  condominium_fee: undefined,
  iptu: undefined,
  accepts_exchange: false,
  exchange_value: undefined,
  show_on_website: true,
  highlight_web: false,
  has_sign: false,
  has_income: false,
  description: "",
  development_id: "",
  registration_number: "",
  registry_office: "",
  municipal_registration: "",
};
