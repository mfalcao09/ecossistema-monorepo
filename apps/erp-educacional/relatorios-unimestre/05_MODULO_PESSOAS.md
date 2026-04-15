# Módulo de Pessoas — Análise Unimestre

**Módulo:** Pessoas (Alunos, Professores, Colaboradores)
**Rotas Base:** `/portal/academico/pessoas`, `/portal/publico/academico/alunos/*`, `/portal/publico/academico/professor`
**Prioridade:** Alta

---

## 1. Visão Geral

O módulo de Pessoas centraliza o cadastro de todas as entidades humanas do sistema: alunos, professores, coordenadores, funcionários e orientadores. É um módulo transversal consumido por praticamente todos os outros módulos.

---

## 2. Submódulos Identificados

### 2.1 Pessoas (Gestão Geral)
**Rota:** `/portal/academico/pessoas`

**Funcionalidades:**
- Habitar alteração de código de pessoa
- Habitar unificação de código de pessoa
- Habilitar nome social
- CPF/CNPJ
- Escolha de gênero/sexo

**Busca avançada:**
- Filtros por tipo de pessoa
- Edição em linha

---

### 2.2 Cadastro Básico (Aluno)
**Rota:** `/portal/publico/academico/alunos/cadastro`

**Alerta:** "Crie novos cadastros ou busque por um ou mais registros já existentes..."

**Componentes:**
- Avatar/foto do aluno (círculo azul padrão)
- Campo "BUSCAR PESSOA"
- 4 ícones de ação no topo

**Abas de navegação:**
- Dados Pessoais
- Endereço
- Telefones
- Grupos de Usuários

**Seções do formulário:**
1. **Complementares** — Apoitado, Arquivo documento, Necessidades especiais
2. **Trabalho**
3. **Concursos**
4. **Grupos**
5. **Campos adicionais**

**Atalhos:** MATRÍCULAS, MATRICULAR (+)

**Visão da Ficha do Aluno:**
- Nome completo, Matrícula
- Menu: Ingresso no curso, Processo Seletivo, Matrícula e conclusão, Certificado/Diploma, Decisão Judicial

---

### 2.3 Professores
**Rota:** `/portal/publico/academico/professor`, `/gestao/publica/academico/professor`

**Funcionalidades:**
- Busca de professores por nome
- Visualização de disciplinas lecionadas
- Filtros por semestre e ano

**Seções:**
1. **DADOS PESSOAIS** — Modificação de código, unificação, necessidades especiais
2. **GRUPOS DE PROFESSORES** — Tabs complementares
3. **Formulário:** Apelido, Arquivo documento, Necessidades especiais (dropdown), Observações

---

### 2.4 Modal Buscar Pessoa

**Tabs:** PESSOAS | PROFESSORES | ESTUDANTES | FUNCIONÁRIOS | ORIENTADORES

**Campos:**
- Nome (campo texto)
- Turno (campo texto)

**Botões:** Buscar, Limpar
**Status:** "Aguarde carregando..." (spinner)

---

## 3. Campos Cadastrais Comuns

### Dados Pessoais
- Nome completo
- CPF / CNPJ
- Data de nascimento
- Gênero (Masculino / Feminino)
- Estado civil
- Raça/Etnia
- Religião
- Nome social (opcional)

### Contato
- Telefone (residencial, comercial, celular)
- Email (pessoal, institucional)
- Endereço completo (logradouro, número, complemento, bairro, cidade, estado, CEP)

### Documentação
- Documento de identidade
- Título de eleitor
- Certificado de reservista
- Carteira de vacinação

### Upload de Documentos (Portal do Aluno)
- Partes: Frente, Verso, Primeira Página, Segunda Página, Terceira Página
- Drag-drop para envio
- Restrições: JPG, PDF
- Tipos: CPF/Pessoa Física, Comprovante de Residência

---

## 4. Entidades

### Aluno
- Código único (ex: 100062, 100917)
- Nome completo, CPF, E-mail
- Histórico acadêmico
- Status de matrícula
- Matrícula (ex: 18029)

### Professor
- Código de pessoa (ex: 100062)
- Nome completo, E-mail
- Disciplinas ministradas
- Turmas vinculadas
- Dados pessoais (necessidades especiais, etc.)

---

## 5. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/portal/academico/pessoas` | Gestão geral de pessoas |
| `/portal/academico/cadastro-basico` | Cadastro básico |
| `/portal/publico/academico/alunos/cadastro` | Cadastro de aluno |
| `/portal/publico/academico/professor` | Gestão de professores |
| `/gestao/publica/academico/professor` | Professores (gestão) |

---

## 6. Relevância para o ERP FIC

**Alta relevância para Diploma Digital:** Os dados pessoais do aluno (nome, CPF, data de nascimento, naturalidade) são campos obrigatórios nos XMLs do Diploma Digital. Os dados do responsável pela emissão e do reitor/diretor também vêm deste módulo.

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 1, 2, 5, 6
