---
name: Supabase PromiseLike não tem .catch() — usar .then() com if(res.error)
description: Supabase PromiseLike não tem .catch() — usar .then() com if(res.error)
type: feedback
project: erp
tags: ["supabase", "typescript", "promise", "bug"]
success_score: 0.85
supabase_id: e8c65027-2ff4-4cd4-9c9c-1ac25c14468d
created_at: 2026-04-13 09:15:02.133452+00
updated_at: 2026-04-13 12:05:07.103334+00
---

Supabase client retorna PromiseLike, não Promise completa. PromiseLike não tem .catch(). TypeScript error: "Property catch does not exist on type PromiseLike<void>". Sempre usar .then((res) => { if (res.error) console.error(...) }) em vez de .then(() => {}).catch((err) => {...}) com queries Supabase fire-and-forget.
