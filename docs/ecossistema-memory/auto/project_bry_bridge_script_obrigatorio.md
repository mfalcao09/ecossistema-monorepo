---
name: BRy Bridge Script Obrigatório
description: window.BryWebExtension NÃO é injetado pela extensão Chrome — requer script externo extension-api.js da BRy
type: project
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

**Why:** Sessão 079 — investigação profunda na documentação oficial BRy (geracao-diploma-extensao-master.zip) revelou que o retry loop da sessão 078 era inútil porque o objeto nunca seria injetado sem o bridge script.

**How to apply:** Qualquer página que use a extensão BRy DEVE carregar o script via `<Script src="...extension-api.js" />` e tratar todas as chamadas como async/Promise.
