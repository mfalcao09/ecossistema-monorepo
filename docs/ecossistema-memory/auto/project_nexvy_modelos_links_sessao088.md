---
name: Nexvy CRM — Modelos de Mensagem e Links de Redirecionamento (Sessão 088 batch 6)
description: Mapeamento completo de Modelos de Mensagem (WhatsApp templates Meta) e Links de Redirecionamento com tipos de distribuição e descoberta de erro no canal FIC
type: project
---

## Modelos de Mensagem (console.nexvy.tech/message-templates)

- Canal exibido: **Faculdades Integradas de Cassilândia – WABA** (seletor no topo)
- Estado atual: vazio — "Nenhum template encontrado"
- Botões: `+ Novo Modelo` | `Sincronizar` (sincroniza templates com a Meta/WhatsApp)

### Filtros
- **Categoria:** Todas | Utilitário | Marketing | Autenticação
- **Status:** Todos | Rascunho | Pendente | Aprovado | Rejeitado | Desabilitado | Pausado | Limite Excedido | Em Recurso | Aguardando Exclusão
- **Status Ativo:** Todos | Ativo | Inativo

### Formulário — Criar Novo Template

**Regras (dicas exibidas no formulário):**
- Template precisa de aprovação da Meta antes do uso (24-48h)
- Use linguagem clara e profissional
- Evite palavras promocionais agressivas em templates de Utilitário
- Variáveis são dinâmicas, mas a mídia é fixa para todos

**Informações Básicas:**
- Nome do Template: minúsculas, números e sublinhados apenas
- Idioma: Português (BR) | English (US) | Español (ES)
- Categoria (cards selecionáveis):
  - **Utilitário** — atualizações de conta, pedidos, alertas e notificações transacionais
  - **Marketing** — promoções, ofertas, anúncios de produtos e campanhas promocionais
  - **Autenticação** — códigos de verificação e senhas únicas (OTP)
- Descrição (campo livre)

**Conteúdo do Template:**

Cabeçalho (opcional) — 4 tipos:
- Texto | Imagem | Vídeo | Documento

Texto do Corpo (obrigatório):
- Limite: 1024 caracteres
- Suporte a variáveis dinâmicas: `{{1}}`, `{{2}}`, etc. via botão "Adicionar Variável"
- ⚠️ Texto NÃO pode começar com uma variável (validação em tempo real)
- Parâmetros detectados automaticamente com campo de configuração de como cada variável será preenchida no envio
- Preview ao vivo mostra nome de exemplo ("João Silva") para variáveis

Texto do Rodapé (opcional):
- Limite: 60 caracteres

**Botões (Opcional) — 2 tipos MUTUAMENTE EXCLUSIVOS:**

Tipo 1 — Resposta Rápida (até 3 botões):
- Texto do Botão: até 25 caracteres
- Cliente responde com 1 clique
- Botão: `+ Adicionar Resposta Rápida`

Tipo 2 — Chamada para Ação (até 2 botões):
- Visitar Website: Texto + URL (https:// obrigatório)
- Ligar: Texto + Número de Telefone (incluir código do país)
- Botões: `+ Adicionar URL` | `+ Adicionar Telefone`

⚠️ NÃO é possível misturar Resposta Rápida com Chamada para Ação no mesmo template

**Preview da Mensagem** (painel lateral direito):
- Renderização em tempo real de como a mensagem aparecerá no WhatsApp do destinatário

---

## Links de Redirecionamento (console.nexvy.tech/link-redirects)

- Estado atual: vazio — nenhum link criado
- Colunas da tabela: Nome | URL | Distribuição | Canais de atendimento | Status | Ações

### Modal — Criar Link de Redirecionamento
- **Nome** do link
- **Identificador único** (slug da URL) — ex: `meulink` → gera URL rastreável curta
- **Tipo de Distribuição** (dropdown):
  - Sequencial
  - Aleatória
  - Ordenada
  - Por Horário
- **Texto do Redirecionamento** (textarea)
- **Canais de Atendimento** (multi-select)

### ⚡ DESCOBERTA CRÍTICA — Erro no canal FIC

No dropdown de Canais de Atendimento dos Links de Redirecionamento, o canal FIC exibe:
> "Faculdades Integradas de Cassilândia – FIC – **Número inválido: conexões oficiais precisam ter o número cadastrado na página de conexões**"

**Implicação:** O canal Instagram/FIC (não-WABA) está com configuração incompleta — o número não foi cadastrado corretamente na página de Canais de Atendimento. Não é apenas "desconectado" como pareceu nos batches anteriores. Precisa de ação corretiva.

Canais WABA e Whats Antigo aparecem normalmente no dropdown (sem erros).

---

## Pendências identificadas

- Criar primeiro template de mensagem para canal WABA (ex: template de matrícula FIC)
- Corrigir configuração do canal FIC (Instagram) — cadastrar número na página de Canais de Atendimento
- Criar links de redirecionamento para campanhas da FIC (ex: link de matrícula com distribuição Sequencial ou Por Horário)
