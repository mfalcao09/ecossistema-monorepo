---
name: Git em FUSE filesystem — clonar em /tmp, verificar diff anti-perda
description: Git em FUSE filesystem — clonar em /tmp, verificar diff anti-perda
type: feedback
project: erp
tags: ["git", "fuse", "filesystem", "workaround"]
success_score: 0.9
supabase_id: 9c539714-8d06-4141-b1d1-2a268eadc33d
created_at: 2026-04-13 09:15:02.133452+00
updated_at: 2026-04-13 12:05:07.877099+00
---

O filesystem montado em /sessions/.../mnt/ERP-Educacional é FUSE e impede unlink de arquivos, causando falha em git merge, git checkout, e rm .git/index.lock. Para push: git clone completo em /tmp/diploma-push, copiar arquivos modificados lá, commitar e push. SEMPRE fazer git pull origin main no clone ANTES de copiar. CRÍTICO: Verificar git diff --stat e git diff no clone antes de commitar — se houver remoções inesperadas de features que NÃO fazem parte da task, PARAR e investigar. Sempre rm -f locks antes de operar.
