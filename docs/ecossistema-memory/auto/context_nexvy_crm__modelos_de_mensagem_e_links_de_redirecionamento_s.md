---
name: Nexvy CRM — Modelos de Mensagem e Links de Redirecionamento (Sessão 088 Batch 6)
description: Nexvy CRM — Modelos de Mensagem e Links de Redirecionamento (Sessão 088 Batch 6)
type: context
project: ecosystem
tags: ["nexvy", "modelos-mensagem", "whatsapp", "meta", "templates", "links-redirecionamento", "fic", "waba", "sessao088", "crm"]
success_score: 0.92
supabase_id: 35285165-e9b3-40f0-8046-586cda128be7
created_at: 2026-04-13 03:14:25.6145+00
updated_at: 2026-04-13 07:04:24.231495+00
---

Modelos de Mensagem (console.nexvy.tech/message-templates): vinculado ao canal WABA FIC, vazio. Filtros: Categoria (Utilitário/Marketing/Autenticação), Status (9 estados incluindo Rascunho/Pendente/Aprovado/Rejeitado/Desabilitado/Pausado/LimiteExcedido/EmRecurso/AguardandoExclusão), StatusAtivo (Ativo/Inativo).

Formulário Criar Template: Nome (minúsculas+sublinhados), Idioma (PT-BR/EN-US/ES), Categoria (3 cards), Descrição. Conteúdo: Cabeçalho opcional (Texto/Imagem/Vídeo/Documento), Corpo obrigatório 1024 chars com variáveis {{1}} {{2}} (não pode iniciar com variável), Rodapé 60 chars. Botões MUTUAMENTE EXCLUSIVOS: até 3 Resposta Rápida (25 chars) OU até 2 Chamada para Ação (URL Visitar Website + Telefone Ligar). Preview ao vivo. Aprovação Meta 24-48h.

Links de Redirecionamento (console.nexvy.tech/link-redirects): vazio. Campos: Nome, Identificador único (slug), Tipo Distribuição (Sequencial/Aleatória/Ordenada/Por Horário), Texto, Canais de Atendimento.

DESCOBERTA CRÍTICA: Canal FIC (Instagram) exibe erro em Links: "Número inválido: conexões oficiais precisam ter o número cadastrado na página de conexões". Explicação: canal FIC tem configuração incompleta — não é apenas desconectado. Precisa cadastrar número na página Canais de Atendimento. WABA e Whats Antigo aparecem normalmente.
