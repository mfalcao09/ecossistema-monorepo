"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FileText, Loader2, ArrowLeft, Printer } from "lucide-react";

// Dados de exemplo para demonstrar o visual
const DADOS_EXEMPLO = {
  nome: "Maria Eduarda Santos Oliveira",
  cpf: "123.456.789-00",
  rg: "1234567 SSP/MS",
  data_nascimento: "15/03/1998",
  naturalidade: "Cassilândia/MS",
  nacionalidade: "Brasileira",
  curso: "Administração",
  modalidade: "Presencial",
  grau: "Bacharel",
  data_ingresso: "01/02/2020",
  data_conclusao: "15/12/2023",
  periodos: [
    {
      nome: "1\u00ba Per\u00edodo",
      disciplinas: [
        { cod: "ADM001", nome: "Introdu\u00e7\u00e3o \u00e0 Administra\u00e7\u00e3o", ch: 60, nota: "8.50", situacao: "Aprovado", docente: "Prof. Jo\u00e3o Carlos Silva", forma: "Presencial" },
        { cod: "MTM001", nome: "Matem\u00e1tica B\u00e1sica", ch: 80, nota: "7.00", situacao: "Aprovado", docente: "Prof. Maria Aparecida Souza", forma: "Presencial" },
        { cod: "POR001", nome: "Portugu\u00eas Instrumental", ch: 60, nota: "9.00", situacao: "Aprovado", docente: "Prof. Ana Costa Pereira", forma: "Presencial" },
        { cod: "ECO001", nome: "Fundamentos de Economia", ch: 60, nota: "7.50", situacao: "Aprovado", docente: "Prof. Roberto Menezes", forma: "Presencial" },
        { cod: "INF001", nome: "Inform\u00e1tica Aplicada", ch: 40, nota: "8.00", situacao: "Aprovado", docente: "Prof. Lucas Fernandes", forma: "Presencial" },
      ],
    },
    {
      nome: "2\u00ba Per\u00edodo",
      disciplinas: [
        { cod: "ADM002", nome: "Teoria Geral da Administra\u00e7\u00e3o", ch: 80, nota: "8.00", situacao: "Aprovado", docente: "Prof. Jo\u00e3o Carlos Silva", forma: "Presencial" },
        { cod: "CTB001", nome: "Contabilidade B\u00e1sica", ch: 60, nota: "6.50", situacao: "Aprovado", docente: "Prof. Carla Braga Lima", forma: "Presencial" },
        { cod: "DIR001", nome: "Direito Empresarial", ch: 60, nota: "7.50", situacao: "Aprovado", docente: "Prof. Pedro Augusto Rocha", forma: "Presencial" },
        { cod: "SOC001", nome: "Sociologia das Organiza\u00e7\u00f5es", ch: 40, nota: "8.50", situacao: "Aprovado", docente: "Prof. Fernanda Dias", forma: "Presencial" },
      ],
    },
    {
      nome: "3\u00ba Per\u00edodo",
      disciplinas: [
        { cod: "ADM003", nome: "Gest\u00e3o de Pessoas", ch: 80, nota: "9.00", situacao: "Aprovado", docente: "Prof. Cl\u00e1udia Mendes", forma: "Presencial" },
        { cod: "MKT001", nome: "Marketing I", ch: 60, nota: "8.50", situacao: "Aprovado", docente: "Prof. Rafael Nunes", forma: "Presencial" },
        { cod: "EST001", nome: "Estat\u00edstica Aplicada", ch: 60, nota: "6.00", situacao: "Aprovado", docente: "Prof. Maria Aparecida Souza", forma: "Presencial" },
        { cod: "FIN001", nome: "Matem\u00e1tica Financeira", ch: 60, nota: "7.00", situacao: "Aprovado", docente: "Prof. Lucas Fernandes", forma: "Presencial" },
      ],
    },
  ],
};

