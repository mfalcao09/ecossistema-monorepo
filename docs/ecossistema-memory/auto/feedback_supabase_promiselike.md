---
name: Supabase PromiseLike não tem .catch()
description: Supabase client retorna PromiseLike (sem .catch()), usar .then(res => { if (res.error) ... }) em vez de .catch()
type: feedback
---

Supabase client retorna PromiseLike, não Promise completa. PromiseLike não tem `.catch()`.

**Why:** TypeScript error: `Property 'catch' does not exist on type 'PromiseLike<void>'`. Descoberto no Sprint 2 ao implementar log de transição de status.

**How to apply:** Sempre usar `.then((res) => { if (res.error) console.error(...) })` em vez de `.then(() => {}).catch((err) => {...})` com queries Supabase fire-and-forget.
