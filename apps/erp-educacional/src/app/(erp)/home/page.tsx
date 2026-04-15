import Link from "next/link";
import {
  ClipboardList, GraduationCap, BookOpen, DollarSign,
  ShoppingBag, Library, ArrowRight, Lock,
} from "lucide-react";

const MODULOS = [
  {
    id: "cadastro",
    label: "Cadastro",
    descricao: "Gerencie instituições, mantenedoras e departamentos",
    href: "/cadastro",
    icon: ClipboardList,
    cor: "bg-blue-500",
    corHover: "hover:border-blue-300 hover:shadow-blue-100",
    corTexto: "text-blue-600",
    corBg: "bg-blue-50",
    itens: ["IES e Mantenedoras", "Departamentos", "Configurações"],
    ativo: true,
  },
  {
    id: "diploma",
    label: "Diploma Digital",
    descricao: "Emita e gerencie diplomas digitais em conformidade com o MEC",
    href: "/diploma",
    icon: GraduationCap,
    cor: "bg-indigo-500",
    corHover: "hover:border-indigo-300 hover:shadow-indigo-100",
    corTexto: "text-indigo-600",
    corBg: "bg-indigo-50",
    itens: ["Diplomados", "Cursos", "Pipeline de Diplomas", "Assinantes"],
    ativo: true,
  },
  {
    id: "academico",
    label: "Acadêmico",
    descricao: "Matrículas, turmas, notas e históricos escolares",
    href: "/academico",
    icon: BookOpen,
    cor: "bg-emerald-500",
    corHover: "hover:border-emerald-300 hover:shadow-emerald-100",
    corTexto: "text-emerald-600",
    corBg: "bg-emerald-50",
    itens: ["Matrículas", "Turmas", "Notas", "Frequência"],
    ativo: false,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    descricao: "Mensalidades, bolsas, receitas e inadimplência",
    href: "/financeiro",
    icon: DollarSign,
    cor: "bg-yellow-500",
    corHover: "hover:border-yellow-300 hover:shadow-yellow-100",
    corTexto: "text-yellow-600",
    corBg: "bg-yellow-50",
    itens: ["Mensalidades", "Bolsas", "Cobranças", "Relatórios"],
    ativo: false,
  },
  {
    id: "comercial",
    label: "Comercial",
    descricao: "CRM, captação de alunos e processo de matrícula",
    href: "/comercial",
    icon: ShoppingBag,
    cor: "bg-orange-500",
    corHover: "hover:border-orange-300 hover:shadow-orange-100",
    corTexto: "text-orange-600",
    corBg: "bg-orange-50",
    itens: ["Leads", "Processo Seletivo", "Matrículas", "Campanhas"],
    ativo: false,
  },
  {
    id: "biblioteca",
    label: "Biblioteca",
    descricao: "Acervo, empréstimos e controle de materiais",
    href: "/biblioteca",
    icon: Library,
    cor: "bg-purple-500",
    corHover: "hover:border-purple-300 hover:shadow-purple-100",
    corTexto: "text-purple-600",
    corBg: "bg-purple-50",
    itens: ["Acervo", "Empréstimos", "Reservas"],
    ativo: false,
  },
];

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Saudação */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Olá, Marcelo!</h1>
        <p className="text-gray-500 mt-1 text-lg">O que você quer fazer hoje?</p>
      </div>

      {/* Grid de módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MODULOS.map((modulo) => {
          const Icon = modulo.icon;
          if (modulo.ativo) {
            return (
              <Link
                key={modulo.id}
                href={modulo.href}
                className={`group bg-white rounded-2xl border border-gray-200 p-6 transition-all duration-200 shadow-sm hover:shadow-md ${modulo.corHover}`}
              >
                {/* Header do card */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${modulo.cor} flex items-center justify-center shadow-sm`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all"
                  />
                </div>

                {/* Título e descrição */}
                <h2 className="text-lg font-bold text-gray-900 mb-1">{modulo.label}</h2>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{modulo.descricao}</p>

                {/* Atalhos internos */}
                <div className="flex flex-wrap gap-1.5">
                  {modulo.itens.map((item) => (
                    <span
                      key={item}
                      className={`text-xs px-2 py-1 rounded-full ${modulo.corBg} ${modulo.corTexto} font-medium`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </Link>
            );
          }

          // Card "Em breve" — não clicável
          return (
            <div
              key={modulo.id}
              className="bg-white rounded-2xl border border-gray-200 border-dashed p-6 opacity-60"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl ${modulo.cor} flex items-center justify-center shadow-sm opacity-60`}>
                  <Icon size={24} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full">
                  <Lock size={11} />
                  Em breve
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-700 mb-1">{modulo.label}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{modulo.descricao}</p>
            </div>
          );
        })}
      </div>

      {/* Rodapé */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-400">
          ERP FIC — Faculdades Integradas de Cassilândia · v0.1.0 · XSD v1.05
        </p>
      </div>
    </div>
  );
}
