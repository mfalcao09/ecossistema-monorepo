/**
 * exportExcelFull.ts — Export Excel completo (US-32)
 * Sessão 146 — Bloco K
 *
 * Gera um workbook .xlsx com múltiplas abas cobrindo TODOS os módulos
 * do parcelamento. Usa SheetJS (xlsx) para geração client-side.
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */
import * as XLSX from "xlsx";
import type { ReportTecnicoDataResult } from "@/hooks/useReportTecnicoData";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";
import type { ZoneamentoPDFData, MemorialPDFData, FiiCraPDFData } from "./pdf-tecnico/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExcelExportParams {
  project: ParcelamentoDevelopment;
  data: ReportTecnicoDataResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "";
  return v.toFixed(decimals);
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "";
  return `${(v * 100).toFixed(1)}%`;
}

function addSheet(wb: XLSX.WorkBook, name: string, data: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Auto-width columns
  const colWidths = data[0]?.map((_, colIdx) => {
    let max = 10;
    for (const row of data) {
      const cell = row[colIdx];
      const len = cell != null ? String(cell).length : 0;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 50) };
  });
  if (colWidths) ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31)); // Excel limit: 31 chars
}

// ---------------------------------------------------------------------------
// Sheet Builders
// ---------------------------------------------------------------------------

function buildResumoSheet(project: ParcelamentoDevelopment, data: ReportTecnicoDataResult): unknown[][] {
  const rows: unknown[][] = [
    ["RELATÓRIO TÉCNICO — RESUMO"],
    [],
    ["Empreendimento", project.name ?? "—"],
    ["Tipo", project.tipo ?? "—"],
    ["Cidade / UF", `${project.city ?? "—"} / ${project.state ?? "—"}`],
    ["Área Total (m²)", project.area_m2 ?? ""],
    ["Área Total (ha)", project.area_m2 ? fmt(project.area_m2 / 10000, 4) : ""],
    ["Perímetro (m)", project.perimeter_m ?? ""],
    ["Total de Lotes", project.total_units ?? ""],
    ["VGV Estimado", fmtBRL(project.vgv_estimado)],
    [],
    ["Status da Análise", project.analysis_status ?? "—"],
    ["Data de Geração", new Date().toLocaleDateString("pt-BR")],
  ];
  return rows;
}

function buildFinanceiroSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  const f = data.financial;
  if (!f) return null;

  const rows: unknown[][] = [
    ["ANÁLISE FINANCEIRA"],
    [],
    ["Indicador", "Valor"],
    ["VGV Bruto", fmtBRL(f.vgv_bruto)],
    ["VGV Líquido", fmtBRL(f.vgv_liquido)],
    ["Custo Total", fmtBRL(f.custo_total)],
    ["Lucro Bruto", fmtBRL(f.lucro_bruto)],
    ["Margem Bruta", fmtPct(f.margem_bruta_pct)],
    ["TIR", fmtPct(f.tir)],
    ["VPL", fmtBRL(f.vpl)],
    ["Payback (meses)", f.payback_meses ?? ""],
    ["Exposure Máx.", fmtBRL(f.exposure_max)],
    ["WACC", fmtPct(f.wacc)],
  ];

  // Cost breakdown
  if (f.custos_detalhados) {
    rows.push([], ["ESTRUTURA DE CUSTOS"], ["Item", "Valor", "% do Total"]);
    const cd = f.custos_detalhados as Record<string, number>;
    const total = f.custo_total ?? 1;
    for (const [key, val] of Object.entries(cd)) {
      rows.push([key, fmtBRL(val), fmtPct(val / total)]);
    }
  }

  // Cash flow
  if (f.fluxo_caixa && Array.isArray(f.fluxo_caixa) && f.fluxo_caixa.length > 0) {
    rows.push([], ["FLUXO DE CAIXA"], ["Mês", "Receita", "Custo", "Líquido", "Acumulado"]);
    for (const entry of f.fluxo_caixa) {
      rows.push([
        entry.mes ?? entry.month,
        fmtBRL(entry.receita ?? entry.revenue),
        fmtBRL(entry.custo ?? entry.cost),
        fmtBRL(entry.liquido ?? entry.net),
        fmtBRL(entry.acumulado ?? entry.cumulative),
      ]);
    }
  }

  // Monte Carlo
  if (f.monte_carlo) {
    const mc = f.monte_carlo as Record<string, unknown>;
    rows.push([], ["MONTE CARLO"], ["Métrica", "P5", "P50", "P95", "Média"]);
    const metrics = ["vpl", "tir", "payback", "margem"];
    for (const m of metrics) {
      const d = mc[m] as Record<string, number> | undefined;
      if (d) {
        rows.push([m.toUpperCase(), fmt(d.p5), fmt(d.p50), fmt(d.p95), fmt(d.mean)]);
      }
    }
  }

  return rows;
}

function buildLegalSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  const la = data.legalAnalysis;
  if (!la) return null;

  const rows: unknown[][] = [
    ["CONFORMIDADE LEGAL"],
    [],
    ["Score de Conformidade", la.compliance_score ?? "—"],
    [],
  ];

  if (la.violations?.length) {
    rows.push(["VIOLAÇÕES"], ["Artigo", "Descrição", "Severidade", "Recomendação"]);
    for (const v of la.violations) {
      rows.push([v.article, v.description, v.severity, v.recommendation]);
    }
    rows.push([]);
  }

  if (la.warnings?.length) {
    rows.push(["ALERTAS"], ["Artigo", "Descrição", "Recomendação"]);
    for (const w of la.warnings) {
      rows.push([w.article, w.description, w.recommendation]);
    }
    rows.push([]);
  }

  if (la.recommendations?.length) {
    rows.push(["ITENS CONFORMES"], ["Artigo", "Descrição"]);
    for (const r of la.recommendations) {
      rows.push([r.article, r.description]);
    }
  }

  return rows;
}

function buildRegulacoesSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.itbi && !data.outorga && !data.leiVerde && !data.cnpjSpe) return null;

  const rows: unknown[][] = [["REGULAÇÕES BRASILEIRAS"], []];

  if (data.itbi) {
    rows.push(
      ["ITBI"],
      ["Município", `${data.itbi.municipio}/${data.itbi.uf}`],
      ["Alíquota", fmtPct(data.itbi.aliquota_pct)],
      ["ITBI Aquisição Terreno", fmtBRL(data.itbi.resumo?.itbi_aquisicao_terreno)],
      ["ITBI Total Vendas", fmtBRL(data.itbi.resumo?.itbi_total_vendas_lotes)],
      ["ITBI Total", fmtBRL(data.itbi.resumo?.itbi_total)],
      ["% do VGV", fmtPct(data.itbi.resumo?.itbi_pct_vgv)],
      []
    );
  }

  if (data.outorga) {
    rows.push(
      ["OUTORGA ONEROSA"],
      ["Município", `${data.outorga.municipio}/${data.outorga.uf}`],
      ["CA Básico / Máximo", `${data.outorga.parametros_urbanisticos?.ca_basico} / ${data.outorga.parametros_urbanisticos?.ca_maximo}`],
      ["Isento?", data.outorga.isento ? `Sim — ${data.outorga.motivo_isencao}` : "Não"],
      ["Valor Outorga", fmtBRL(data.outorga.calculo?.outorga_valor)],
      []
    );
  }

  if (data.leiVerde?.checklist?.length) {
    rows.push(["LEI DO VERDE / PERMEABILIDADE"], ["Item", "Status", "Exigido", "Atual"]);
    for (const item of data.leiVerde.checklist) {
      rows.push([item.item, item.status, item.exigido, item.atual]);
    }
    rows.push([]);
  }

  if (data.cnpjSpe?.dados_receita) {
    rows.push(
      ["VALIDAÇÃO CNPJ/SPE"],
      ["CNPJ", data.cnpjSpe.cnpj_formatado ?? ""],
      ["Razão Social", data.cnpjSpe.dados_receita.razao_social ?? ""],
      ["Situação", data.cnpjSpe.dados_receita.situacao ?? ""],
      ["É SPE?", data.cnpjSpe.is_spe ? "Sim" : "Não"],
    );
  }

  return rows;
}

function buildBenchmarksSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.sinapi && !data.secovi && !data.abrainc) return null;

  const rows: unknown[][] = [["BENCHMARKS DE MERCADO"], []];

  if (data.sinapi?.itens?.length) {
    rows.push(["SINAPI — Custos de Construção"], ["Código", "Descrição", "Unidade", "Custo Total", "Grupo"]);
    for (const item of data.sinapi.itens) {
      rows.push([item.codigo, item.descricao, item.unidade, fmtBRL(item.custo_total), item.grupo]);
    }
    rows.push([]);
  }

  if (data.secovi?.precos?.length) {
    rows.push(["SECOVI — Preços Imobiliários"], ["Cidade/UF", "Tipo", "R$/m² Médio", "Min", "Máx", "Var. 12m"]);
    for (const p of data.secovi.precos) {
      rows.push([`${p.cidade}/${p.uf}`, p.tipo_imovel, fmtBRL(p.preco_m2_medio), fmtBRL(p.preco_m2_min), fmtBRL(p.preco_m2_max), fmtPct(p.variacao_12m_pct)]);
    }
    rows.push([]);
  }

  if (data.abrainc?.lancamentos?.length) {
    rows.push(["ABRAINC — Lançamentos"], ["Região", "Programa", "Lançadas", "Vendidas", "% Vendido", "Var. 12m"]);
    for (const l of data.abrainc.lancamentos) {
      rows.push([l.regiao, l.tipo_programa, l.unidades_lancadas, l.unidades_vendidas, fmtPct(l.pct_vendido), fmtPct(l.variacao_12m_pct)]);
    }
  }

  return rows;
}

function buildCensoSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.censusIncome?.length && !data.censusDemographics?.length && !data.censusHousing?.length) return null;

  const rows: unknown[][] = [["DADOS CENSITÁRIOS IBGE"], []];

  if (data.censusIncome?.length) {
    rows.push(["RENDA DOMICILIAR"], ["Município/UF", "Renda Média", "Per Capita", "> 5 SM", "Classe"]);
    for (const item of data.censusIncome) {
      rows.push([`${item.municipio_nome}/${item.uf}`, fmtBRL(item.renda_domiciliar_media), fmtBRL(item.renda_per_capita), fmtPct(item.pct_renda_acima_5sm), item.classe_predominante]);
    }
    rows.push([]);
  }

  if (data.censusDemographics?.length) {
    rows.push(["DEMOGRAFIA"], ["Município/UF", "População", "Dens. hab/km²", "Cresc. a.a.", "% Urbana", "Idade Méd."]);
    for (const d of data.censusDemographics) {
      rows.push([`${d.municipio_nome}/${d.uf}`, d.populacao_total, fmt(d.densidade_hab_km2, 0), fmtPct(d.taxa_crescimento_anual_pct), fmtPct(d.populacao_urbana_pct), fmt(d.idade_media, 0)]);
    }
    rows.push([]);
  }

  if (data.censusHousing?.length) {
    rows.push(["DOMICÍLIOS"], ["Município/UF", "Total", "% Próprios", "% Alugados", "% Esgoto", "% Água", "Déficit"]);
    for (const h of data.censusHousing) {
      rows.push([`${h.municipio_nome}/${h.uf}`, h.total_domicilios, fmtPct(h.domicilios_proprios_pct), fmtPct(h.domicilios_alugados_pct), fmtPct(h.domicilios_com_esgoto_pct), fmtPct(h.domicilios_com_agua_rede_pct), h.deficit_habitacional_estimado]);
    }
  }

  return rows;
}

function buildEmbargosSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.ibamaResult?.data && !data.icmbioResult?.data) return null;

  const rows: unknown[][] = [["EMBARGOS AMBIENTAIS"], []];

  if (data.ibamaResult?.data) {
    rows.push(
      ["IBAMA — Áreas Embargadas"],
      ["Risco", data.ibamaResult.data.risco?.toUpperCase()],
      ["Resumo", data.ibamaResult.data.resumo],
      ["Total encontrados", data.ibamaResult.data.total],
      []
    );
    if (data.ibamaResult.data.embargos?.length) {
      rows.push(["Auto", "Data", "Município", "Dist. km", "Situação", "Bioma"]);
      for (const e of data.ibamaResult.data.embargos) {
        rows.push([e.numero_auto, e.data_embargo, `${e.municipio}/${e.uf}`, e.distancia_km, e.situacao, e.bioma]);
      }
      rows.push([]);
    }
  }

  if (data.icmbioResult?.data) {
    rows.push(
      ["ICMBio — Unidades de Conservação"],
      ["Risco", data.icmbioResult.data.risco?.toUpperCase()],
      ["Resumo", data.icmbioResult.data.resumo],
      []
    );
    if (data.icmbioResult.data.unidades_conservacao?.length) {
      rows.push(["Nome", "Categoria", "Dist. km", "Impacto", "Restrições"]);
      for (const uc of data.icmbioResult.data.unidades_conservacao) {
        rows.push([uc.nome, uc.categoria, uc.distancia_km, uc.impacto, uc.restricoes]);
      }
    }
  }

  return rows;
}

function buildMapBiomasSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.mapBiomasLatest && !data.mapBiomasTrend) return null;

  const rows: unknown[][] = [["MAPBIOMAS — COBERTURA E USO DO SOLO"], []];

  if (data.mapBiomasLatest) {
    rows.push(
      ["Vegetação Nativa", fmtPct(data.mapBiomasLatest.native_vegetation_pct)],
      ["Ano", data.mapBiomasLatest.year],
      [],
      ["Classes de Uso do Solo"],
      ["ID", "Classe", "Área (ha)", "%", "Grupo"]
    );
    for (const cls of data.mapBiomasLatest.land_use_classes) {
      rows.push([cls.class_id, cls.class_name, fmt(cls.area_ha, 1), fmtPct(cls.percentage), cls.group ?? ""]);
    }
    rows.push([]);
  }

  if (data.mapBiomasTrend) {
    rows.push(
      ["TENDÊNCIA TEMPORAL"],
      ["Tendência desmatamento", data.mapBiomasTrend.deforestation_trend],
      ["Resumo", data.mapBiomasTrend.change_summary],
    );
    if (data.mapBiomasTrend.yearly_changes?.length) {
      rows.push([], ["Ano", "Veg. Nativa %", "Pastagem %", "Variação Nativa"]);
      for (const yr of data.mapBiomasTrend.yearly_changes) {
        rows.push([yr.year, fmtPct(yr.native_vegetation_pct), fmtPct(yr.pasture_pct), fmtPct(yr.native_change_pct)]);
      }
    }
  }

  return rows;
}

function buildZoneamentoSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  const z = data.zoneamento;
  if (!z) return null;

  const rows: unknown[][] = [
    ["ZONEAMENTO MUNICIPAL"],
    [],
    ["Município", z.municipio ?? ""],
    ["Zona", z.zona ?? ""],
    ["Classificação", z.classificacao ?? ""],
    ["Uso Permitido", z.uso_permitido ?? ""],
    ["Lei Municipal", z.lei_municipal ?? ""],
    [],
  ];

  if (z.coeficiente_aproveitamento) {
    rows.push(
      ["Coeficiente de Aproveitamento"],
      ["Mínimo", z.coeficiente_aproveitamento.minimo ?? ""],
      ["Básico", z.coeficiente_aproveitamento.basico ?? ""],
      ["Máximo", z.coeficiente_aproveitamento.maximo ?? ""],
      []
    );
  }

  if (z.gabarito) {
    rows.push(
      ["Gabarito"],
      ["Altura Máxima (m)", z.gabarito.altura_maxima_m ?? ""],
      ["Pavimentos Máximos", z.gabarito.pavimentos_maximos ?? ""],
      []
    );
  }

  if (z.recuos) {
    rows.push(
      ["Recuos"],
      ["Frontal (m)", z.recuos.frontal_m ?? ""],
      ["Lateral (m)", z.recuos.lateral_m ?? ""],
      ["Fundos (m)", z.recuos.fundos_m ?? ""],
      ["Entre Blocos (m)", z.recuos.entre_blocos_m ?? ""],
    );
  }

  if (z.taxa_ocupacao_max != null) rows.push(["Taxa Ocupação Máx.", fmtPct(z.taxa_ocupacao_max)]);
  if (z.taxa_permeabilidade_min != null) rows.push(["Taxa Permeab. Mín.", fmtPct(z.taxa_permeabilidade_min)]);
  if (z.observacoes) rows.push([], ["Observações", z.observacoes]);

  return rows;
}

function buildMatriculaSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  if (!data.matriculas?.length) return null;
  const m = data.matriculas[0];

  const rows: unknown[][] = [
    ["REGISTRO IMOBILIÁRIO"],
    [],
    ["Número Matrícula", m.numero_matricula ?? ""],
    ["Cartório", m.cartorio_nome ?? ""],
    ["CNS", m.cartorio_cns ?? ""],
    ["Comarca", m.comarca ?? ""],
    ["Status", m.status ?? ""],
    [],
  ];

  if (m.averbacoes?.length) {
    rows.push(["AVERBAÇÕES"], ["#", "Data", "Tipo", "Descrição"]);
    for (const av of m.averbacoes) {
      rows.push([av.numero, av.data ?? "", av.tipo ?? "", av.descricao ?? ""]);
    }
    rows.push([]);
  }

  if (m.onus?.length) {
    rows.push(["ÔNUS E GRAVAMES"], ["Tipo", "Data", "Descrição", "Beneficiário"]);
    for (const o of m.onus) {
      rows.push([o.tipo ?? "", o.data ?? "", o.descricao ?? "", o.beneficiario ?? ""]);
    }
  }

  return rows;
}

