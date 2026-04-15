# Sistema Completo — Aluno Digital (Análise Vídeo 2)

**URL:** sistema.alunodigital.com.br/index.aspx
**Cliente registrado:** 0261 - VALE DO APORE (UNIMEST...)
**Usuário:** 22412 - MARCELO LUCIANO PEREIRA DA SILVA BATISTA FALCÃO
**Versão do Diploma:** 1.05

---

## Menu Principal (Sidebar)

### 1. DIPLOMA DIGITAL (submenu expandido)
- Enviar Arquivo JSON do Diploma
- Enviar Diploma para Registro
- Registrar Diploma
- Consultar Diplomas Digitais
- Consultar Currículo Digital do Curso
- Relatório de Diplomas Digitais
- Consultar Históricos Avulsos
- Relatório de Registro de Diplomas
- Baixar Diplomas em Lote

### 2. DEFINIÇÃO DE ACESSOS

### 3. MANUTENÇÕES

### 4. CONFIG DO DIPLOMA DIGITAL (submenu expandido)
- Cadastrar Assinaturas Diploma
- Templates Diploma Digital
- Documentos Obrigatórios
- Fluxo de Assinaturas Histórico Avulso
- Cadastrar Assinaturas do Histórico Avulso
- Fluxo de Assinaturas Currículo Escolar
- Cadastrar Assinaturas do Currículo Escolar
- Configurar E-Mails do Diploma
- Configurações da IES Emissora
- Assinaturas Certificado Pós Graduação
- Configurar Livro de Registro

### 5. ADMINISTRAÇÃO

### 6. SOBRE O CLIENTE

### 7. ABRIR CHAMADO

---

## Detalhamento das Configurações

### Painel do Usuário (Dashboard)
- Barra de progresso com indicadores:
  - **Total de Diplomas: 0**
  - **Total de Diplomas Finalizados: 0**
- Gráfico de linhas mostrando etapas de assinatura:
  - Responsável pela IES Emissora: 0
  - 1º Secretário/Decano da IES Emissora: 0
  - IES Emissora: 0
  - Responsável Pelo Registro: 0

### Relatório Diploma Digital (Filtros de Busca)
- Situação: Ativo (dropdown)
- Fluxo: Todos (dropdown)
- Cód. validação
- Matrícula
- Nome
- RG
- CPF
- Curso
- Tipo de Data: Data de Cadastro no Sistema (dropdown)
- Período: 01/01/2026 até 31/03/2026
- Enviar Arquivo JSON: upload
- Template Ref: Selecione o Modelo do Template (dropdown)
- Versão do Diploma: 1.05 (dropdown)
- Botões: "Enviar Arquivos" | "Consultar"

### Currículo Digital de Cursos
- Filtros: Situação, Fluxo, Cód. validação, Cód. do Currículo, Curso, Cod IES
- Tipo de Data + Período
- Botões: "Incluir Currículo do Curso" | "Consultar"
- Formulário do Currículo (abas):
  - **Currículo Escolar**
  - **IES Emissora**
  - **Variáveis**
  - **Estrutura Curricular** (Código, Nome, Tipo, Carga Horária Hora Aula, Carga Horária Hora Relógio, Fase, Item Ementa, Pré-Requisitos, Equivalências, Etiquetas)
  - **Atividades Complementares**
  - **Critérios de Integralização**
- Botões: Importar Arquivo JSON | Gravar (F10) | Enviar Currículo (F12)

### Fluxo de Assinaturas — Diploma de Graduação
Ordem de assinatura configurada (cadastrada em 18/12/2025):

| Ordem | Fluxo de Assinatura |
|-------|-------------------|
| 1 | 1º Responsável pela IES Emissora |
| 2 | 1º Secretário/Decano da IES Emissora |
| 3 | IES Emissora |
| 4 | Responsável Pelo Registro |
| 5 | IES Registradora |

### Fluxo de Assinaturas — Currículo Escolar
- "Nenhum Usuário Cadastrado" — ainda não configurado

### Templates de Documentos
4 templates cadastrados (todos em 18/12/2025):

| Código | Nome | Tipo de Template |
|--------|------|-----------------|
| 02037 | Diploma de Graduação | Diploma de Graduação |
| 02038 | Certificado de Pós Graduação | Certificado de Pós-Graduação |
| 02039 | Histórico Escolar | Histórico Escolar Digital |
| 02040 | Template Envio de Email do Diploma | Email do Diploma Digital |

### Cadastro de Template (detalhes)
- Carregar arquivo: upload (.docx ou .html)
- Documento enviado: arquivo é criptografado (ex: B44CD876-08CA-46DA-8266-3024828F1BCB.docx.cry)
- Descrição: nome do template
- Folder: 001 - ALUNO DE GRADU...
- Documento: Selecione (dropdown)
- Certificação Digital: CPF ou CNPJ
- Tipo de Template: dropdown (Template do Diploma de Graduação, Template do Email do Diploma Digital, etc.)
- Botões: "Download Template" | "Salvar"

