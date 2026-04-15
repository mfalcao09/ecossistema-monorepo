---
name: Rodar build local antes de push quando há commits de sessão paralela
description: Quando origin/main contém commits novos de sessão paralela, rodar `next build` completo antes de commitar — não só tsc — para pegar dependências faltantes
type: feedback
---

Quando houver commits recentes no origin/main feitos por outra sessão/pessoa, rodar `next build` completo (não só `tsc --noEmit`) no clone /tmp antes de commitar e fazer push.

**Why:** Em 2026-04-07 o commit 0c25a58 (sessão paralela) introduziu `src/lib/xml/validation/xsd-validator.ts` importando `fast-xml-parser`, mas esqueceu de adicionar a dependência em `package.json`. Resultado: o deploy de 0c25a58 entrou em ERROR no Vercel e o meu commit 9902e87 (Onda 1) herdou a mesma quebra — ficou em ERROR também, mesmo a Onda 1 estando perfeita. Tive que fazer um commit extra `chore(deps)` para destravar. Se eu tivesse rodado `next build` antes do push, teria detectado o import quebrado e feito um único commit unificado.

**How to apply:**
- Sempre que `git log origin/main` mostrar commits recentes que eu não fiz, rodar `npm install && npx next build` no clone /tmp antes de commitar por cima
- `tsc --noEmit` sozinho não pega dependências faltantes quando há skip libs — só o build completo do Next pega
- Se o build falhar por causa de algo da sessão paralela, avisar Marcelo e decidir: (a) fixar junto num commit separado `chore/fix`, (b) alertar a outra sessão
