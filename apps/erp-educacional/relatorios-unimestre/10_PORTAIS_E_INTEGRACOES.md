# Portais e Integrações — Análise Unimestre

**Tipo:** Funcionalidades transversais (não são módulos)
**Prioridade:** Alta (definem a experiência do usuário)

---

## 1. Visão Geral

Conforme validação da Buchecha (MiniMax M2.7), os portais NÃO são módulos funcionais — são interfaces/views que consomem dados dos módulos reais. Da mesma forma, integrações externas são funcionalidades transversais.

---

## 2. Portal do Aluno

### 2.1 Acesso
**Rota:** `/projetos/portal_online/`, `/portal/online`
**Autenticação:** Código do aluno + tipo de usuário

**Branding:**
- Logo FIC
- Slogan: "AQUI, os seus SONHOS Encontram um lugar de REALIZAÇÃO!"

### 2.2 Navbar
- Logo Unimestre
- Menu hambúrguer
- Logo FIC (centro)
- Foto do aluno (perfil)
- Notificações, Mensagens, Alertas

### 2.3 Dashboard
- Banner informativo "Gestão On-Line"
- Vídeo de apresentação
- Cards: Turmas em andamento, Alunos cursando, Alunos em reserva, Acesso ao Portal
- Gráfico: MATRÍCULAS NOVAS E EVASÕES
- Gráfico: MATRÍCULAS REALIZADAS POR ANO
- Seletor de mês

### 2.4 Menu Lateral do Aluno

| Item | Funcionalidade |
|------|---------------|
| Home | Dashboard inicial |
| Avaliação Institucional | Pesquisa de satisfação |
| Contactos e E-mails | Mensagens |
| Diário de Classe | Consulta de aulas |
| Enquete | Pesquisas |
| Fórum | Discussões |
| Material de Apoio | Materiais educacionais |
| Ocorrências | Registro disciplinar |
| Pedagógico | Assessoria pedagógica |
| Plano de Ensino | Conteúdo programático |
| Produção Acadêmica | Pesquisa e extensão |
| Prova Online | Provas eletrônicas |
| Recados | Mensagens internas |
| Reservas | Reserva de espaços |

### 2.5 Funcionalidades do Aluno

**Planilha de Matrículas:**
- Código, Disciplina, Turma, Ano/Semestre, Grau, Frequência, Curso
- Filtros por Estudante, Turma, Disciplina

**Notas e Frequências:**
- Tabela com MP, SB, MD, F, MF, GF, F%, Situação
- Resultado final por disciplina

**Financeiro:**
- Aviso: "Regularize seus débitos"
- Tabela: Vencimento, Tipo de Título, Situação, Valor
- Desconto Condicional com data limite
- Gerar boleto/pagar

**Upload de Documentos:**
- Modal drag-drop
- Partes: Frente, Verso, 1ª/2ª/3ª Página
- Formatos: JPG, PDF

**Escolha de Disciplinas:**
- Progress bar multi-step
- Checkboxes "Quero me matricular"
- Financeiro integrado (mensalidade + parcelamento)
- Aceite de documento

**Requerimentos:**
- "+ Novo Requerimento"
- Controle de permissão

**Calendário Acadêmico:**
- Calendário visual (mês)
- Eventos do calendário
- Próximas avaliações (7 dias)

---

## 3. Portal do Professor/Coordenador

### 3.1 Acesso
**Rota:** `/gestao/publica/`, `/projetos/portal_online/`
**Tipo:** Secretaria, Professores, Coordenadores

### 3.2 Menu do Coordenador

| Item | Funcionalidade |
|------|---------------|
| Dashboard | Painel de controle |
| Jornada | Gestão de jornadas |
| Capacitação | Formação docente |
| Rematrícula | Processo de rematrícula |
| Configurações | Ajustes do módulo |

### 3.3 Funcionalidades do Professor

**Provas:**
- Inserir avaliação
- Histórico de alteração de notas
- Atribuir todas notas
- Calcular médias
- Atribuir ajuste de média
- Complemento de médias

**Desempenho:**
- Tabela de notas por aluno
- Status colorido (verde/rosa/branco)
- Exportação

**Turmas/Aulas:**
- Disciplinas, turmas, horários

---

## 4. Portal Administrativo

### 4.1 Acesso
**Rota:** `/projetos/portal_online/`
**Tipo:** Administrador (código + tipo)

### 4.2 Funcionalidades Exclusivas
- Lista de Módulos do sistema (57+)
- Parâmetros do sistema
- Lista de Menus (configuração de navegação)
- Registro de Logs/Auditoria

---

## 5. Integrações Externas

### 5.1 Clicksign — Assinatura Digital
- **Uso:** Assinatura de contratos de matrícula e documentos
- **Fluxo:** Sistema gera documento → Clicksign assina → Webhook confirma → Email com PDF
- **Ambientes:** Produção e teste
- **Alternativa disponível:** Autentique (configurável mas não ativa)

### 5.2 Gmail — Notificações
- **Uso:** Confirmação de assinaturas, notificações gerais
- **Formato:** Email com PDF anexado

### 5.3 Google Meet — Videoconferências
- **Uso:** Aulas síncronas, reuniões

### 5.4 Google Classroom — Gerenciamento de Aulas
- **Uso:** Integração com calendário acadêmico

### 5.5 Tecfy — Diploma Digital
- **Uso:** Provedor de diploma digital (identificado via parâmetros do sistema)
- **Parâmetros:** `tecfy_diploma_digital_n_nipo_cert`, `_core`, `_part`

---

## 6. Fluxos de Navegação

### Fluxo do Aluno
```
Login → Dashboard → Planilha de Matrículas → Notas e Frequências
→ Financeiro → Material de Apoio → Cadastro (Upload docs)
→ Escolha de Disciplinas → Financeiro → Aceite → Confirmação
```

### Fluxo do Professor
```
Login → Provas → Desempenho → Notas → Médias → Liberação
```

### Fluxo Administrativo
```
Login → Dashboard → Módulo selecionado → Configuração → Logs
```

---

## 7. Padrões de UI/UX

### Cores
- **Roxo/Purple:** Botões primários, barra superior
- **Verde:** Ações positivas (SALVAR, MATRICULAR)
- **Vermelho:** Ações destrutivas (CANCELAR, DELETAR)
- **Azul/Cyan:** Botões secundários, atalhos
- **Cinza:** Elementos desativados

### Componentes Reutilizáveis
- Tabelas com paginação (10, 25, 50)
- Modais com overlay escuro
- Dropdowns com limpar (X)
- Formulários com validação
- Cards de métricas
- Gráficos de linha com séries
- Breadcrumbs de navegação
- Alertas coloridos (informação, aviso, erro, sucesso)

### Padrões de Dados
- Moeda: R$ X.XXX,XX
- Data: DD/MM/YYYY
- Hora: HH:MM (24h)
- CPF/CNPJ: Com máscara

---

## 8. Relevância para o ERP FIC

**Alta relevância:** Os portais definem a experiência do usuário e devem ser projetados desde o início no nosso ERP. Para o Diploma Digital:
- **Portal do Aluno** precisará de uma seção "Meus Diplomas" para download/verificação
- **Portal do Coordenador** precisará de funcionalidades de emissão e assinatura
- **Clicksign/Tecfy** são referências para escolha das nossas APIs de assinatura

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 1, 2, 3, 5, 6
