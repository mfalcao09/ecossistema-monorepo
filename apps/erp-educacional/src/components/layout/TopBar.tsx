"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap, Settings, Users,
  ClipboardList, BookOpen, DollarSign, ShoppingBag,
  Library, LogOut, User, Archive, MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Definição dos módulos ────────────────────────────────────────────────────
const MODULOS = [
  {
    id: "pessoas",
    label: "Pessoas",
    descricao: "Alunos, Professores, Colaboradores",
    href: "/pessoas",
    icon: Users,
    cor: "bg-cyan-500",
    corTexto: "text-cyan-600",
    corBg: "bg-cyan-50",
    ativo: true,
  },
  {
    id: "cadastro",
    label: "Cadastro",
    descricao: "IES, Mantenedoras, Departamentos",
    href: "/cadastro",
    icon: ClipboardList,
    cor: "bg-blue-500",
    corTexto: "text-blue-600",
    corBg: "bg-blue-50",
    ativo: true,
  },
  {
    id: "diploma",
    label: "Diploma Digital",
    descricao: "Emissão, Assinatura, Publicação",
    href: "/diploma",
    icon: GraduationCap,
    cor: "bg-indigo-500",
    corTexto: "text-indigo-600",
    corBg: "bg-indigo-50",
    ativo: true,
  },
  {
    id: "acervo",
    label: "Acervo Digital",
    descricao: "Documentos, Digitalização, Emissão",
    href: "/acervo",
    icon: Archive,
    cor: "bg-teal-500",
    corTexto: "text-teal-600",
    corBg: "bg-teal-50",
    ativo: true,
  },
  {
    id: "atendimento",
    label: "Atendimento",
    descricao: "WhatsApp, Instagram, Automações",
    href: "/atendimento",
    icon: MessageSquare,
    cor: "bg-green-500",
    corTexto: "text-green-600",
    corBg: "bg-green-50",
    ativo: true,
  },
  {
    id: "academico",
    label: "Acadêmico",
    descricao: "Matrículas, Turmas, Notas",
    href: "/academico",
    icon: BookOpen,
    cor: "bg-emerald-500",
    corTexto: "text-emerald-600",
    corBg: "bg-emerald-50",
    ativo: false,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    descricao: "Mensalidades, Bolsas, Receitas",
    href: "/financeiro",
    icon: DollarSign,
    cor: "bg-yellow-500",
    corTexto: "text-yellow-600",
    corBg: "bg-yellow-50",
    ativo: false,
  },
  {
    id: "comercial",
    label: "Comercial",
    descricao: "CRM, Captação, Matrículas",
    href: "/comercial",
    icon: ShoppingBag,
    cor: "bg-orange-500",
    corTexto: "text-orange-600",
    corBg: "bg-orange-50",
    ativo: false,
  },
  {
    id: "biblioteca",
    label: "Biblioteca",
    descricao: "Acervo, Empréstimos",
    href: "/biblioteca",
    icon: Library,
    cor: "bg-purple-500",
    corTexto: "text-purple-600",
    corBg: "bg-purple-50",
    ativo: false,
  },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SystemSettings {
  logo_url: string | null;
  logo_dark_url: string | null;
  instituicao_nome: string | null;
}

// ─── Componente TopBar ────────────────────────────────────────────────────────
export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const seletorRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/system-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (seletorRef.current && !seletorRef.current.contains(e.target as Node)) {
        setSeletorAberto(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    // Altura aumentada: h-14 → h-18 (72px)
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center px-5 gap-4 z-40 sticky top-0">

      {/* ── Esquerda: Logo + nome ── */}
      <Link href="/home" className="flex items-center gap-3 mr-2 flex-shrink-0">
        {settings?.logo_url ? (
          <div className="h-10 flex items-center">
            <Image
              src={settings.logo_url}
              alt={settings.instituicao_nome ?? "Logo da instituição"}
              width={150}
              height={40}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          </div>
        ) : (
          <>
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm text-gray-900 leading-none block">
                {settings?.instituicao_nome ?? "ERP FIC"}
              </span>
              <span className="text-xs text-gray-400 leading-none">Sistema de Gestão</span>
            </div>
          </>
        )}
      </Link>

      {/* ── Centro: título do sistema — posição absoluta centralizada ── */}
      <div className="absolute left-0 right-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 leading-none tracking-wide">
            Sistema de Gestão Integrado
          </p>
        </div>
      </div>

      {/* Espaçador flex */}
      <div className="flex-1" />

      {/* ── Direita: seletor de módulos + avatar ── */}

      {/* Seletor de módulos */}
      <div className="relative flex-shrink-0" ref={seletorRef}>
        <button
          onClick={() => setSeletorAberto((v) => !v)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            seletorAberto
              ? "bg-gray-100 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          title="Módulos do sistema"
        >
          {/* Ícone de nós/rede — +40% (24→34px) */}
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="2.2" />
            <circle cx="12" cy="3.5" r="1.5" />
            <circle cx="12" cy="20.5" r="1.5" />
            <circle cx="3.5" cy="12" r="1.5" />
            <circle cx="20.5" cy="12" r="1.5" />
            <circle cx="5.6" cy="5.6" r="1.5" />
            <circle cx="18.4" cy="5.6" r="1.5" />
            <circle cx="5.6" cy="18.4" r="1.5" />
            <circle cx="18.4" cy="18.4" r="1.5" />
            <line x1="12" y1="9.8" x2="12" y2="5" />
            <line x1="12" y1="14.2" x2="12" y2="19" />
            <line x1="9.8" y1="12" x2="5" y2="12" />
            <line x1="14.2" y1="12" x2="19" y2="12" />
            <line x1="10.44" y1="10.44" x2="6.66" y2="6.66" />
            <line x1="13.56" y1="10.44" x2="17.34" y2="6.66" />
            <line x1="10.44" y1="13.56" x2="6.66" y2="17.34" />
            <line x1="13.56" y1="13.56" x2="17.34" y2="17.34" />
          </svg>
        </button>

        {/* Dropdown do seletor */}
        {seletorAberto && (
          <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Módulos do ERP FIC
              </p>
            </div>
            <div className="p-2">
              {MODULOS.map((modulo) => {
                const Icon = modulo.icon;
                const isAtivo = pathname.startsWith(modulo.href);
                return (
                  <div key={modulo.id}>
                    {modulo.ativo ? (
                      <Link
                        href={modulo.href}
                        onClick={() => setSeletorAberto(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                          isAtivo
                            ? "bg-primary-50 text-primary-700"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${modulo.cor} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-none mb-0.5">{modulo.label}</p>
                          <p className="text-xs text-gray-400 truncate">{modulo.descricao}</p>
                        </div>
                        {isAtivo && (
                          <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed">
                        <div className={`w-9 h-9 rounded-xl ${modulo.cor} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-none mb-0.5">{modulo.label}</p>
                          <p className="text-xs text-gray-400 truncate">Em breve</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          Breve
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-2 border-t border-gray-100 space-y-0.5">
              <Link
                href="/home"
                onClick={() => setSeletorAberto(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <GraduationCap size={16} className="text-gray-500" />
                </div>
                <span className="text-sm font-medium">Início</span>
              </Link>
              <Link
                href="/configuracoes"
                onClick={() => setSeletorAberto(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  pathname.startsWith("/configuracoes")
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  pathname.startsWith("/configuracoes") ? "bg-slate-600" : "bg-gray-100"
                }`}>
                  <Settings size={16} className={pathname.startsWith("/configuracoes") ? "text-white" : "text-gray-500"} />
                </div>
                <span className="text-sm font-medium">Configurações</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Avatar do usuário */}
      <div className="relative flex-shrink-0" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuAberto((v) => !v)}
          className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold hover:bg-primary-600 transition-colors"
          title="Menu do usuário"
        >
          M
        </button>

        {userMenuAberto && (
          <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Marcelo Silva</p>
              <p className="text-xs text-gray-400 truncate">marcelolsf@outlook.com</p>
            </div>
            <div className="p-2">
              <Link
                href="/perfil"
                onClick={() => setUserMenuAberto(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} className="text-gray-400" />
                Minha conta
              </Link>
              <button
                onClick={handleLogout}
                disabled={saindo}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <LogOut size={15} />
                {saindo ? "Saindo..." : "Sair do sistema"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
