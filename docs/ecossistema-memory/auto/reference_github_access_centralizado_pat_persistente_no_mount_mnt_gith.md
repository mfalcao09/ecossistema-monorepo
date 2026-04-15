---
name: GitHub Access Centralizado (PAT persistente no mount /mnt/GitHub)
description: GitHub Access Centralizado (PAT persistente no mount /mnt/GitHub)
type: reference
project: erp
tags: ["github", "pat", "auth", "cross-sandbox", "git"]
success_score: 0.9
supabase_id: fec521b4-abd4-48ed-9017-9fcd03682337
created_at: 2026-04-14 09:15:14.333791+00
updated_at: 2026-04-14 11:07:32.126036+00
---

Desde **08/04/2026 (v3)**, a autenticação GitHub é **persistente entre sessões Cowork**.

## Setup canônico (v3 — persistente cross-sandbox)
- **Tipo de token:** Fine-grained PAT (NÃO classic)
- **Arquivo persistente:** `/sessions/{SANDBOX_ID}/mnt/GitHub/.github-token`
- No Mac: `/Users/marcelosilva/Projects/GitHub/.github-token`
- **Por que funciona cross-sandbox:** a pasta `/mnt/GitHub/` é um bind mount do Mac — existe em TODO sandbox Cowork novo automaticamente.
- `chmod 600` (só o dono lê). Fica FORA de qualquer repositório git.
- **Helper git global:** `store --file=/sessions/{SANDBOX_ID}/mnt/GitHub/.github-token`

**Permissões mínimas:** `Contents: RW`, `Metadata: R`, `Pull requests: RW`, `Workflows: RW`
