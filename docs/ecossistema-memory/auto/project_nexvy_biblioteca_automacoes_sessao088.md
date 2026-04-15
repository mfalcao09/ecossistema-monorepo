---
name: Nexvy CRM — Biblioteca de Vídeos, DS Agente, DS Bot, Integrações e Filas (Sessão 088 batch 7)
description: Mapeamento completo dos módulos Biblioteca de Vídeos, Automações (DS Agente, DS Bot, Integrações, Filas) com descoberta crítica de integração n8n já configurada
type: project
---

## Biblioteca de Vídeos (`/explanatory-videos-feed`)

- Biblioteca de tutoriais de uso do sistema
- Estado atual: vazio — "Nenhum vídeo disponível — Ainda não há vídeos cadastrados no sistema"
- Estatísticas: 0 Total | 0 Visualizados | 0 Seções
- Busca: campo de pesquisa por título, descrição ou rota
- Abas: **Todos** | **Visualizados** | **Não Visualizados**

---

## Automações → DS Agente (`/ds-agente`)

- Estado atual: vazio — "Nenhum DS Agente — Crie um novo agente para começar"
- Organização por pastas: botão "Nova Pasta"
- Botão: `+ Adicionar Agente`

### Modal — Adicionar Agente

**Configurações básicas:**
- Nome
- Provedor: dropdown (OpenAI Padrão)
- API Key (campo oculto/senha)
- ID do Assistente
- Modelo Open AI (dropdown)
- Instruções (textarea grande — system prompt do agente)

**Base de Conhecimento (RAG):**
- Botão `+ Adicionar` para documentos de conhecimento

**Parâmetros numéricos:**
| Parâmetro | Valor padrão |
|-----------|-------------|
| Temperatura | 1 |
| Máx Tokens | 100 |
| Máx Histórico | 10 |
| Delay | 0s |
| Ignorar mensagens até X secs | 0 |
| Responder tickets com responsável | Não |

**Toggles (on/off):**
- Dividir respostas em blocos
- Processar imagens
- Desabilitar agente quando responder fora da plataforma

**Regras de Ativação (lógica condicional):**
- Operador do Grupo: `E (todas as regras devem ser atendidas)`
- Regra exemplo: Operador (TEM) + Tipo (TAG) + Tag (selector)
- Múltiplas regras podem ser adicionadas

---

## Automações → DS Bot (`/ds-bot`)

- Plano: **Unlimited** (confirmado na conta AF EDUCACIONAL)
- 1 bot existente: **"Meu DS Bot"** (com menu ⋮)

### Opções para criar novo DS Bot:
1. Comece do zero
2. Comece a partir de um modelo
3. Importar um arquivo

### Editor Visual — "Meu DS Bot"

**Abas:**
- **Fluxo** | **Tema** | **Configurações** | **Compartilhar**

**Barra de ação:**
- Botão `Publicar` (laranja)
- ▶ Play/teste
- 👤 Usuário
- Undo / Redo
- ⚙️ Configurações

**Canvas:**
- Nó "Início" como ponto de partida do fluxo

**Painel esquerdo — Componentes:**

Seção **Bubbles** (saída/exibição):
- Texto | Imagem | Vídeo | Incorporar | Áudio

Seção **Inputs** (entrada do usuário):
- Texto | Número | Email | Website | Data | Time | Telefone
- Botão | Seleção de Imagem | Pagamento | Avaliação | Arquivo

---

## Automações → Integrações (`/queue-integration`)

### ⚡ DESCOBERTA CRÍTICA — Integração n8n já configurada!

| Campo | Valor |
|-------|-------|
| Tipo | N8N |
| ID | **2967** |
| Nome | **N8N – AF EDUCACIONAL** |
| Status | Ativo |

Esta integração está pré-configurada e disponível para uso em Filas e automações.

### Modal — Adicionar Integração

**Tipo de integração** (dropdown):
- **DialogFlow** — Linguagem, Nome do Projeto, JsonContent, botão "Testar Bot"
- **N8N** — (configuração de webhook/workflow)
- **WebHooks** — (endpoint externo)
- **DS Bot** — (bot interno da plataforma)

---

## Automações → Filas (`/queues`)

- Estado atual: lista vazia
- Colunas: Id | Nome | Usuários | Mensagem de saudação | Ações

### Modal — Adicionar Fila (2 abas)

#### Aba: DADOS DA FILA
| Campo | Detalhe |
|-------|---------|
| Nome | Obrigatório |
| Cor | Seletor completo (hex + picker), padrão: `#22194D` |
| Ordem da fila | Bot (dropdown) |
| **Distribuição automática** | Aleatória \| Sequencial \| Ordenada \| Não distribuir \| Fila de Espera |
| **Integração** | Nenhum \| **N8N – AF EDUCACIONAL** ← integração ativa aparece aqui |
| **DS Agente** | Nenhum (vazio — nenhum agente criado ainda) |
| Usuários que podem ver todas as conversas | Multi-select de usuários |

**Visibilidade de tickets sem atribuição:**
- Todos os usuários → Todos podem ver (padrão)
- Nenhum pode ver
- Selecionar usuários específicos

**Mensagem de saudação:**
- Campo textarea com suporte a variáveis: `{{primeiroNome}}`, `{{nomeCompleto}}`, `{{saudacao}}`, `{{hora}}`

**Opções da fila:**
- Botão `+ Adicionar` → cria itens numerados (ex: "Título não definido" ✏️)

#### Aba: USUÁRIOS DA FILA
- Seleção de usuários que fazem parte da fila de atendimento

---

## Pendências identificadas

- Criar primeiro DS Agente com base de conhecimento da FIC (FAQ, matrícula, etc.)
- Criar fluxo completo no DS Bot para captação de leads/matrículas
- Criar fila de atendimento vinculando integração N8N – AF EDUCACIONAL
- Configurar DS Agente nas filas de atendimento
- Explorar Configurações + Compartilhar do DS Bot (não mapeadas)
- Testar workflow n8n ID 2967 com fila de atendimento
