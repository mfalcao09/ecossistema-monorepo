---
name: Git em FUSE filesystem — workaround + verificação anti-perda
description: Filesystem montado (FUSE) impede git merge. Clonar em /tmp, copiar, push. VERIFICAR DIFF para não perder features.
type: feedback
---

O filesystem montado em `/sessions/.../mnt/ERP-Educacional` é FUSE e impede `unlink` de arquivos, causando falha em `git merge`, `git checkout`, e `rm .git/index.lock`.

**Why:** `error: unable to unlink old 'file': Operation not permitted`. Na sessão de anti-alucinação (2026-04-05), copiar page.tsx do mounted para /tmp/diploma-push SOBRESCREVEU features de commits anteriores (rascunho, ENADE, assinantes) porque a versão montada pode estar desatualizada.

**How to apply:**
1. Para push: `git clone` completo em `/tmp/diploma-push`, copiar arquivos modificados lá, commitar e push
2. SEMPRE fazer `git pull origin main` no clone ANTES de copiar
3. **CRÍTICO**: Verificar `git diff --stat` e `git diff` no clone antes de commitar — se houver remoções inesperadas de features que NÃO fazem parte da task, PARAR e investigar
4. Considerar editar diretamente no clone `/tmp/diploma-push` em vez de copiar do mounted
5. Sempre `rm -f /tmp/git-clone-dir/*.lock /tmp/git-clone-dir/refs/heads/*.lock` antes de operar
