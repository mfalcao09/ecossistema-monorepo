# Módulo de Configurações e Permissões — Análise Unimestre

**Módulo:** Configurações
**Rotas Base:** `/portal/config/*`, `/portal/publico/academico/configuracoes/*`
**Prioridade:** Alta (base para todo o sistema)

---

## 1. Visão Geral

O módulo de configurações controla permissões granulares, grupos de usuários, parâmetros do sistema e estrutura de menus. É a camada de governança que permeia todos os outros módulos.

---

## 2. Submódulos Identificados

### 2.1 Controle de Permissões
**Rota:** `/portal/config/configuracao/controle-permissoes`, `/portal/publico/academico/configuracoes/permissoes`

**Filtros:**
- Tipo de usuário (Administradores da Instituição / Acadêmico)
- Busca de permissão

**Matriz de Permissões:**

| Coluna | Descrição |
|--------|-----------|
| PERMISSÃO | Nome da permissão |
| ACESSAR | Pode visualizar |
| INSERIR | Pode criar |
| ALTERAR | Pode editar |
| REMOVER | Pode excluir |
| ESPECIAL | Permissão especial |
| TODOS | Marcar todos |

**Permissões específicas identificadas:**
- Acesso à lista de cadastro de monografias
- Acesso à lista de Configurações > Backups Realizados
- Acesso à lista de controle de permissão de acesso aos relatórios
- Acesso à lista de matrículas curso - turma

---

### 2.2 Grupos de Usuário
**Rota:** `/portal/config/grupos-usuario`, `/portal/publico/academico/configuracoes/grupos-usuario`

**Grupos identificados:**
- Administradores da Instituição
- Diretoria
- Estudantes
- Ex-Alunos
- Financeiro

**Funcionalidades:**
- Criar novos grupos
- Copiar permissões entre grupos
- Selecionar grupo de origem e destino

---

### 2.3 Copiar Permissões

**Modal "Copiar permissões":**
- Grupo origem: Administradores da Instituição
- Grupo destino (dropdown): Diretoria, Estudantes, Ex-Alunos, Financeiro
- Botão: COPIAR PERMISSÕES (verde)

---

### 2.4 Parâmetros do Sistema

**Tabela de Parâmetros (paginada 100+):**

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `SMS_client` | — | Código da instituição para SMS |
| `SMS_emviador` | modelo.sms.smart.zensva | Classe enviador de SMS |
| `SMS_habilitar_envio` | 0 | SMS habilitado (0=não) |
| `SMS_login` | — | Login para envio de SMS |
| `SMS_proxy` | — | Proxy para SMS |
| `SMS_senha` | — | Senha para SMS |
| `SMS_token` | — | Token para SMS |
| `frt_amazona_jm_log` | 0 | APIs govdata |
| `irt_clarity` | 0 | Clarity habilitado |
| **`tecfy_curricula_digital_classe_jadols`** | — | **Classe para currículo digital** |
| **`tecfy_diploma_digital_n_nipo_cert`** | — | **Classe para diploma digital (cert)** |
| **`tecfy_diploma_digital_n_nipo_core`** | — | **Classe para diploma digital (core)** |
| **`tecfy_diploma_digital_n_nipo_part`** | — | **Classe para diploma digital (part)** |

> **IMPORTANTE:** Os parâmetros `tecfy_diploma_digital_*` indicam que o Unimestre usa a Tecfy como provedor de diploma digital. Isso é uma referência valiosa para entender a integração com terceiros.

---

### 2.5 Lista de Menus
**Funcionalidade:** Configuração da estrutura de navegação

**Campos:**
- Nome do Menu
- Grupo (dropdown)
- URL
- Ordem
- Ativo (boolean)

---

## 3. Roles/Papéis de Usuário Identificados

| Role | Acesso |
|------|--------|
| **Administrador** | Todos os módulos, configurações, parâmetros |
| **Coordenador** | Gestão acadêmica, turmas, disciplinas, provas |
| **Auxiliar** | Suporte ao coordenador |
| **Direção** | Visão institucional |
| **Professor** | Portal acadêmico, provas, notas |
| **Secretaria** | Matrículas, cadastro, documentação |
| **Financeiro** | Módulo financeiro |
| **Aluno** | Portal do aluno (limitado) |
| **Ex-Aluno** | Acesso restrito |

---

## 4. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/portal/config/configuracao/controle-permissoes` | Controle de permissões |
| `/portal/config/grupos-usuario` | Grupos de usuário |
| `/portal/publico/academico/configuracoes/permissoes` | Permissões (alt) |
| `/portal/publico/academico/configuracoes/grupos-usuario` | Grupos (alt) |

---

## 5. Relevância para o ERP FIC

**Alta relevância:** O sistema de permissões e roles é fundamental para o ERP FIC. Para o Diploma Digital especificamente, precisamos de roles como "Responsável pela emissão", "Reitor/Diretor" (assinantes do diploma) e "Registrador" que são específicos do processo de emissão.

Os parâmetros `tecfy_diploma_digital_*` revelam que o Unimestre usa a **Tecfy** como API de diploma digital — informação útil para avaliarmos provedores.

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 1, 2, 5
