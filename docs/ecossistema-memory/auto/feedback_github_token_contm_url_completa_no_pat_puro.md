---
name: .github-token contém URL completa, não PAT puro
description: .github-token contém URL completa, não PAT puro
type: feedback
project: erp
tags: ["git", "github", "token", "formato"]
success_score: 0.85
supabase_id: 7a3b6be3-6e22-422d-99e0-dcce032ca93e
created_at: 2026-04-13 09:13:52.723688+00
updated_at: 2026-04-13 10:04:51.605122+00
---

O arquivo /Users/marcelosilva/Projects/GitHub/.github-token contém URL completa no formato https://mfalcao09:github_pat_...@github.com (não PAT puro). NUNCA passar $(cat .github-token) direto como password — grava a URL inteira, GitHub rejeita. Para extrair PAT puro: TOKEN=$(sed -E 's|https://[^:]+:([^@]+)@.*|\1|' /Users/marcelosilva/Projects/GitHub/.github-token | tr -d '\n\r '). Para credential.helper global do sandbox, o formato URL funciona. Para Keychain nativo do Mac ou qualquer lugar que espere PAT puro, precisa extrair primeiro.
