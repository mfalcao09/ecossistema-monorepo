# Spike — WhatsApp via Baileys

Spike de validação para confirmar que conseguimos parear um número WhatsApp com nosso próprio código (sem Evolution API), usando `@whiskeysockets/baileys` diretamente.

**Objetivo:** escanear QR no terminal com o celular → ver mensagens entrando em tempo real no terminal.

> ⚠️ **Use um número secundário.** WhatsApp pode banir números que usam clientes não-oficiais. Não use seu número principal.

---

## Pré-requisitos

- Node.js ≥ 20
- pnpm (via corepack)
- WhatsApp instalado num celular com número secundário

## Rodar

```bash
cd scripts/spikes/whatsapp-baileys
pnpm install --ignore-workspace
pnpm start
```

> ⚠️ **Precisa de `--ignore-workspace`**. O spike vive dentro de um monorepo pnpm (`pnpm-workspace.yaml` na raiz). Sem a flag, o `pnpm install` sobe pro workspace root e não instala nada aqui. A flag força modo isolado.

> ℹ️ **Warning do `canvas` build is OK.** Baileys tem `canvas` como dep opcional pra gerar QR como PNG — precisa de headers nativos (cairo/pango) pra buildar. A gente usa `qrcode-terminal` (ASCII puro), então o build fail é inofensivo.

## O que esperar

1. Terminal mostra versão da Baileys e um QR code em ASCII
2. No celular: **WhatsApp → ⋮ → Dispositivos conectados → Conectar um dispositivo**
3. Escanear o QR do terminal
4. Terminal mostra `✅ CONECTADO — número 55...`
5. Manda uma mensagem pra esse número de outro WhatsApp qualquer
6. Terminal imprime: `[HH:MM:SS] 📨 55...@s.whatsapp.net: sua mensagem`

A sessão fica persistida em `./auth/` (gitignored). Próxima execução conecta direto, sem novo QR.

## Comandos úteis

- `pnpm reset` — apaga `./auth/` pra forçar novo QR (simula "desconectar dispositivo")
- `Ctrl+C` — encerra sem deslogar (sessão continua válida)

## Troubleshooting

**"Connection closed, code 401"** — sessão revogada (você desconectou no celular). Rode `pnpm reset`.

**"Connection closed, code 515"** — stream conflict (normal na primeira conexão após QR). O script reconecta sozinho.

**QR não aparece ou fica ilegível** — terminal pequeno demais. Maximiza a janela.

**`fetchLatestBaileysVersion` falha** — sem internet ou WhatsApp mudou endpoint. O script tenta versão padrão mesmo assim.

## Critério de sucesso do spike

- [ ] Pareamento via QR funciona
- [ ] Recebe mensagem de texto entrando no terminal
- [ ] Recebe mídia (imagem/áudio) como `[imagem]` / `[áudio]`
- [ ] Sessão persiste entre reinícios (Ctrl+C → `pnpm start` não pede QR de novo)

Se os 4 itens passarem, validamos o Nível 2 e partimos pro gateway real (`apps/whatsapp-gateway/`).

## Próximos passos (pós-spike)

1. Migrar `useMultiFileAuthState` (filesystem) pra adaptador Supabase DB — container Railway é efêmero
2. Envelopar Baileys num serviço Hono multi-instância
3. Emitir eventos via Supabase Realtime pro web
4. Schema de persistência (`whatsapp_instances`, `whatsapp_messages`, etc.)
5. Web inbox (Next.js)
