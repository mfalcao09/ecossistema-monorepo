const VALID_TYPES = ["ativo", "passivo", "receita", "despesa", "patrimonio_liquido"] as const;
const VALID_NATURES = ["devedora", "credora"] as const;

export interface ParsedChartRow {
  codigo: string;
  nome: string;
  tipo: string;
  natureza: string;
  codigo_pai: string;
  ativa: boolean;
  observacoes: string;
}

export interface ParseResult {
  rows: ParsedChartRow[];
  errors: string[];
}

const TEMPLATE_ROWS: ParsedChartRow[] = [
  { codigo: "1", nome: "Ativo", tipo: "ativo", natureza: "devedora", codigo_pai: "", ativa: true, observacoes: "" },
  { codigo: "1.1", nome: "Ativo Circulante", tipo: "ativo", natureza: "devedora", codigo_pai: "1", ativa: true, observacoes: "" },
  { codigo: "1.1.01", nome: "Caixa e Equivalentes", tipo: "ativo", natureza: "devedora", codigo_pai: "1.1", ativa: true, observacoes: "Dinheiro em espécie e aplicações de liquidez imediata" },
  { codigo: "1.1.02", nome: "Bancos Conta Movimento", tipo: "ativo", natureza: "devedora", codigo_pai: "1.1", ativa: true, observacoes: "" },
  { codigo: "1.1.03", nome: "Aluguéis a Receber", tipo: "ativo", natureza: "devedora", codigo_pai: "1.1", ativa: true, observacoes: "" },
  { codigo: "1.1.04", nome: "Comissões a Receber", tipo: "ativo", natureza: "devedora", codigo_pai: "1.1", ativa: true, observacoes: "Comissões de vendas e intermediações" },
  { codigo: "1.1.05", nome: "Adiantamentos a Funcionários", tipo: "ativo", natureza: "devedora", codigo_pai: "1.1", ativa: true, observacoes: "" },
  { codigo: "1.2", nome: "Ativo Não Circulante", tipo: "ativo", natureza: "devedora", codigo_pai: "1", ativa: true, observacoes: "" },
  { codigo: "1.2.01", nome: "Imóveis para Investimento", tipo: "ativo", natureza: "devedora", codigo_pai: "1.2", ativa: true, observacoes: "" },
  { codigo: "1.2.02", nome: "Móveis e Utensílios", tipo: "ativo", natureza: "devedora", codigo_pai: "1.2", ativa: true, observacoes: "" },
  { codigo: "1.2.03", nome: "Depósitos Judiciais", tipo: "ativo", natureza: "devedora", codigo_pai: "1.2", ativa: true, observacoes: "" },
  { codigo: "2", nome: "Passivo", tipo: "passivo", natureza: "credora", codigo_pai: "", ativa: true, observacoes: "" },
  { codigo: "2.1", nome: "Passivo Circulante", tipo: "passivo", natureza: "credora", codigo_pai: "2", ativa: true, observacoes: "" },
  { codigo: "2.1.01", nome: "Fornecedores", tipo: "passivo", natureza: "credora", codigo_pai: "2.1", ativa: true, observacoes: "" },
  { codigo: "2.1.02", nome: "Impostos a Recolher", tipo: "passivo", natureza: "credora", codigo_pai: "2.1", ativa: true, observacoes: "" },
  { codigo: "2.1.03", nome: "Repasses a Proprietários", tipo: "passivo", natureza: "credora", codigo_pai: "2.1", ativa: true, observacoes: "Valores de aluguel devidos aos proprietários" },
  { codigo: "2.1.04", nome: "Salários a Pagar", tipo: "passivo", natureza: "credora", codigo_pai: "2.1", ativa: true, observacoes: "" },
  { codigo: "2.2", nome: "Passivo Não Circulante", tipo: "passivo", natureza: "credora", codigo_pai: "2", ativa: true, observacoes: "" },
  { codigo: "2.2.01", nome: "Provisões Trabalhistas", tipo: "passivo", natureza: "credora", codigo_pai: "2.2", ativa: true, observacoes: "" },
  { codigo: "3", nome: "Receitas", tipo: "receita", natureza: "credora", codigo_pai: "", ativa: true, observacoes: "" },
  { codigo: "3.1", nome: "Receitas Operacionais", tipo: "receita", natureza: "credora", codigo_pai: "3", ativa: true, observacoes: "" },
  { codigo: "3.1.01", nome: "Taxa de Administração", tipo: "receita", natureza: "credora", codigo_pai: "3.1", ativa: true, observacoes: "Receita de administração de locações" },
  { codigo: "3.1.02", nome: "Comissões de Intermediação", tipo: "receita", natureza: "credora", codigo_pai: "3.1", ativa: true, observacoes: "Vendas e locações intermediadas" },
  { codigo: "3.1.03", nome: "Aluguéis de Imóveis Próprios", tipo: "receita", natureza: "credora", codigo_pai: "3.1", ativa: true, observacoes: "" },
  { codigo: "3.1.04", nome: "Taxas e Serviços", tipo: "receita", natureza: "credora", codigo_pai: "3.1", ativa: true, observacoes: "Laudos, vistorias, etc." },
  { codigo: "4", nome: "Despesas", tipo: "despesa", natureza: "devedora", codigo_pai: "", ativa: true, observacoes: "" },
  { codigo: "4.1", nome: "Despesas Operacionais", tipo: "despesa", natureza: "devedora", codigo_pai: "4", ativa: true, observacoes: "" },
  { codigo: "4.1.01", nome: "Pessoal e Encargos", tipo: "despesa", natureza: "devedora", codigo_pai: "4.1", ativa: true, observacoes: "" },
  { codigo: "4.1.02", nome: "Aluguel da Sede", tipo: "despesa", natureza: "devedora", codigo_pai: "4.1", ativa: true, observacoes: "" },
  { codigo: "4.1.03", nome: "Marketing e Publicidade", tipo: "despesa", natureza: "devedora", codigo_pai: "4.1", ativa: true, observacoes: "" },
  { codigo: "4.1.04", nome: "Sistemas e Tecnologia", tipo: "despesa", natureza: "devedora", codigo_pai: "4.1", ativa: true, observacoes: "" },
  { codigo: "4.1.05", nome: "Despesas Jurídicas", tipo: "despesa", natureza: "devedora", codigo_pai: "4.1", ativa: true, observacoes: "" },
  { codigo: "5", nome: "Patrimônio Líquido", tipo: "patrimonio_liquido", natureza: "credora", codigo_pai: "", ativa: true, observacoes: "" },
  { codigo: "5.1", nome: "Capital Social", tipo: "patrimonio_liquido", natureza: "credora", codigo_pai: "5", ativa: true, observacoes: "" },
  { codigo: "5.2", nome: "Reservas de Lucros", tipo: "patrimonio_liquido", natureza: "credora", codigo_pai: "5", ativa: true, observacoes: "" },
  { codigo: "5.3", nome: "Lucros/Prejuízos Acumulados", tipo: "patrimonio_liquido", natureza: "credora", codigo_pai: "5", ativa: true, observacoes: "" },
];

