---
name: Nexvy CRM — Tags, Produtos Comerciais e DS Track (Sessão 088 batch 4)
description: Tags existentes, Produtos Comerciais vazios, e mapeamento completo do módulo DS Track (rastreamento Meta ADS + GTM)
type: project
---

## Tags

- 2 tags existentes: `1700` (1 contato, cor cinza) e `Alunos` (62 contatos, cor rosa)
- Criar tag: Nome + Cor customizável (picker de cor)
- Filtrável por usuário e por data

## Produtos Comerciais

- Vazio (0 produtos cadastrados)
- Formulário: Nome + Valor (R$)
- Serve para vincular nos negócios do pipeline ao criar/editar contato

## DS Track (BETA) — Módulo de Atribuição e Rastreamento

### Visão Geral
- Dashboard de anúncios: Campanhas (R$0, 0 Ativas, 0 Cliques), Visitantes (0), Leads (0), Vendas (R$0, 0% ROAS, 0% Conversão, R$0 CPA)
- Tudo zerado — sem conta de anúncios conectada ainda
- Tipo de venda: filtro "Vendas rastreadas"

### Campanhas
- "Nenhuma conta de anúncios conectada. Conecte uma conta para visualizar as campanhas."
- Colunas visíveis: Plataforma, Conta, Status, Objetivo, Orçamento, Custo, Alcance, Frequência, Impressões
- Filtro Status: Todas / Ativas / Paradas
- Botão Sincronizar disponível

### Visitantes
- Vazio (0-0 de 0)
- Colunas: Visitante, Email, Visitas, Origem, Campanha, Conjunto, Anúncio, Primeira Visita, Última Visita

### Leads (DS Track)
- Vazio (0-0 de 0)
- Colunas: Telefone, Nome, Email, Visitante, Jornada, Visitas, Primeira Visita, Criado em, Última Visita, Primeira Mensagem, Negócio
- NOTA: este "Leads" é diferente do CRM Contatos — é gerado via rastreamento de anúncios

### Mensagens de Campanhas
- 0 registros
- "Adicionar Mensagem de Campanha": texto da mensagem + Condição de Correspondência + criativos
- Condições: "A mensagem é igual" / "A mensagem contém" / "A mensagem começa com" / "A mensagem termina com"
- Uso: rastrear mensagens recebidas e associar a campanhas

### Integração — Meta ADS
- Status: Nenhuma conta conectada
- Botão "Conectar Meta" → abre popup de login do Facebook
- Conta Facebook detectada no browser: Marcelo Luciano (pronta para conectar)

### Integração — Google Tag Manager (Monitoramento de páginas)
- 3 passos de configuração:
  1. Adicionar domínios autorizados (modal: Novo Domínio → Adicionar)
  2. Adicionar conta GTM (ID no formato XXXXXXX + containers)
  3. Instalar tag HTML personalizado no GTM

**Script de rastreamento da conta AF Educacional:**
```html
<script>
    window._dtrack = {
        domains: ["Adicione dominios autorizados"],
        sessionHistory: false
    };
</script>
<script src="https://console.nexvy.tech/track.js?token=cQOLsDYw9KROZvYNvTqvd5E54ELS6WYh4o7TWei8Tls" async></script>
```
- Acionamento no GTM: **DOM pronto**
- Token único por conta: `cQOLsDYw9KROZvYNvTqvd5E54ELS6WYh4o7TWei8Tls`

## Próximos passos para DS Track
1. Conectar conta Meta ADS (Marcelo Luciano já detectado no browser)
2. Configurar GTM: adicionar domínio do site + container GTM + instalar script
3. Após conexão, DS Track começa a populare Visitantes, Leads e Campanhas automaticamente
