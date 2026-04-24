import { Facebook, Instagram, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function PortalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
          {/* ── Esquerda: Logo + tagline + ícones sociais ── */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            {/* Logo grande */}
            <div className="flex flex-col items-center sm:items-start">
              <Link
                href="https://ficcassilandia.com.br"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/logo-fic2.png"
                  alt="FIC — Faculdades Integradas de Cassilândia"
                  width={220}
                  height={100}
                  className="h-24 sm:h-28 w-auto"
                />
              </Link>
              {/* Ícones sociais abaixo da logo — centralizados */}
              <div className="flex items-center justify-center gap-3 mt-4 w-full">
                <a
                  href="https://facebook.com/ficcassilandia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#dc2626] flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4 text-white" />
                </a>
                <a
                  href="https://instagram.com/ficcassilandia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#dc2626] flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4 text-white" />
                </a>
                {/* WhatsApp — desativado por enquanto */}
                {/* <a
                  href="https://wa.me/55679999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#dc2626] flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
                  aria-label="WhatsApp"
                >
                  <Phone className="w-4 h-4 text-white" />
                </a> */}
                <a
                  href="mailto:secretaria@ficcassilandia.com.br"
                  className="w-9 h-9 rounded-full bg-[#dc2626] flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
                  aria-label="E-mail"
                >
                  <Mail className="w-4 h-4 text-white" />
                </a>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-xs text-center sm:text-left sm:pt-4">
              Ensino superior de qualidade,
              <br />
              formando profissionais preparados
              <br />
              para o mercado.
            </p>
          </div>

          {/* ── Direita: Selo e-MEC ── */}
          <div className="flex items-center gap-4 sm:gap-5">
            <p className="text-sm sm:text-base font-bold text-[#dc2626] text-right leading-snug max-w-[160px]">
              Consulte aqui o cadastro da Instituição no Sistema e-MEC
            </p>
            <a
              href="https://emec.mec.gov.br/emec/consulta-cadastro/detalhamento/d96957f455f6405d14c6542552b0f6eb/MTYwNg=="
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              <Image
                src="/emec-fic.png"
                alt="Selo e-MEC — Consulte o cadastro da FIC no Sistema e-MEC"
                width={130}
                height={130}
                className="w-28 sm:w-32 h-auto rounded-lg border border-slate-200"
              />
            </a>
          </div>
        </div>
      </div>

      {/* ── Barra final com copyright ── */}
      <div className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            &copy; {currentYear} FIC &mdash; Faculdades Integradas de
            Cassilândia &middot; CNPJ: 17.218.946/0001-90
          </p>
          <p className="text-xs text-slate-400">
            Portaria MEC 70/2025 &middot; ICP-Brasil
          </p>
        </div>
      </div>
    </footer>
  );
}
