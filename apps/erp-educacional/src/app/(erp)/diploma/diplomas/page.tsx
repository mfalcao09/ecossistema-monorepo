// Esta rota foi unificada com o Dashboard principal.
// O conteúdo agora está em /diploma (página raiz do módulo).
import { redirect } from "next/navigation";

export default function DiplomasRedirect() {
  redirect("/diploma");
}
