/**
 * Logo SVG da FIC — Faculdades Integradas de Cassilândia
 * Reconstruído a partir da identidade visual oficial
 */
export default function FicLogo({ className = "h-10" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Ícone estilizado */}
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
        <circle cx="24" cy="24" r="22" stroke="#1e2a4a" strokeWidth="2.5" fill="none" />
        <path
          d="M14 18 C14 14 18 10 24 10 C30 10 34 14 34 18"
          stroke="#1e2a4a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M11 22 C11 16 16 8 24 8 C32 8 37 16 37 22"
          stroke="#c41230"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <text x="12" y="36" fontFamily="Georgia, serif" fontWeight="bold" fontSize="18" fill="#1e2a4a">
          FIC
        </text>
      </svg>
    </div>
  )
}
