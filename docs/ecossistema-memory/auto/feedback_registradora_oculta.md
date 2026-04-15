---
name: Registradora oculta no formulário
description: Dados da registradora ficam ocultos no formulário, só populados no retorno do XML registrado
type: feedback
---

Dados da instituição registradora e livro de registro ficam OCULTOS no formulário de diploma. Existem no banco de dados mas são invisíveis ao operador. Só serão populados quando o XML registrado retornar da registradora (UFMS ou outra).

**Why:** Marcelo definiu em 28/03/2026. FIC é emissora, não registradora. Mostrar campos da registradora confundiria o operador.

**How to apply:** Seções "Instituição Registradora" e "Livro de Registro" não renderizar no formulário. Manter tabelas no banco para receber dados do XML registrado.
