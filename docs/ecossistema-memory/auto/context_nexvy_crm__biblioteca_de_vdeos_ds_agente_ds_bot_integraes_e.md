---
name: Nexvy CRM — Biblioteca de Vídeos, DS Agente, DS Bot, Integrações e Filas (Sessão 088 Batch 7)
description: Nexvy CRM — Biblioteca de Vídeos, DS Agente, DS Bot, Integrações e Filas (Sessão 088 Batch 7)
type: context
project: ecosystem
tags: ["nexvy", "ds-agente", "ds-bot", "integracoes", "filas", "n8n", "automacoes", "openai", "crm", "sessao088", "af-educacional"]
success_score: 0.93
supabase_id: f1dda5c5-f8c4-482f-92ee-60c2fd288ee0
created_at: 2026-04-13 03:19:50.914647+00
updated_at: 2026-04-13 07:04:25.123691+00
---

Batch 7 do mapeamento do CRM Nexvy (console.nexvy.tech). Módulos documentados:

BIBLIOTECA DE VÍDEOS (/explanatory-videos-feed): Biblioteca de tutoriais, estado vazio (0 Total, 0 Visualizados, 0 Seções), busca por título/descrição/rota, abas Todos/Visualizados/Não Visualizados.

DS AGENTE (/ds-agente): Módulo de agente IA baseado em OpenAI. Estado vazio. Modal de criação: Nome, Provedor (OpenAI Padrão), API Key, ID do Assistente, Modelo, Instruções (system prompt), Base de Conhecimento (RAG via + Adicionar). Parâmetros: Temperatura=1, Máx Tokens=100, Máx Histórico=10, Delay=0s. Toggles: dividir respostas, processar imagens, desabilitar fora da plataforma. Regras de Ativação com lógica condicional (E/OU, por TAG, etc.).

DS BOT (/ds-bot): Plano Unlimited confirmado. 1 bot existente "Meu DS Bot". Opções de criação: do zero, a partir de modelo, importar arquivo. Editor visual com abas Fluxo/Tema/Configurações/Compartilhar. Canvas com nó Início. Componentes: Bubbles (Texto/Imagem/Vídeo/Incorporar/Áudio) + Inputs (Texto/Número/Email/Website/Data/Time/Telefone/Botão/Seleção de Imagem/Pagamento/Avaliação/Arquivo).

INTEGRAÇÕES (/queue-integration) — DESCOBERTA CRÍTICA: 1 integração já configurada: N8N, ID 2967, Nome "N8N – AF EDUCACIONAL", status ativo. Tipos disponíveis no modal: DialogFlow, N8N, WebHooks, DS Bot.

FILAS (/queues): Lista vazia. Modal Adicionar Fila com 2 abas: DADOS (Nome, Cor #22194D, Distribuição: Aleatória/Sequencial/Ordenada/Não distribuir/Fila de Espera, Integração: aparece "N8N – AF EDUCACIONAL", DS Agente: Nenhum, Mensagem saudação com variáveis {{primeiroNome}}/{{nomeCompleto}}/{{saudacao}}/{{hora}}, Opções numeradas) + USUÁRIOS.

Pendências: criar DS Agente FIC (FAQ/matrícula), DS Bot fluxo captação, fila vinculando n8n, testar workflow n8n ID 2967.