function rowToCSVLine(r: ParsedChartRow): string {
  const fields = [r.codigo, r.nome, r.tipo, r.natureza, r.codigo_pai, r.ativa ? "sim" : "nao", r.observacoes];
  return fields.map((f) => `"${(f ?? "").replace(/"/g, '""')}"`).join(";");
}

export function downloadChartTemplate() {
  const header = "codigo;nome;tipo;natureza;codigo_pai;ativa;observacoes";
  const lines = [header, ...TEMPLATE_ROWS.map(rowToCSVLine)];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_plano_de_contas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ";" || ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseChartCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { rows: [], errors: ["Arquivo vazio ou sem dados"] };

  const headerLine = lines[0].toLowerCase().replace(/"/g, "");
  const headerFields = headerLine.split(/[;,]/).map((h) => h.trim());
  const idxCodigo = headerFields.indexOf("codigo");
  const idxNome = headerFields.indexOf("nome");
  const idxTipo = headerFields.indexOf("tipo");
  const idxNatureza = headerFields.indexOf("natureza");
  const idxPai = headerFields.indexOf("codigo_pai");
  const idxAtiva = headerFields.indexOf("ativa");
  const idxObs = headerFields.indexOf("observacoes");

  const errors: string[] = [];
  if (idxCodigo === -1) errors.push("Coluna 'codigo' não encontrada");
  if (idxNome === -1) errors.push("Coluna 'nome' não encontrada");
  if (idxTipo === -1) errors.push("Coluna 'tipo' não encontrada");
  if (idxNatureza === -1) errors.push("Coluna 'natureza' não encontrada");
  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedChartRow[] = [];
  const codigosSeen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    const lineNum = i + 1;
    const codigo = fields[idxCodigo]?.trim() || "";
    const nome = fields[idxNome]?.trim() || "";
    const tipo = fields[idxTipo]?.trim().toLowerCase() || "";
    const natureza = fields[idxNatureza]?.trim().toLowerCase() || "";
    const codigoPai = idxPai >= 0 ? (fields[idxPai]?.trim() || "") : "";
    const ativaStr = idxAtiva >= 0 ? (fields[idxAtiva]?.trim().toLowerCase() || "sim") : "sim";
    const obs = idxObs >= 0 ? (fields[idxObs]?.trim() || "") : "";

    if (!codigo) { errors.push(`Linha ${lineNum}: código vazio`); continue; }
    if (!nome) { errors.push(`Linha ${lineNum}: nome vazio`); continue; }
    if (!VALID_TYPES.includes(tipo as any)) { errors.push(`Linha ${lineNum}: tipo inválido "${tipo}"`); continue; }
    if (!VALID_NATURES.includes(natureza as any)) { errors.push(`Linha ${lineNum}: natureza inválida "${natureza}"`); continue; }
    if (codigosSeen.has(codigo)) { errors.push(`Linha ${lineNum}: código duplicado "${codigo}"`); continue; }

    codigosSeen.add(codigo);
    rows.push({ codigo, nome, tipo, natureza, codigo_pai: codigoPai, ativa: ativaStr !== "nao", observacoes: obs });
  }

  // Validate parent references
  for (const row of rows) {
    if (row.codigo_pai && !codigosSeen.has(row.codigo_pai)) {
      errors.push(`Conta "${row.codigo}": codigo_pai "${row.codigo_pai}" não encontrado no arquivo`);
    }
  }

  return { rows, errors };
}
