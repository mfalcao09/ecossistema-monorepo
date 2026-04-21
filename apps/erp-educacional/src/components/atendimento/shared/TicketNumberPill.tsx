/**
 * TicketNumberPill — exibe "#1234" ou "Protocolo #42" em formato pill.
 * S4 · shared.
 */

interface TicketNumberPillProps {
  number: number | string;
  label?: string;           // ex: "Protocolo" · default vazio
  variant?: "default" | "muted" | "success" | "warning";
  onClick?: () => void;
}

const VARIANT_STYLES: Record<NonNullable<TicketNumberPillProps["variant"]>, string> = {
  default: "bg-blue-50 text-blue-700 ring-blue-200",
  muted:   "bg-gray-50 text-gray-700 ring-gray-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function TicketNumberPill({
  number,
  label,
  variant = "default",
  onClick,
}: TicketNumberPillProps) {
  const classes =
    `inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${VARIANT_STYLES[variant]}`;

  const content = (
    <>
      {label && <span className="font-normal opacity-80">{label}</span>}
      <span>#{number}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} hover:opacity-80`}>
        {content}
      </button>
    );
  }

  return <span className={classes}>{content}</span>;
}
