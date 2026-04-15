---
name: BRy Bridge Script Obrigatório
description: BRy Bridge Script Obrigatório
type: project
project: erp
tags: ["bry", "assinatura", "bridge-script", "extensão-chrome"]
success_score: 0.9
supabase_id: 414a65bc-608e-4cfd-afd3-9be8409c8bf8
created_at: 2026-04-14 09:13:13.023116+00
updated_at: 2026-04-14 10:07:20.779295+00
---

window.BryWebExtension NÃO é injetado diretamente pela extensão BRy Signer no Chrome. É criado por um script JS externo (bridge) hospedado em:
`https://www.bry.com.br/downloads/extension/v2/api/v1/extension-api.js`

Sem carregar esse script, window.BryWebExtension é SEMPRE undefined.

A API é Promise-based:
- `isExtensionInstalled()` → `Promise<boolean>` (NÃO boolean)
- `listCertificates()` → `Promise<BryCertificate[]>`
- `installComponents()` → `Promise<unknown>` (obrigatório, não optional)
- `sign(certId, input)` → `Promise<BrySignResult>`

Fluxo correto: carregar bridge → isExtensionInstalled() → installComponents() → listCertificates()

**Why:** Sessão 079 — investigação profunda na documentação oficial BRy revelou que o retry loop era inútil sem o bridge script.

**How to apply:** Qualquer página que use a extensão BRy DEVE carregar o script via `<Script src="...extension-api.js" />` e tratar todas as chamadas como async/Promise.
