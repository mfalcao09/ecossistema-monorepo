---
name: Sessão 074 — Processo nasce no Upload (refatoração arquitetural)
description: processos_emissao criado no momento do upload (em_extracao), não após revisão. DB migration, RPC UPDATE/INSERT, lista navega à revisão. Commit e31ebfb READY.
type: project
---

Refatoração arquitetural completa entregue em sessão 074 (11/04/2026).

**Commit:** `e31ebfb` | **Deploy:** `dpl_5WPfjkdMawV89GhiPbYzHmE2xTEq` → READY ✅

**Problema:** Processo só nascia após o usuário confirmar dados na revisão. Se a sessão travasse, o processo sumia e não havia rastreabilidade. Kauana perdeu 16 documentos por esse motivo.

**Solução:**
- `processos_emissao` criado em `POST /api/extracao/iniciar` com `status='em_extracao'`
- `sessao_id FK` linkando o processo à sessão de extração desde o início
- `processos_emissao.nome` tornado nullable (preenchido só após confirmar dados)
- RPC `converter_sessao_em_processo`: UPDATE se `processo_id` já existe, INSERT para sessões legadas
- Lista de processos: nome null exibe "Extraindo documentos…" (italic violet); click navega direto à tela de revisão

**DB migration aplicada diretamente:**
- `ALTER TABLE processos_emissao ALTER COLUMN nome DROP NOT NULL`
- `ADD COLUMN sessao_id uuid REFERENCES extracao_sessoes(id) ON DELETE SET NULL`
- `UNIQUE INDEX uq_processos_emissao_sessao_id WHERE sessao_id IS NOT NULL AND status != 'cancelado'`

**Restrição importante:** FormularioRevisao NÃO foi tocado (proteção explícita de Marcelo).

**Why:** Rastreabilidade desde o upload; processo nunca "some" se sessão travar.

**How to apply:** Para novos processos: sempre que criar estado intermediário (extração, importação, etc.), criar o registro canônico (processo) imediatamente em status de rascunho/em_processamento — nunca adiá-lo para o final do fluxo.
