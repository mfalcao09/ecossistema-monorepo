import Link from "next/link"
import Image from "next/image"

/**
 * Header do portal público — posicionamento absoluto sobre o hero.
 * Logo FIC (branco, fundo transparente) na esquerda, botão "Site Principal" na direita.
 *
 * Requisito: colocar o arquivo logo-fic.png (fundo transparente) em /public/logo-fic.png
 */
export default function PortalHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo FIC */}
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/logo-fic.png"
              alt="FIC — Faculdades Integradas de Cassilândia"
              width={180}
              height={64}
              className="h-10 sm:h-14 w-auto"
              priority
            />
          </Link>

          {/* Botão Site Principal — vermelho arredondado */}
          <Link
            href="https://ficcassilandia.com.br"
            target="_blank"
            className="text-sm font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] px-5 py-2.5 rounded-full transition-colors shadow-sm"
          >
            Site Principal
          </Link>
        </div>
      </div>
    </header>
  )
}
