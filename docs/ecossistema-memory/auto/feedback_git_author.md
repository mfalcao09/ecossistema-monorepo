---
name: Git Author Correto
description: Sempre usar mfalcao09 / contato@marcelofalcao.imb.br como autor dos commits — erro causa falha no deploy Vercel
type: feedback
---

Ao fazer commits no repo diploma-digital, SEMPRE usar:
- **user.name:** `mfalcao09`
- **user.email:** `contato@marcelofalcao.imb.br`

NUNCA usar "Marcelo Silva" / "mrcelooo@gmail.com" — isso causa deploy ERROR na Vercel porque o autor não bate com a conta vinculada ao GitHub (mfalcao09).

**Why:** Marcelo corrigiu isso duas vezes. O deploy na Vercel falha silenciosamente (sem logs de build) quando o autor do commit não corresponde ao usuário GitHub vinculado ao projeto Vercel.

**How to apply:** Em todo `git commit` ou `git -c user.name=... -c user.email=...`, usar os dados corretos acima. Verificar sempre antes de fazer push.