function buildFiiCraSheet(data: ReportTecnicoDataResult): unknown[][] | null {
  const fc = data.fiiCra;
  if (!fc) return null;

  const rows: unknown[][] = [["SIMULAÇÕES DE ESTRUTURAÇÃO"], []];

  if (fc.fii) {
    rows.push(
      ["FII — Fundo de Investimento Imobiliário"],
      ["Patrimônio Líquido", fmtBRL(fc.fii.patrimonio_liquido)],
      ["Valor da Cota", fmtBRL(fc.fii.valor_cota)],
      ["Total de Cotas", fc.fii.total_cotas ?? ""],
      ["Dividend Yield a.a.", fmtPct(fc.fii.dividend_yield)],
      ["TIR Investidor", fmtPct(fc.fii.tir_investidor)],
      ["VPL", fmtBRL(fc.fii.vpl)],
      []
    );
  }

  if (fc.criCra) {
    rows.push(
      ["CRI/CRA — Certificados de Recebíveis"],
      ["Valor Emissão", fmtBRL(fc.criCra.valor_emissao)],
      ["Taxa Juros a.a.", fmtPct(fc.criCra.taxa_juros)],
      ["Prazo (meses)", fc.criCra.prazo_meses ?? ""],
      ["WAL (anos)", fmt(fc.criCra.wal, 2)],
      ["TIR Emissão", fmtPct(fc.criCra.tir_emissao)],
      ["Spread s/ CDI", fmtPct(fc.criCra.spread_cdi)],
      []
    );

    if (fc.criCra.tranches?.length) {
      rows.push(["Tranches"], ["Série", "Valor", "Taxa", "Prazo", "Rating", "Subordinação"]);
      for (const t of fc.criCra.tranches) {
        rows.push([t.serie ?? "", fmtBRL(t.valor), fmtPct(t.taxa), t.prazo_meses ? `${t.prazo_meses}m` : "", t.rating ?? "", t.subordinacao ?? ""]);
      }
    }
  }

  if (fc.comparativo) {
    rows.push([], ["COMPARATIVO"], [fc.comparativo]);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main Export Function
// ---------------------------------------------------------------------------

export function exportExcelFull({ project, data }: ExcelExportParams): void {
  const wb = XLSX.utils.book_new();

  // 1. Resumo (always)
  addSheet(wb, "Resumo", buildResumoSheet(project, data));

  // 2. Financeiro
  const fin = buildFinanceiroSheet(data);
  if (fin) addSheet(wb, "Financeiro", fin);

  // 3. Legal
  const legal = buildLegalSheet(data);
  if (legal) addSheet(wb, "Conformidade Legal", legal);

  // 4. Regulações
  const reg = buildRegulacoesSheet(data);
  if (reg) addSheet(wb, "Regulações", reg);

  // 5. Benchmarks
  const bench = buildBenchmarksSheet(data);
  if (bench) addSheet(wb, "Benchmarks", bench);

  // 6. Censo
  const censo = buildCensoSheet(data);
  if (censo) addSheet(wb, "Censo IBGE", censo);

  // 7. Embargos
  const emb = buildEmbargosSheet(data);
  if (emb) addSheet(wb, "Embargos", emb);

  // 8. MapBiomas
  const mb = buildMapBiomasSheet(data);
  if (mb) addSheet(wb, "MapBiomas", mb);

  // 9. Zoneamento
  const zon = buildZoneamentoSheet(data);
  if (zon) addSheet(wb, "Zoneamento", zon);

  // 10. Matrícula
  const mat = buildMatriculaSheet(data);
  if (mat) addSheet(wb, "Registro Imobiliário", mat);

  // 11. FII/CRA
  const fii = buildFiiCraSheet(data);
  if (fii) addSheet(wb, "Simulações FII-CRA", fii);

  // Generate filename and download
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `relatorio-completo-${slug}-${date}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
