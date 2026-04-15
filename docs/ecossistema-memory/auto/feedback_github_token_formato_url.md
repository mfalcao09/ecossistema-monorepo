---
name: .github-token contém URL, não PAT puro
description: O arquivo `/Users/marcelosilva/Projects/GitHub/.github-token` contém `https://mfalcao09:PAT@github.com` (URL completa), não o PAT puro. Usar `cat` direto como password falha. Sempre extrair o PAT com regex antes de gravar no Keychain ou usar como credencial.
type: feedback
---

# .github-token = URL, não PAT puro

**A regra:** nunca passar `$(cat /Users/marcelosilva/Projects/GitHub/.github-token)` direto como password. O arquivo contém URL completa no formato `https://mfalcao09:github_pat_...@github.com` (123 bytes, 1 linha).

**Why:** em 08/04/2026, ao configurar o Keychain nativo do Mac via `git-credential-osxkeychain store`, usei `TOKEN=$(cat .github-token)` como password. Gravou a URL inteira, GitHub rejeitou com `Invalid username or token. Password authentication is not supported for Git operations.` Precisei apagar a entrada com `erase`, extrair o PAT puro com regex e regravar. Foi um round-trip inteiro desperdiçado.

**How to apply:** sempre que precisar do PAT puro, usar:
```bash
TOKEN=$(sed -E 's|https://[^:]+:([^@]+)@.*|\1|' /Users/marcelosilva/Projects/GitHub/.github-token | tr -d '\n\r ')
```
Isso extrai só a parte entre `:` e `@` (o PAT de 93 chars, começando com `github_pat_11B...`). O `tr` remove whitespace defensivo.

Se for só usar como credential.helper global do sandbox (fallback v3), o formato URL funciona — o git aceita. Mas pro Keychain nativo do Mac ou qualquer lugar que espere PAT puro, precisa extrair primeiro.
