# Módulo Administrativo — Análise Unimestre

**Módulo:** Administrativo / Sistema
**Rotas Base:** `/projetos/portal_online/`
**Prioridade:** Média

---

## 1. Visão Geral

O módulo administrativo agrupa funcionalidades de suporte: logs de auditoria, notícias, ocorrências, arquivos, avaliação institucional e outras funcionalidades secundárias. Conforme identificado pela Buchecha, este módulo funciona como "container organizacional" para itens que não se encaixam nos módulos core.

---

## 2. Submódulos Identificados

### 2.1 Lista de Módulos do Sistema
**Rota:** `/projetos/portal_online/`

**Tabela de Módulos (57+):**

| Código | Nome | Chave |
|--------|------|-------|
| 57 | Acadêmicos | Academico |
| 91 | Acervo Acadêmico Digital | Acervo |
| 64 | Administração | UMAdministracao |
| 79 | Agenda Virtual | AgendaVirtual |
| 73 | Agendamento de Horários | Agendamento |
| 85 | Alimentação | Alimentacao |
| 81 | Aplicativo Móvel | AplicativoMovel |
| 49 | Atualiza | Atualiza |
| 11 | Avaliações Institucionais | Avaliacoes |
| 16 | Biblioteca | UMBiblioteca |
| 19 | Biblioteca Online | UMBibliotecaOnline |
| 80 | Calendário Acadêmico | CalendarioAcademico |
| 78 | Cantina | Cantina |
| 89 | Captação de Alunos | CaptacaoAlunos |
| 75 | Compras | Compras |
| 68 | Contratos dos convênios | ConvConv |
| 1 | Controle de Acesso | ControleAcesso |
| — | Controle de Bolsa | Bolsa |

> **Nota:** O Unimestre possui 57+ módulos registrados, muitos mais do que os visíveis na interface.

---

### 2.2 Administração Geral
- Gerenciamento geral do sistema
- Acesso a todos os módulos
- Configuração de permissões

### 2.3 Arquivos (AVA)
- Sistema de gerenciamento de arquivos
- Upload e organização de documentos acadêmicos

### 2.4 Avaliação Institucional
- Sistemas de avaliação institucional
- Feedback e pesquisas

### 2.5 Calendário Acadêmico
- Datas importantes
- Períodos letivos
- Prazos administrativos
- Visualização em calendário (mês, com eventos)

### 2.6 Contatos e E-mails
- Sistema de comunicação integrado
- Gestão de contatos
- Templates de e-mail

### 2.7 Disponibilidade de Horários
- Alocação de salas
- Gestão de turnos

### 2.8 Inscrição e Seleção
- Processo de inscrição de alunos
- Critérios de seleção

### 2.9 Matrícula Extracurricular
- Atividades complementares
- Cursos extras

### 2.10 Notícias
- Sistema de informações
- Comunicados gerais

### 2.11 Ocorrências
- Registro de incidentes
- Disciplina acadêmica

### 2.12 Pedagógico
- Aspectos pedagógicos gerais

### 2.13 Plano de Ensino
- Estrutura de disciplinas
- Conteúdo programático

### 2.14 Produção Acadêmica
- Registro de pesquisa
- Produção científica

### 2.15 Reservas
- Sistema de reserva de espaços ou recursos

### 2.16 Recados
- Sistema de mensagens internas

### 2.17 Fórum
- Discussões entre alunos e professores

### 2.18 Material de Apoio
- Recursos educacionais e materiais complementares

---

## 3. Registro de Logs / Auditoria
**Rota:** `/admin/logs` ou similar

**Componentes:**
- Filtro por "Registro de acessos: Logs Antigos"
- Seção "Provas" (colapsável)

**Tabela de logs:**
- Data (timestamp — ex: "11/12/2025 11:43:42")
- Nome (usuário — ex: "Administrador")
- Tipo de Log (ícone indicador)
- Log (descrição detalhada da ação)

**Exemplo de entrada:**
```
Data: 11/12/2025 11:43:42
Nome: Administrador
Tipo: Escala de UNIMESTRE
Log: Nº. Prova 1, Data 2025-15, Fees 2, Assunto Semanal...
```

---

## 4. Gerenciamento de Menus
**Rota:** `/admin` (seção de configuração)

**Filtros:**
- Nome do Menu
- Grupo (dropdown)

**Tabela de Menus:**
- URL, Ordem, Ativo (boolean), Ações (editar, deletar)

**Seções de menus:**
- Integrações (Webdata, Educação)
- Análises (financeiras, gerenciais)
- Processos administrativos
- Professores, Alunos, Administradores

---

## 5. Relevância para o ERP FIC

**Baixa relevância direta para Diploma Digital**, mas alta relevância para o ERP completo. O sistema de logs/auditoria é especialmente importante para rastreabilidade do processo de emissão de diplomas.

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 5, 6
