# ADR-017: Pareamento WhatsApp via Baileys direto (Nível 2), não Evolution API nem Meta Cloud

- **Status:** aceito
- **Data:** 2026-04-19
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte X (Jarvis 4 estágios); ADR-011 (pipecat + LiveKit voice stack); D3 do V4 (Jarvis CLI → WhatsApp → Voz → Always-on); Fase 1 S01 (jarvis-app PR #25)

## Contexto e problema

Marcelo precisa que Jarvis (uso pessoal) e, depois, o módulo comercial da FIC (atendimento) **recebam e enviem mensagens WhatsApp em tempo real**. A plataforma web deve:

1. Exibir um QR code para o admin parear um número WhatsApp (igual WhatsApp Web)
2. Receber mensagens entrando via webhook/realtime
3. Exibir inbox (threads, mídia, envio)
4. Suportar **multi-tenant por número** — cada número é uma instância isolada; um mesmo tenant pode ter N números

Restrições de contexto:
- **Jarvis pessoal** usa o WhatsApp pessoal do Marcelo (não tem empresa verificada na Meta pra Cloud API)
- **Fase 1 S01** já marcou "Evolution API + Expo + Action Button" como arquitetura provisória de Jarvis — mas Evolution API é serviço caixa-preta de terceiro, e Marcelo fez questão explícita de que o **pareamento seja nosso código**, não um produto externo em runtime
- Orçamento zero para SaaS de WhatsApp (Twilio, Zenvia, etc.)

## Opções consideradas

- **Opção 1 — Meta Cloud API oficial.** Rota aprovada, templates, webhook nativo. Precisa de: Meta Business verificado, conta WhatsApp Business API, templates pré-aprovados, custo por conversa. Não serve para número pessoal do Marcelo (tem que ser empresa).
- **Opção 2 — Evolution API (caixa-preta).** Wrapper open-source em cima da Baileys que expõe REST + webhooks. Rápido de subir, mas adiciona serviço Docker terceiro em runtime, dificulta debug, e o Marcelo pediu explicitamente pra não usar.
- **Opção 3 — Baileys como biblioteca, nosso serviço (Nível 2).** `@whiskeysockets/baileys` é MIT, open-source, ~50k LOC TS, mantida por comunidade ativa. Ela fala o protocolo WhatsApp Web não-oficial (QR pairing, Signal Protocol E2E, Noise handshake). Nós escrevemos a camada de cima: pareamento UI, multi-instância, persistência de auth state, inbox, webhooks.
- **Opção 4 — Reimplementar o protocolo WhatsApp Web do zero (Nível 3).** Noise Protocol + Signal Protocol + WebSocket binário multiplexado + curve25519 QR pairing + re-engenharia reversa contínua. Baileys/WhatsMeow/yowsup são projetos de anos com dezenas de contribuidores. Meses pra MVP, manutenção eterna.

## Critérios de decisão

- **Controle sobre o código** — Marcelo quer poder ler cada linha do pareamento
- **Zero dependência de terceiro em runtime** — sem Evolution API, sem Twilio
- **Custo zero** — número pessoal, sem Meta Business
- **Velocidade pro MVP** — precisa rodar em semanas, não meses
- **Multi-tenant por número** — N instâncias em paralelo, isoladas

## Decisão

**Escolhemos Opção 3 — Baileys como biblioteca, em serviço próprio.**

Nosso serviço `apps/whatsapp-gateway` (Node 24 + Hono + Baileys) gerencia N instâncias WhatsApp em paralelo. Cada instância = 1 socket Baileys = 1 número. Auth state persistido em Supabase (não filesystem — container Railway é efêmero). QR e mensagens emitidos via Supabase Realtime pros apps consumidores (Jarvis, inbox FIC).

Opção 1 (Meta Cloud) fica registrada como **caminho de migração** quando FIC virar empresa verificada e precisar de volume/templates. Pro Jarvis pessoal continua sendo Baileys.

## Consequências

### Positivas

- Código inteiro é nosso — zero caixa-preta em runtime
- Mesmo engine atende Jarvis pessoal + FIC comercial + qualquer futuro tenant
- Multi-tenant por número nativo (1 socket = 1 instância, N em paralelo)
- Reaproveitável: pacote `@ecossistema/whatsapp-types` compartilha tipos com Jarvis e inbox FIC
- Pareamento UI idêntico a WhatsApp Web oficial (conforto de usuário)

### Negativas

- **Risco de banimento**: WhatsApp detecta clientes não-oficiais e pode banir o número. Mitigação: usar chip secundário pra testes; nunca o número principal de cliente; respeitar rate limits implícitos (~20 msg/min pra novos contatos)
- **Dependência de upgrades da Baileys**: quando WhatsApp muda o protocolo, Baileys às vezes leva 1-2 semanas pra atualizar. Durante isso, instâncias podem ficar offline
- **Auth state = chave do reino**: se a linha da `whatsapp_auth_state` vazar, atacante tem acesso total às conversas. RLS service_role-only + encryption at rest obrigatórios
- **Não substitui Meta Cloud API em cenários enterprise**: templates pré-aprovados, SLA, campanhas outbound — tudo isso exige oficial

### Neutras / riscos

- **`@lid` (Linked Device ID)**: desde 2024 o WhatsApp anonimiza remetentes como `107816631177464@lid` em vez de `55XX@s.whatsapp.net`. Precisamos de LID → phone resolver (via `sock.onWhatsApp()` ou contacts store) pra inbox exibir número/nome certo
- **history sync na primeira conexão**: no pareamento, WhatsApp envia mensagens passadas encriptadas em `protocolMessage` / `historySyncNotification`. Não são mensagens de usuário — precisa filtrar na camada de persistência
- **Arquitetura Jarvis Fase 1 S01 (PR #25)** previa Evolution API. Este ADR supersede essa parte. Resto de S01 (Expo + Action Button + Swift App Intents) permanece válido

## Evidência / pesquisa

- **Spike validado em 2026-04-19** (Nível 2): `scripts/spikes/whatsapp-baileys/` rodou com sucesso todos os 4 critérios:
  1. Pareamento via QR: `✅ CONECTADO — número 556781119511`
  2. Recebe texto: `[20:51:45] 📨 107816631177464@lid: Teste Funcionamento`
  3. Recebe mídia: `[20:52:46] 📨 107816631177464@lid: [imagem]`
  4. Sessão persiste: segunda execução conectou sem QR
- **Baileys v2.3000.x** confirmada estável em Node 24 LTS macOS
- Warning do build nativo de `canvas` (dep opcional pra QR PNG) é inofensivo — usamos `qrcode-terminal` (ASCII) no spike e QR renderizado como base64 PNG no gateway
- Reconexão automática (`code 503`) funcionou sem intervenção

## Ação de implementação

1. ~~Spike de validação Nível 2~~ ✅ 2026-04-19
2. ADR-017 publicado ✅
3. **Fase A (concluída com este commit)**: memory + pendências atualizados
4. **Fase B (manual, Marcelo)**: provisionar Supabase `jarvis-pessoal` — URL + service_role key em `ecosystem_credentials` via gateway (P-019, P-020)
5. **Fase C (próxima sessão)**: migrations `whatsapp_schema` + `packages/whatsapp-types` + `apps/whatsapp-gateway` (Hono + Baileys + auth state adapter Supabase) + LID resolver + history-sync filter
6. **Fase D**: web inbox (Next.js) + deploy Railway

## Revisão

Revisar em: **2026-07-19** (3 meses pós-GA) ou se acontecer um dos gatilhos:
- Banimento de qualquer número (revisar estratégia: chip dedicado vs migração Meta Cloud)
- WhatsApp quebra Baileys por > 2 semanas (avaliar fallback Meta Cloud)
- FIC virar empresa Meta verificada (migração Meta Cloud fica viável)
