# ClickSign — Pendência para Lançamento

**Data:** 08/03/2026
**Status:** 🟡 Pendente — infraestrutura de tipos pronta, integração funcional ausente

---

## Estado Atual

### O que já existe

1. **Tipos TypeScript completos** (`src/lib/signatureProvidersDefaults.ts`):
   - `ClickSignConfig`: `{ enabled, api_token, environment }`
   - `ClickSignSigner`: `{ name, email, cpf, autentica_via, papel }`
   - `ClickSignEnvelopeData`: `{ title, deadline_at, message, locale, sequence_enabled }`
   - Labels, cores, merge de configuração — tudo pronto

2. **Tela de configuração** (`ClmSettings.tsx`):
   - UI para habilitar/desabilitar ClickSign
   - Campo para API token
   - Toggle sandbox/production
   - Salvamento em `tenant_settings.signature_providers`

3. **Outros provedores na mesma infraestrutura:**
   - DocuSign, D4Sign, Registro de Imóveis, gov.br — todos com tipos e config
   - Nenhum tem integração funcional (apenas tipos + UI de config)

### O que NÃO existe

1. **Chamadas à API ClickSign** — nenhum código faz requisições HTTP ao ClickSign
2. **Edge Function de assinatura** — não há function `send-to-clicksign` ou similar
3. **Fluxo de envio de documento** — não há botão "Enviar para assinatura" funcional no contrato
4. **Webhook de callback** — não há endpoint para receber status de assinatura (signed, refused, etc.)
5. **Upload de PDF para ClickSign** — não há geração de PDF do contrato + upload via API

## Por que é pendência (não blocker)

O CLM funciona **100% sem assinatura digital**. Os contratos podem ser:
- Gerados por IA e baixados como HTML
- Impressos para assinatura manuscrita
- Exportados e assinados por qualquer ferramenta externa

A integração com ClickSign é um **upgrade de conveniência**, não um requisito funcional.

## O que precisa ser feito (quando for hora)

### Fase 1: MVP ClickSign (estimativa: 8-12h)

1. **Edge Function `clicksign-send`** (~3h):
   - Recebe: `contract_id`, `signers[]`, `envelope_config`
   - Gera PDF do contrato (via Puppeteer/html-pdf ou recebe HTML)
   - Cria documento na API ClickSign (`POST /api/v1/documents`)
   - Adiciona signatários (`POST /api/v1/lists`)
   - Adiciona signatários ao documento (`POST /api/v1/lists/{key}/signers`)
   - Envia para assinatura (`POST /api/v1/notifications`)
   - Salva `envelope_id` no contrato

2. **Edge Function `clicksign-webhook`** (~2h):
   - Recebe callbacks de assinatura (signed, refused, deadline_expired)
   - Atualiza status no contrato
   - Cria notificação automática para o usuário
   - Salva audit trail com IP, timestamp, hash

3. **Componente `SendToSignatureDialog.tsx`** (~3h):
   - Selecionar provedor (ClickSign, DocuSign, etc.)
   - Configurar signatários (puxar de `contract_parties`)
   - Definir ordem de assinatura
   - Definir método de autenticação por signatário
   - Enviar

4. **Status badge no contrato** (~1h):
   - Badge "Aguardando assinatura", "Assinado", "Recusado"
   - Timeline de eventos de assinatura
   - Link para acompanhar no painel ClickSign

### Fase 2: Aprimoramentos (~6-8h adicionais)

- Suporte a múltiplos provedores simultâneos
- Template de posição de rubrica/assinatura no PDF
- Reenvio automático para signatários que não assinaram
- Integração com fluxo de aprovação (só enviar após aprovação)
- Dashboard de status de envelopes

## API ClickSign — Referência Rápida

- **Base URL Sandbox:** `https://sandbox.clicksign.com`
- **Base URL Produção:** `https://app.clicksign.com`
- **Autenticação:** `?access_token={api_token}` em todos os endpoints
- **Documentação:** https://developers.clicksign.com

### Endpoints principais:
- `POST /api/v1/documents` — Upload de documento
- `POST /api/v1/signers` — Criar signatário
- `POST /api/v1/lists` — Adicionar signatário ao documento
- `POST /api/v1/notifications` — Enviar para assinatura
- `GET /api/v1/documents/{key}` — Status do documento

## Alerta para Marcelo

> **Para o lançamento:** O CLM pode ir ao ar **sem ClickSign**. A assinatura digital é um diferencial competitivo importante, mas não é blocker para o MVP.
>
> **Recomendação:** Lançar sem, validar com primeiros clientes, e implementar ClickSign como primeira grande feature pós-lançamento (2-3 semanas após go-live).
>
> **Custo ClickSign:** A partir de R$ 99/mês no plano Essencial (até 50 documentos/mês). Verificar se o plano API está incluído ou requer upgrade.

---

*Documento gerado automaticamente — Sessão de 08/03/2026*
