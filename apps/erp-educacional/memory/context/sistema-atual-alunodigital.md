# Sistema Atual — Aluno Digital (sistema.alunodigital.com.br)

**URL:** sistema.alunodigital.com.br/index.aspx
**Tipo:** Plataforma SaaS terceirizada para emissão de diploma digital
**Tecnologia:** ASP.NET (WebForms — .aspx)

## Visão Geral

O sistema atual é uma aplicação web de terceiros que a FIC utiliza para preencher dados do diploma digital. É um formulário extenso organizado em **11 abas** (tabs) com preenchimento manual de todos os campos.

## Estrutura de Abas (Navegação Principal)

### 1. DADOS DO DIPLOMADO
Aba principal com dados pessoais do aluno:
- Segunda Via do Diploma (Não/Sim)
- **RA do aluno** *
- **Nome do aluno** *
- **CPF do aluno** *
- **Código do curso E-MEC** *
- Nome social
- Telefone
- E-mail do aluno
- **Data de Nascimento** *
- **Sexo** * (dropdown)
- **Nacionalidade do Aluno** * (Brasileiro/Estrangeiro)
- Código do Município / Nome do Município
- **Naturalidade (UF)** * (dropdown)
- **Nacionalidade** *
- **Dados Acadêmicos:**
  - **Situação do aluno** * (ex: "Formado")
  - **Período letivo** *
- **Filiação do Diplomado** (mínimo uma ocorrência):
  - Nome, Nome Social, Sexo — tabela com botão "+ Adicionar Filiação"
- **Dados Complementares do Diploma** (Opcional):
  - Unidade Acadêmica, Apostila, Template do Histórico, Template do Diploma

### 2. DADOS DO CURSO
- **Selecionar Curso Cadastrado** (dropdown)
- Grau Conferido (dropdown)
- Título Conferido (dropdown)
- Outro Título Conferido
- Data de Conclusão do Curso
- **Nome** *
- Código do curso E-MEC
- Modalidade (dropdown)
- **Processo de Registro E-MEC:**
  - Número do Processo, Tipo do Processo, Data do Processo, Data do Protocolo
- **Endereço do Curso:**
  - Logradouro, Número, Complemento, Bairro, Código Município, UF
- **Autorização do Curso:**
  - Tipo, Número, Data, Veículo de Publicação, Número DOU, Data Publicação, Seção, Página
  - Processo de Registro de Autorização
- **Reconhecimento do Curso:**
  - Tipo, Número, Data, Veículo de Publicação, Número DOU, Data Publicação, Seção, Página
  - Processo de Registro de Reconhecimento
- **Renovação do Reconhecimento** (Opcional)
- **Carga Horária:**
  - Carga Horária do Curso, em Horas Relógio, Integralizada, Integralizada Relógio
- **Informações Adicionais ao Processo de Registro**
- **Dados do Histórico da Graduação:**
  - Código do Currículo, Data de Emissão, Data Realização Vestibular, Informações Adicionais
  - Nome Para as Áreas
- **Ênfase**

### 3. DECISÃO JUDICIAL
(Não visualizada no vídeo — provavelmente para casos de emissão via decisão judicial)

### 4. INSTITUIÇÃO EMISSORA
- Dados da IES emissora (FIC):
  - Nome, Código MEC, CNPJ, CEP, Logradouro, Número, etc.
  - Bairro, Município, Código Município, UF, Município Estrangeiro
- **Termo de Responsabilidade:**
  - Nome, CPF, Cargo, Ato de designação (upload de arquivo)
- **Dados da IES Original (PTA)** (Opcional):
  - Para casos de Programa de Transferência Assistida
  - Nome, Código, CNPJ, endereço completo, Tipo de Descredenciamento
- **Credenciamento da IES Emissora:**
  - Tipo, Número, Data, Veículo de Publicação, DOU, Data Publicação, Seção, Página
  - Processo de Registro de Credenciamento
- **Recredenciamento** (Opcional)
- **Renovação do Recredenciamento** (Opcional)

### 5. INSTITUIÇÃO REGISTRADORA
- **Selecionar Registradora** (dropdown)
- Nome, **Código MEC** *, **CNPJ** *
- **Endereço completo** (CEP, Logradouro, Número, Bairro, Município, UF) — todos obrigatórios
- Município estrangeiro da registradora
- **Credenciamento da Registradora:**
  - Tipo, Número, Data, Veículo Publicação, DOU, etc.
- **Recredenciamento da Registradora** (Opcional)
- **Renovação do Recredenciamento** (Opcional)
- **Mantenedora:**
  - Razão Social, CNPJ, CEP (todos obrigatórios)

### 6. LIVRO DE REGISTRO
(Não visualizada em detalhe no vídeo)

