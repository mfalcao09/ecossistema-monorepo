import { useLocation } from "react-router-dom";

export default function Placeholder() {
  const { pathname } = useLocation();
  const title = pathname.replace("/", "").replace(/-/g, " ");

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold capitalize text-foreground">{title || "Página"}</h1>
      <p className="text-muted-foreground">Esta seção será implementada em breve.</p>
    </div>
  );
}
