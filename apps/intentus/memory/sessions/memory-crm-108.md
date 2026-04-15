# Sessao 108 — Fix Vercel Deploy Bloqueado (Diagnóstico)

**Data**: 21/03/2026
**Fase**: Manutenção / Deploy
**Item**: Vercel deploys ERROR — problema de usuário GitHub
**Status**: ✅ RESOLVIDO — Deploy em produção com sucesso

---

## Diagnóstico

### Problema
20+ deploys consecutivos falhando no Vercel com estado ERROR instantâneo (sem build logs — rejeição pré-build).

### Root Cause
Commits foram pushados diretamente do ambiente Cowork/Claude, que autentica como `mrcelooo-netizen` no GitHub. O Vercel aceita apenas deploys da conta `mfalcao09`:

- **Antes (funciona)**: `githubCommitAuthorLogin: "mfalcao09"` / email `contato@marcelofalcao.imb.br`
- **Depois (falha)**: `githubCommitAuthorLogin: "mrcelooo-netizen"` / email `mrcelooo@gmail.com`

### Timeline
- **Último deploy OK**: `dpl_6XYArJJPaL6mK3gjCn9mGBE3i4Hu` — P02 Cards Customizáveis (13/mar)
- **Primeiro deploy ERROR**: `dpl_ArE8TEWunCyg1aKzi2vsGh3qS6mh` — P06 Pipeline Analytics + G01 Metas (14/mar)

### Solução Aplicada
O problema real era o **git config LOCAL** do repositório (`~/Projects/GitHub/intentus-plataform`) que tinha `user.email = mrcelooo@gmail.com` e `user.name = Marcelo`, sobrescrevendo as configurações globais do GitHub Desktop.

Fix executado por Marcelo:
```bash
git config user.email "contato@marcelofalcao.imb.br"
git config user.name "mfalcao09"
```

### Resultado
- Deploy `dpl_CgYQKjSBXisaGUZnczCYkqCMArbk` → **READY** ✅
- `githubCommitAuthorLogin: "mfalcao09"` ✅
- Todas as features anteriores (20+ commits com ERROR) estavam no GitHub — o código nunca foi perdido, apenas o Vercel rejeitava o deploy. O último deploy buildou toda a codebase com sucesso.

### Lição
Git config local (`.git/config`) SEMPRE sobrescreve global. GitHub Desktop muda o global, não o local. Quando Cowork/Claude fazia push direto, o git config local era setado com `mrcelooo@gmail.com`, e isso persistia mesmo após mudar o GitHub Desktop.

## IDs Importantes
- Vercel Team: `team_Q0aWmmsHjFRW4cixrnefF7dW`
- Vercel Project: `prj_5fZlB3RgmLknfr3QbEDspSsbkJX7`
- GitHub Repo: `mfalcao09/intentus-plataform` (repoId: 1173546842)
- Conta OK: `mfalcao09`
- Conta bloqueada: `mrcelooo-netizen`
