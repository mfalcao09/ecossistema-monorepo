"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FileText, Loader2, ArrowLeft, Printer, Download } from "lucide-react";

function PreviewHistoricoContent() {
  const searchParams = useSearchParams();
  const nome = searchParams.get("nome") || "Nome do Aluno";
  const cpf = searchParams.get("cpf") || "000.000.000-00";
  const cursoId = searchParams.get("curso_id") || "";

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
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
              Preview — Histórico Escolar Digital
            </h1>
          </div>
          <div className="flex items-center gap-2">
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
      <div className="max-w-5xl mx-auto py-8 px-6">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
          {/* Simulação da página A4 */}
          <div
            className="mx-auto bg-white"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "25mm 20mm",
              fontFamily: "Times New Roman, serif",
              fontSize: "10pt",
            }}
          >
            {/* Cabeçalho institucional */}
            <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                Faculdades Integradas de Cassilândia
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Mantida por: Associação Educacional de Cassilândia
              </p>
              <p className="text-xs text-gray-500">
                Av. Siqueira Campos, 468 — Centro — Cassilândia/MS — CEP 79.540-000
              </p>
              <h3 className="text-base font-bold text-gray-800 mt-4 uppercase">
                Histórico Escolar Digital
              </h3>
            </div>

            {/* Dados do aluno */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 border-b border-gray-300 pb-1">
                Dados do Aluno
              </h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <p>
                  <strong>Nome:</strong> {nome}
                </p>
                <p>
                  <strong>CPF:</strong> {cpf}
                </p>
                <p>
                  <strong>Curso:</strong>{" "}
                  <span className="text-gray-400 italic">
                    {cursoId ? "(dados do curso serão carregados)" : "Não selecionado"}
                  </span>
                </p>
                <p>
                  <strong>Modalidade:</strong>{" "}
                  <span className="text-gray-400 italic">Presencial</span>
                </p>
              </div>
            </div>

            {/* Placeholder disciplinas */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 border-b border-gray-300 pb-1">
                Quadro Curricular
              </h4>

              {/* Exemplo de grupo */}
              <div className="mb-4">
                <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5">
                  1º Período
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="text-left px-2 py-1 font-semibold w-16">
                        Código
                      </th>
                      <th className="text-left px-2 py-1 font-semibold">
                        Disciplina
                      </th>
                      <th className="text-center px-2 py-1 font-semibold w-12">
                        CH
                      </th>
                      <th className="text-center px-2 py-1 font-semibold w-12">
                        Nota
                      </th>
                      <th className="text-center px-2 py-1 font-semibold w-16">
                        Situação
                      </th>
                      <th className="text-left px-2 py-1 font-semibold">
                        Docente
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        cod: "ADM001",
                        nome: "Introdução à Administração",
                        ch: "60",
                        nota: "8.50",
                        sit: "Aprovado",
                        doc: "Prof. João Silva",
                      },
                      {
                        cod: "MTM001",
                        nome: "Matemática Básica",
                        ch: "80",
                        nota: "7.00",
                        sit: "Aprovado",
                        doc: "Prof. Maria Souza",
                      },
                      {
                        cod: "POR001",
                        nome: "Português Instrumental",
                        ch: "60",
                        nota: "9.00",
                        sit: "Aprovado",
                        doc: "Prof. Ana Costa",
                      },
                    ].map((d, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 1 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-2 py-1 font-mono">{d.cod}</td>
                        <td className="px-2 py-1">{d.nome}</td>
                        <td className="px-2 py-1 text-center">{d.ch}h</td>
                        <td className="px-2 py-1 text-center">{d.nota}</td>
                        <td className="px-2 py-1 text-center text-emerald-700">
                          {d.sit}
                        </td>
                        <td className="px-2 py-1">{d.doc}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t border-gray-300">
                      <td
                        colSpan={2}
                        className="px-2 py-1 text-right font-semibold"
                      >
                        Subtotal CH:
                      </td>
                      <td className="px-2 py-1 text-center font-bold">200h</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-xs text-gray-400 text-center italic mt-6 border-t border-dashed border-gray-300 pt-3">
                Este é um preview de exemplo. O PDF final usará os dados reais
                das disciplinas importadas no formulário.
              </p>
            </div>

            {/* Rodapé */}
            <div className="mt-auto border-t-2 border-gray-800 pt-4 text-xs text-gray-500 text-center">
              <p>
                Este histórico escolar é parte integrante do diploma digital
                emitido conforme Portaria MEC nº 554/2019.
              </p>
              <p className="mt-1">
                Documento gerado eletronicamente — verificação disponível em
                diploma.fic.edu.br
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewHistoricoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-violet-600" />
        </div>
      }
    >
      <PreviewHistoricoContent />
    </Suspense>
  );
}
