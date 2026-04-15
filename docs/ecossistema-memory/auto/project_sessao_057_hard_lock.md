---
name: project_sessao_057_hard_lock
description: Sessão 057 (11/04): Epic 1.4 Hard Lock Jurídico — trigger imutabilidade pós-registro + unlock windows + Sprint 1 100% COMPLETO
type: project
---

Sessão 057 (11/04/2026): Epic 1.4 Hard Lock Jurídico implementado. **Sprint 1 Segurança Zero-Trust 100% COMPLETO.**

**O que foi entregue:**
- Extensão hstore (schema extensions) para comparação genérica de campos
- Tabela `diploma_unlock_windows` — janelas temporárias de 5 min
- Trigger `trg_hard_lock_diploma` (BEFORE UPDATE): bloqueia campos protegidos quando status ∈ {registrado, gerando_rvdd, rvdd_gerado, publicado}
- RPC `desbloquear_diploma_para_edicao()` — abre janela + grava override + cadeia custódia
- RPC `verificar_lock_diploma()` — consulta estado do lock
- Campos livres (sempre editáveis): status, updated_at, pdf_url, qrcode_url, url_verificacao, data_publicacao, xml_url, codigo_validacao, codigo_validacao_historico
- 5 testes OK no Supabase prod

**Commit:** 76eec5c
**Deploy:** diploma-digital-jmzf89cby READY (53s)

**Sprint 1 completo:**
- E1.1 PII Crypto ✅
- E1.2 Supabase Vault ✅
- E1.3 Railway Security ✅
- E1.4 Hard Lock Jurídico ✅

**Why:** Blindar dados jurídicos de diplomas registrados contra alteração acidental ou maliciosa.
**How to apply:** Qualquer UPDATE em campos protegidos de diploma pós-registro será bloqueado pelo trigger. Para edição excepcional, chamar `desbloquear_diploma_para_edicao(diploma_id, justificativa)` via Supabase RPC.