### 7. DISCIPLINAS
- Tabela com colunas: Código, Disciplina, Situação, Período, Carga Horária, Carga Horária (Hora Relógio), Conceito, Nota, Nota até 100, Conceito RM, Forma Integralizada, Conceito Específico, Etiqueta, Nome Docente, Titulação Docente, CPF Docente, Lattes Docente
- Botões: "Limpar Disciplinas", "Baixar Template CSV", "Importar CSV", "+ Adicionar Disciplina"
- **Modal "Adicionar Nova Disciplina":**
  - Campos de disciplina + seção de Docentes (Nome, Titulação, CPF, Lattes)
  - Botão "+ Adicionar Docente"

### 8. ATIVIDADES COMPLEMENTARES
- **Obrigatório se fizer parte da carga horária integralizada**
- Código, Data Início, Data Fim, Data Registro
- Tipo Atividade Complementar, Carga Horária em Relógio, Etiqueta, Descrição
- Seção Docentes (Nome, Titulação, CPF, Lattes) + "+ Adicionar Docentes"
- Tabela de Atividades Cadastradas

### 9. ESTÁGIO
- **Opcional, porém obrigatório se no curso houver estágio obrigatório**
- Código da Unidade Curricular, Data Início, Data Fim, Etiqueta
- Concedente CNPJ, Concedente Razão Social, Concedente Nome Fantasia
- Carga Horária em Relógio, Descrição
- Seção Docentes

### 10. ASSINANTES
- **Assinantes do Diploma** (Opcional):
  - CPF, **Cargo** (dropdown com opções: Reitor, Reitor em Exercício, Responsável Pelo Registro, Coordenador De Curso, Subcoordenador De Curso, Coordenador de Curso em Exercício, Chefe da Área de Registro de Diplomas, Chefe em Exercício da Área de Registro de Diplomas)
  - Outro cargo não presente na lista
  - Tabela: CPF, Cargo, Outro Cargo
- **Assinantes do Registro:**
  - Mesma estrutura dos Assinantes do Diploma

### 11. ENADE
- **Dados do ENADE** (mínimo uma ocorrência):
  - Situação Enade (dropdown)
  - Condição no Enade (dropdown)
  - Condição no Enade para Não Habilitados (dropdown)
  - Situação no Enade substituta
  - Ano da edição do Enade
  - Tabela: Ano de Edição, Situação, Condição, Condição Não Habilitado

### 12. HABILITAÇÕES E ÁREAS
- **Habilitações:**
  - Nome da Habilitação, Data da Habilitação
  - Botão "+ Adicionar Habilitação"
- **Áreas do Curso:**
  - Código, Nome
  - Botão "+ Adicionar Área"

## Botões de Ação Globais (sempre visíveis no topo)
1. **IMPORTAR ARQUIVO JSON** (verde/outline) — importa dados de um arquivo JSON
2. **GRAVAR (F10)** (verde) — salva os dados preenchidos
3. **ENVIAR DIPLOMA (F12)** (amarelo/laranja) — envia o diploma para processamento

## Análise UX do Sistema Atual

### Pontos Fortes
- Organização em abas facilita a navegação
- Campos obrigatórios claramente marcados com asterisco vermelho
- Importação via JSON e CSV disponíveis
- Dropdown de cargos dos assinantes já padronizado
- Validação de campos obrigatórios (mensagem de erro)

### Pontos Fracos / Oportunidades de Melhoria
- **Preenchimento 100% manual** — sem integração com sistema acadêmico
- **UX datada** — interface ASP.NET WebForms, sem design moderno
- **Sem dashboard** — não há visão geral do status dos diplomas
- **Sem pipeline** — não mostra em qual etapa cada diploma está
- **Sem batch processing** — parece ser 1 diploma por vez
- **Sem auto-preenchimento** — dados da IES poderiam ser pré-configurados
- **Muitas abas** — poderiam ser agrupadas em seções mais lógicas
- **Sem integração** — tudo é manual, sem API com sistema acadêmico
- **Sem histórico de ações** — não mostra log de quem fez o quê
- **Sem templates reutilizáveis** — dados da IES preenchidos toda vez

## Campos que Precisam ser Mapeados no Novo Sistema

O novo sistema deve capturar TODOS estes dados, pois são exigidos pelo XSD do MEC.
A grande diferença é que muitos deles podem ser:
- **Pré-configurados** (dados da IES, registradora, mantenedora, credenciamento)
- **Importados automaticamente** do sistema acadêmico (dados do aluno, disciplinas, notas)
- **Calculados automaticamente** (cargas horárias, códigos)

## Insights para o Novo Sistema
1. Dados da IES Emissora, Registradora, e Mantenedora são FIXOS → configurar uma vez só
2. Dados de Credenciamento/Reconhecimento do curso são FIXOS por curso → configurar por curso
3. Disciplinas e notas devem vir do sistema acadêmico (import CSV ou API)
4. Assinantes devem ser configuráveis por perfil (Reitor, Coordenador, etc.)
5. O fluxo deve ser: dados do aluno → dados automáticos preenchem → revisar → gerar XML → assinar → publicar
