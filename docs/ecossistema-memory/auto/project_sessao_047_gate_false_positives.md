---
name: Sessão 047 — Fix gate false positives + PDF inline preview
description: Fix 3 root causes of gate reporting 9 false blocking issues on filled forms; iframe PDF preview; RPC updated in Supabase
type: project
---

Sessão 047 (10/04/2026): gate de criação reportava 9 violações bloqueantes falsas (5 campos faltando + 4 comprobatórios ausentes) mesmo com formulário preenchido e 4/4 confirmados.

**3 causas raiz corrigidas:**
1. Converter route lia `dados.aluno` mas FormularioRevisao salva em `dados.diplomado` — corrigido com COALESCE fallback chain
2. Nomes de campo divergentes: `nome` vs `nome_completo`, `rg` vs `rg_numero` — todos mapeados
3. Gate filtrava comprobatórios por `destino_xml=true` mas default é `false` — removido filtro, agora conta todos com `tipo_xsd` preenchido

**Também nesta sessão:**
- PDF inline preview: `<object>` substituído por `<iframe>` + blob URL (commit 044bf49)
- RPC `converter_sessao_em_processo` atualizada no Supabase com mesmo COALESCE + split_part naturalidade + rg_numero fallback

**Commits:** 044bf49 (iframe), 5474b5d (gate fix)
**Why:** Sem esse fix, nenhuma sessão de extração poderia ser convertida em processo — o gate bloqueava 100% das vezes.
**How to apply:** Qualquer mapeamento entre FormularioRevisao e backend deve usar fallback chain `diplomado → aluno` para campos e `nome_completo → nome` para sub-campos.
