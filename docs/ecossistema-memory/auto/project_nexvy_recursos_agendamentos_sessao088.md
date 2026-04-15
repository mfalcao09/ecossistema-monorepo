---
name: Nexvy CRM — Recursos: Chats e Agendamentos (Sessão 088 batch 5)
description: Mapeamento completo dos módulos Chats (equipe) e Agendamentos (calendário + canais WhatsApp conectados FIC/WABA) do CRM Nexvy
type: project
---

## Chats (Recurso interno de equipe)

- URL: `console.nexvy.tech/chats`
- Chat interno entre membros da equipe (NÃO atendimento a clientes)
- Estado atual: vazio — "Nenhuma conversa"
- **Nova Conversa** → modal:
  - Campo: Título da conversa
  - Filtro por usuário: Suporte, Marcelo Falcão, Cristina Passos, Jhiully Lages, Fabiano Silva

## Agendamentos

- URL: `console.nexvy.tech/schedules`
- Visualização de calendário com 3 modos: **Mês / Dia / Lista**
- Período atual: Abril 2026 — 0 eventos cadastrados
- **Filtros disponíveis:**
  - Usuário (todos os 4 da equipe)
  - Contato
  - Agenda
  - Tipo de agendamento (Todos)

### Contas Vinculadas
- "Nenhuma conta Google conectada"
- Botão disponível para conectar Google Calendar

### Modal — Novo Agendamento (2 abas)

#### Aba Mensagem (envio via WhatsApp/canal)
- **Contato:** seletor de contato
- **Tipo de mensagem:** Texto | Imagem | Áudio | DS Voice
- **Variáveis disponíveis:** Primeiro Nome, Nome, Saudação, Protocolo, Hora
- **Data de Agendamento:** campo de data/hora
- **Canal de Atendimento:** dropdown (ver canais abaixo)

#### Aba Evento (Google Calendar)
- **Contato:** seletor
- **Título:** texto livre
- **Descrição:** texto livre
- **Data:** 13/04/2026 (padrão = hoje)
- **Hora Início / Hora Término**
- **Google Calendar:** toggle de sincronização (desconectado — "Conta Google não conectada")
- **Google Meet:** opção de gerar link de reunião

### DS Voice — Tipos disponíveis
- Mensagem
- Áudio
- Mídia
- Documento

## ⚡ DESCOBERTA CRÍTICA — Canais WhatsApp conectados

Dropdown "Canal de Atendimento" no modal de Agendamento revelou os canais ativos da conta AF Educacional:

| Canal | Tipo | Status |
|-------|------|--------|
| **Faculdades Integradas de Cassilândia – FIC** | Instagram/Facebook | 🔴 CONECTADO |
| **Faculdades Integradas de Cassilândia – WABA** | WhatsApp Business API | 🟢 CONECTADO |
| **Whats Antigo – FIC** | WhatsApp (legado) | 🟡 DESCONECTADO |

- **WABA = WhatsApp Business API** — canal principal ativo para atendimento FIC
- Canal Instagram/Facebook também conectado (FIC)
- Canal legado "Whats Antigo" desconectado (possivelmente substituído pelo WABA)

## Pendências identificadas

- Conectar Google Calendar para sincronização de eventos
- Usar canal WABA para agendamentos de mensagem automática
- Criar eventos de agendamento para testar pipeline completo