### Configurações da IES
Modal para cadastrar tipos de IES:
- **Tipo** (dropdown com 4 opções):
  - IES Emissora
  - Mantenedora da IES Emissora
  - IES Registradora
  - Mantenedora da IES Registradora
- Campos: E-MEC, CNPJ, Logradouro, Número, Complemento, Bairro, Nome do Município, Código do Município, CEP, UF

### Configurar Livro de Registro
- Livro de Registro
- Nome do Resp. pelo Registro
- CPF do Responsável
- Matrícula do Responsável
- Habilitar Folha (checkbox)
- Sequencial Inicial
- Situação: Aberto / Finalizado
- Dados do Último Registro Inserido (Nr Registro, Nr Página, Nr Processo)

### Sobre o Cliente (Informações Técnicas)
- **Nome do Cliente:** VALE DO APORE (Unimestre)
- **CNPJ do Cliente:** 02.175.672/0001-63
- **Chave do Cliente:** 323343356a4c456d694e513d
- **EndPoint das API's:** https://sistema.alunodigital.com.br/api_105
- **API de Origem:** 200.245.142.170
- **Assinador Diploma:**
  - Baixar Assinador de Diplomas - Homologação Versão 2.0.0.16
  - Baixar Assinador de Diplomas - Produção Versão 2.0.0.16

---

## Arquivos Auxiliares do Sistema

### Template CSV de Disciplinas
Separador: ponto-e-vírgula (`;`)
Colunas:
```
hisCodigoDisciplina; hisDisciplina; hisPeriodo; hisCargaHorariaHoraAula;
hisCargaHorariaHoraRelogio; hisNota; hisNotaAteCem; hisConceito;
hisConceitoEspecificoDoCurso; hisConceitoRM; hisSituacao; hisEtiqueta;
hisFormaIntegralizacao; nomeDocente; titulacaoDocente; cpfDocente; lattesDocente
```

### Template HTML de E-mail
- Bootstrap 5.1.3
- Logo do sistema no topo
- Variáveis de template: `@aluNomeAluno`
- Corpo: Mensagem de parabenização + links de validação
- Links:
  - Validação do diploma (sistema.alunodigital.com.br/Default.aspx)
  - Validação XML no MEC (validadordiplomadigital.mec.gov.br/diploma)

### Template Histórico Escolar (DOCX)
Variáveis de template identificadas:
- `@aluCPF`, `@aluDataNasc`, `@aluNacionalidade`
- `@aluNatNomeMunicipio`, `@aluNatUF_p`
- `@aluRgNumero`, `@aluRgOrgaoExpedidor`, `@aluRgUF`
- `@Filiacao`, `@aluSexo`
- `@curIngData`, `@aluSituacaoAluno`, `@curFormaAcesso`
- `@hisDataEmissao`, `@curTituloConferido`
- `@DisciplinasCursadas`, `@AtividadesComplementares`, `@Estagio`
- `@curCargaHorCurIntegralizada`
- `@aluDataConclusao`, `@dipDataColacaoGrau`
- `@dipDataExpedicaoDiploma`, `@aluPeriodoLetivo`
- `@Enade`
- `@terNome`, `@terCargo`

### Template Certificado Pós-Graduação (DOCX)
Variáveis:
- `@nm_pessoa` (nome do aluno)
- `@CURSO`
- `@area_conhecimento`
- `@materias`
- `@monografia`
- `@local`, `@data`

### Assinador Digital (Executável Windows)
- **AssinadorDiplomaDigitalV216_PROD.exe** — versão de produção
- **AssinadorDiplomaDigitalV216_HOM.exe** — versão de homologação
- Versão: 2.0.0.16
- Aplicativo desktop Windows que conecta ao certificado A3 via hardware token
- Necessário para realizar as assinaturas ICP-Brasil

---

## Insights para o Novo Sistema

### O que o sistema Aluno Digital já faz bem:
1. Fluxo de assinaturas configurável por etapa
2. Templates de documentos reutilizáveis com variáveis
3. Importação JSON e CSV
4. Dashboard com contadores de progresso
5. Download em lote de diplomas
6. Versionamento de XSD (1.05)

### O que vamos melhorar no nosso sistema:
1. **Sem aplicativo desktop** — tudo via web (API de assinatura na nuvem)
2. **Auto-preenchimento** — dados da IES configurados uma vez
3. **UX moderna** — React/Next.js com design limpo
4. **Pipeline visual** — Kanban ou stepper mostrando cada diploma
5. **Integração direta** — API com sistema acadêmico da FIC
6. **Notificações automáticas** — e-mail/WhatsApp pro diplomado
7. **Currículo Digital** como módulo integrado (não separado)
8. **Bulk operations** — processar turmas inteiras
9. **Logs e auditoria** — quem fez o quê, quando
10. **Versão XSD atualizada** — migrar para v1.06 desde o início