function PreviewHistoricoConfigContent() {
  const searchParams = useSearchParams();

  // Ler configurações dos query params
  const corCabecalho = searchParams.get("cor_cabecalho") || "#1A3A6B";
  const corLinha = searchParams.get("cor_linha") || "#F5F5F5";
  const fonte = searchParams.get("fonte") || "Times New Roman";
  const tamanho = Number(searchParams.get("tamanho") || "10");
  const layoutHistorico = searchParams.get("layout") || "tabela_classico";
  const formatoNota = searchParams.get("formato_nota") || "nota_0_10";
  const exibirDocente = searchParams.get("exibir_docente") !== "false";
  const exibirCH = searchParams.get("exibir_ch") !== "false";
  const exibirFormaInteg = searchParams.get("exibir_forma_integ") === "true";
  const margemTopo = Number(searchParams.get("margem_topo") || "25");
  const margemBaixo = Number(searchParams.get("margem_baixo") || "25");
  const margemEsquerda = Number(searchParams.get("margem_esquerda") || "20");
  const margemDireita = Number(searchParams.get("margem_direita") || "20");
  const textoRodape = searchParams.get("texto_rodape") || "";
  const timbradoUrl = searchParams.get("timbrado_url") || "";

  const d = DADOS_EXEMPLO;

  // Calcular CH total
  const chTotal = d.periodos.reduce(
    (acc, p) => acc + p.disciplinas.reduce((a, disc) => a + disc.ch, 0),
    0
  );

  // Colunas visíveis
  const colunas: { key: string; label: string; width: string; align: string }[] = [
    { key: "cod", label: "Código", width: "w-16", align: "text-left" },
    { key: "nome", label: "Disciplina", width: "flex-1", align: "text-left" },
  ];
  if (exibirCH) colunas.push({ key: "ch", label: "CH", width: "w-12", align: "text-center" });
  colunas.push({ key: "nota", label: "Nota", width: "w-14", align: "text-center" });
  colunas.push({ key: "situacao", label: "Situação", width: "w-20", align: "text-center" });
  if (exibirDocente) colunas.push({ key: "docente", label: "Docente", width: "flex-1", align: "text-left" });
  if (exibirFormaInteg) colunas.push({ key: "forma", label: "Integr.", width: "w-20", align: "text-center" });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar (não imprime) */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={16} />
              Fechar
            </button>
            <div className="w-px h-6 bg-gray-300" />
            <h1 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-violet-600" />
              Preview — Histórico Escolar Digital (Configuração)
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Dados de exemplo
            </span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="max-w-5xl mx-auto py-8 px-6 print:p-0 print:max-w-none">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200 print:shadow-none print:border-none print:rounded-none">
          {/* Simulação da página A4 */}
          <div
            className="mx-auto bg-white relative"
            style={{
              width: "210mm",
              minHeight: "297mm",
              fontFamily: `${fonte}, serif`,
              fontSize: `${tamanho}pt`,
              position: "relative",
            }}
          >
            {/* Fundo timbrado — sempre imagem (servidor converte PDF→PNG no upload) */}
            {timbradoUrl && !timbradoUrl.toLowerCase().endsWith(".pdf") && (
              <div className="absolute inset-0 z-0">
                <img
                  src={timbradoUrl}
                  alt="Papel Timbrado"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('[preview] Erro ao carregar timbrado:', timbradoUrl)
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
            {/* Aviso se timbrado ainda é PDF antigo (não convertido) */}
            {timbradoUrl && timbradoUrl.toLowerCase().endsWith(".pdf") && (
              <div className="absolute top-2 left-2 right-2 z-20 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 text-center print:hidden">
                Timbrado em formato PDF antigo — reenvie em PNG/JPG na tela de configurações para visualizar aqui.
              </div>
            )}

            {/* Conteúdo com margens */}
            <div
              className="relative z-10"
              style={{
                paddingTop: `${margemTopo}mm`,
                paddingBottom: `${margemBaixo}mm`,
                paddingLeft: `${margemEsquerda}mm`,
                paddingRight: `${margemDireita}mm`,
              }}
            >
              {/* Cabeçalho institucional */}
              <div className="text-center mb-6 pb-3" style={{ borderBottom: `2px solid ${corCabecalho}` }}>
                <h2 className="font-bold uppercase tracking-wide" style={{ fontSize: `${tamanho + 4}pt`, color: corCabecalho }}>
                  Faculdades Integradas de Cassilândia
                </h2>
                <p className="mt-0.5" style={{ fontSize: `${tamanho - 2}pt`, color: "#666" }}>
                  Mantida por: Associação Educacional de Cassilândia
                </p>
                <p style={{ fontSize: `${tamanho - 2}pt`, color: "#888" }}>
                  Av. Siqueira Campos, 468 — Centro — Cassilândia/MS — CEP 79.540-000
                </p>
                <h3
                  className="font-bold uppercase mt-3"
                  style={{ fontSize: `${tamanho + 2}pt`, color: corCabecalho }}
                >
                  Histórico Escolar Digital
                </h3>
              </div>

              {/* Dados do aluno */}
              <div className="mb-4">
                <h4
                  className="font-bold uppercase mb-1.5 pb-0.5"
                  style={{
                    fontSize: `${tamanho - 1}pt`,
                    color: corCabecalho,
                    borderBottom: `1px solid ${corCabecalho}40`,
                  }}
                >
                  Dados do Aluno
                </h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-0.5" style={{ fontSize: `${tamanho - 1}pt` }}>
                  <p><strong>Nome:</strong> {d.nome}</p>
                  <p><strong>CPF:</strong> {d.cpf}</p>
                  <p><strong>RG:</strong> {d.rg}</p>
                  <p><strong>Data de Nascimento:</strong> {d.data_nascimento}</p>
                  <p><strong>Naturalidade:</strong> {d.naturalidade}</p>
                  <p><strong>Nacionalidade:</strong> {d.nacionalidade}</p>
                </div>
              </div>

              {/* Dados do curso */}
              <div className="mb-4">
                <h4
                  className="font-bold uppercase mb-1.5 pb-0.5"
                  style={{
                    fontSize: `${tamanho - 1}pt`,
                    color: corCabecalho,
                    borderBottom: `1px solid ${corCabecalho}40`,
                  }}
                >
                  Dados do Curso
                </h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-0.5" style={{ fontSize: `${tamanho - 1}pt` }}>
                  <p><strong>Curso:</strong> {d.curso}</p>
                  <p><strong>Grau:</strong> {d.grau}</p>
                  <p><strong>Modalidade:</strong> {d.modalidade}</p>
                  <p><strong>Carga Horária Total:</strong> {chTotal}h</p>
                  <p><strong>Data de Ingresso:</strong> {d.data_ingresso}</p>
                  <p><strong>Data de Conclusão:</strong> {d.data_conclusao}</p>
                </div>
              </div>

              {/* Quadro Curricular */}
              <div className="mb-4">
                <h4
                  className="font-bold uppercase mb-2 pb-0.5"
                  style={{
                    fontSize: `${tamanho - 1}pt`,
                    color: corCabecalho,
                    borderBottom: `1px solid ${corCabecalho}40`,
                  }}
                >
                  Quadro Curricular
                </h4>

                {d.periodos.map((periodo, pi) => {
                  const subtotalCH = periodo.disciplinas.reduce((a, disc) => a + disc.ch, 0);

                  return (
                    <div key={pi} className="mb-3">
                      {/* Cabeçalho do período */}
                      <div
                        className="text-white font-bold px-2 py-1"
                        style={{
                          backgroundColor: corCabecalho,
                          fontSize: `${tamanho - 1}pt`,
                        }}
                      >
                        {periodo.nome}
                      </div>

                      {/* Cabeçalho da tabela */}
                      <table className="w-full border-collapse" style={{ fontSize: `${tamanho - 1}pt` }}>
                        <thead>
                          <tr style={{ backgroundColor: `${corCabecalho}15`, borderBottom: `1px solid ${corCabecalho}30` }}>
                            {colunas.map((col) => (
                              <th
                                key={col.key}
                                className={`px-1.5 py-1 font-semibold ${col.align}`}
                                style={{ fontSize: `${tamanho - 1}pt` }}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {periodo.disciplinas.map((disc, di) => (
                            <tr
                              key={di}
                              style={{
                                backgroundColor: di % 2 === 1 ? corLinha : "white",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              <td className="px-1.5 py-0.5 font-mono">{disc.cod}</td>
                              <td className="px-1.5 py-0.5">{disc.nome}</td>
                              {exibirCH && <td className="px-1.5 py-0.5 text-center">{disc.ch}h</td>}
                              <td className="px-1.5 py-0.5 text-center">{disc.nota}</td>
                              <td className="px-1.5 py-0.5 text-center" style={{ color: disc.situacao === "Aprovado" ? "#047857" : "#b91c1c" }}>
                                {disc.situacao}
                              </td>
                              {exibirDocente && <td className="px-1.5 py-0.5">{disc.docente}</td>}
                              {exibirFormaInteg && <td className="px-1.5 py-0.5 text-center">{disc.forma}</td>}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: `${corCabecalho}10`, borderTop: `1px solid ${corCabecalho}30` }}>
                            <td colSpan={2} className="px-1.5 py-0.5 text-right font-semibold">
                              Subtotal CH:
                            </td>
                            {exibirCH && <td className="px-1.5 py-0.5 text-center font-bold">{subtotalCH}h</td>}
                            <td colSpan={colunas.length - (exibirCH ? 3 : 2)}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}

                {/* Total geral */}
                <div
                  className="flex justify-between items-center px-2 py-1.5 font-bold mt-1"
                  style={{
                    backgroundColor: corCabecalho,
                    color: "white",
                    fontSize: `${tamanho}pt`,
                  }}
                >
                  <span>CARGA HORÁRIA TOTAL</span>
                  <span>{chTotal}h</span>
                </div>
              </div>

              {/* Rodapé personalizado */}
              {textoRodape && (
                <div
                  className="mt-4 pt-2 text-center italic"
                  style={{
                    borderTop: `1px solid ${corCabecalho}30`,
                    fontSize: `${tamanho - 2}pt`,
                    color: "#666",
                  }}
                >
                  <p>{textoRodape}</p>
                </div>
              )}

              {/* Rodapé institucional */}
              <div
                className="mt-4 pt-3 text-center"
                style={{
                  borderTop: `2px solid ${corCabecalho}`,
                  fontSize: `${tamanho - 2}pt`,
                  color: "#888",
                }}
              >
                <p>
                  Este histórico escolar é parte integrante do diploma digital
                  emitido conforme Portaria MEC n&ordm; 554/2019.
                </p>
                <p className="mt-0.5">
                  Documento gerado eletronicamente — verificação disponível em
                  diploma.ficcassilandia.com.br
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legenda de configuração (não imprime) */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 print:hidden">
          <h4 className="text-sm font-bold text-gray-700 mb-2">Configurações aplicadas neste preview:</h4>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
            <p>
              <span className="font-medium">Layout:</span>{" "}
              {layoutHistorico === "tabela_classico" ? "Tabela Clássica" : layoutHistorico === "tabela_moderno" ? "Tabela Moderna" : "Agrupado por Período"}
            </p>
            <p><span className="font-medium">Fonte:</span> {fonte} ({tamanho}pt)</p>
            <p>
              <span className="font-medium">Cor cabeçalho:</span>{" "}
              <span className="inline-block w-3 h-3 rounded-sm align-middle" style={{ backgroundColor: corCabecalho }} /> {corCabecalho}
            </p>
            <p>
              <span className="font-medium">Cor linha alt.:</span>{" "}
              <span className="inline-block w-3 h-3 rounded-sm align-middle border border-gray-200" style={{ backgroundColor: corLinha }} /> {corLinha}
            </p>
            <p><span className="font-medium">Margens:</span> {margemTopo}/{margemBaixo}/{margemEsquerda}/{margemDireita}mm</p>
            <p>
              <span className="font-medium">Colunas:</span>{" "}
              {[exibirDocente && "Docente", exibirCH && "CH", exibirFormaInteg && "Integr."].filter(Boolean).join(", ") || "Mínimas"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewHistoricoConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-violet-600" />
        </div>
      }
    >
      <PreviewHistoricoConfigContent />
    </Suspense>
  );
}
