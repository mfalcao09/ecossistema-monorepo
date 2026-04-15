---
name: Remover campos do tipo TS como trava de compilação
description: Para impedir bugs recorrentes onde um campo do XML/payload é preenchido errado, remover do tipo TypeScript em vez de validar runtime
type: feedback
---

Quando um bug do motor XML (ou qualquer engine) decorre de um campo que **nunca** deveria ser passado pelo chamador — porque deve ser derivado automaticamente no momento da geração — a melhor trava é **remover o campo do tipo TS** e mover a derivação para dentro do builder via helper.

**Why:** Validação runtime (Zod, business-rules, etc.) só pega o erro quando o código já está em produção. Remover do tipo faz o `tsc --noEmit` / `next build` falhar imediatamente em qualquer caller que tente passar o valor — pega regressões em PR, não em prod. Marcelo escolheu explicitamente o "Caminho C" (refatoração completa com remoção do tipo) sobre os caminhos mais conservadores A e B no Bug #E (DataExpedicaoDiploma) por essa razão.

**How to apply:** Sempre que aparecer um bug do tipo "campo foi preenchido errado pelo operador/montador", oferecer 3 caminhos: (A) só corrigir o valor no builder, (B) corrigir + adicionar validação runtime, (C) remover do tipo de entrada e derivar no builder. Recomendar C quando o campo for puramente derivável (data atual, hash de outros campos, etc.). Manter JSDoc no local da remoção explicando o porquê para o próximo dev não ficar confuso.
