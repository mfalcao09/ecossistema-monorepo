# Stack Tecnológica + Modelagem do Banco de Dados

**Projeto:** Diploma Digital FIC
**Data:** 19/03/2026
**Elaboração:** Claude (Opus) + MiniMax M2.5

---

## 1. Stack Tecnológica Definida

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS | Framework React mais popular, SSR nativo, deploy fácil na Vercel |
| **Backend** | Next.js API Routes + Supabase Edge Functions | Sem necessidade de servidor separado, tudo integrado |
| **Banco de Dados** | PostgreSQL via Supabase | Gratuito no plano Free, RLS nativo, real-time |
| **Autenticação** | Supabase Auth | Login seguro para admin e diplomados |
| **Geração XML** | `xmlbuilder2` (Node.js) | Biblioteca robusta para gerar XML com validação |
| **Validação XSD** | `libxmljs2` ou `xsd-schema-validator` | Validar XMLs contra schemas do MEC |
| **Geração PDF (RVDD)** | `@react-pdf/renderer` + `puppeteer` (server-side) | Layout personalizado + geração em lote |
| **Assinatura Digital** | API de terceiros (BRy, Certisign ou Soluti) | XAdES com ICP-Brasil A3 — contratação própria |
| **Armazenamento** | Supabase Storage | PDFs e XMLs dos diplomas |
| **Hospedagem** | Vercel (frontend) + Supabase (backend/DB) | Deploy automático via Git, escalável |
| **QR Code** | `qrcode` (npm) | Geração de QR Code para a RVDD |
| **E-mail** | Resend ou Supabase + SMTP | Notificação ao diplomado |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│              Next.js 14 + TypeScript + Tailwind              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Dashboard │  │ Diplomas │  │  Config  │  │  Portal  │    │
│  │   Admin   │  │ Pipeline │  │   IES    │  │ Diplomado│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ API Routes
┌─────────────────────────┴───────────────────────────────────┐
│                        BACKEND                               │
│              Next.js API Routes + Supabase                   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Motor   │  │ Gerador  │  │  Módulo  │  │  Repo    │    │
│  │   XML    │  │   PDF    │  │ Assinat. │  │ Público  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     INFRAESTRUTURA                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Supabase    │  │  Supabase    │  │  API Externa │      │
│  │  PostgreSQL  │  │  Storage     │  │  Assinatura  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Modelagem do Banco de Dados

### 3.1 Enums (Tipos)

```sql
-- Tipos de instituição
CREATE TYPE tipo_instituicao AS ENUM (
  'emissora', 'registradora',
  'mantenedora_emissora', 'mantenedora_registradora'
);

-- Graus acadêmicos
CREATE TYPE grau_academico AS ENUM (
  'bacharel', 'licenciado', 'tecnologo',
  'especialista', 'mestre', 'doutor'
);

-- Modalidade do curso
CREATE TYPE modalidade_curso AS ENUM ('presencial', 'ead', 'hibrido');

-- Status do diploma no pipeline
CREATE TYPE status_diploma AS ENUM (
  'rascunho',      -- dados sendo preenchidos
  'preenchido',    -- todos os dados OK, pronto pra gerar XML
  'xml_gerado',    -- XML gerado e validado contra XSD
  'em_assinatura', -- no fluxo de assinaturas
  'assinado',      -- todas as assinaturas feitas
  'registrado',    -- registrado no livro de registro
  'publicado'      -- disponível no repositório público
);

-- Status de cada assinatura individual
CREATE TYPE status_assinatura AS ENUM ('pendente', 'assinado', 'rejeitado');

-- Sexo
CREATE TYPE sexo_tipo AS ENUM ('M', 'F');

-- Situação da disciplina
CREATE TYPE situacao_disciplina AS ENUM (
  'aprovado', 'reprovado', 'trancado',
  'cursando', 'aproveitado', 'dispensado'
);

-- Cargo do assinante
CREATE TYPE cargo_assinante AS ENUM (
  'reitor', 'reitor_exercicio',
  'responsavel_registro',
  'coordenador_curso', 'subcoordenador_curso',
  'coordenador_exercicio',
  'chefe_registro', 'chefe_registro_exercicio',
  'secretario_decano'
);
```

### 3.2 Tabelas Principais

```sql
-- ============================================
-- INSTITUIÇÕES (IES Emissora, Registradora, Mantenedoras)
-- ============================================
CREATE TABLE instituicoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        tipo_instituicao NOT NULL,
  nome        VARCHAR(255) NOT NULL,
  cnpj        VARCHAR(18) UNIQUE NOT NULL,
  codigo_mec  VARCHAR(20),
  -- Endereço
  logradouro  VARCHAR(255),
  numero      VARCHAR(20),
  complemento VARCHAR(100),
  bairro      VARCHAR(100),
  municipio   VARCHAR(100),
  codigo_municipio VARCHAR(10),
  uf          CHAR(2),
  cep         VARCHAR(10),
  -- Credenciamento
  tipo_credenciamento     VARCHAR(100),
  numero_credenciamento   VARCHAR(50),
  data_credenciamento     DATE,
  veiculo_publicacao      VARCHAR(100),
  numero_dou              VARCHAR(50),
  data_publicacao_dou     DATE,
  secao_dou               VARCHAR(20),
  pagina_dou              VARCHAR(20),
  -- Controle
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CURSOS
-- ============================================
CREATE TABLE cursos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id    UUID NOT NULL REFERENCES instituicoes(id),
  nome              VARCHAR(255) NOT NULL,
  codigo_emec       VARCHAR(20),
  grau              grau_academico NOT NULL,
  titulo_conferido  VARCHAR(255),
  modalidade        modalidade_curso NOT NULL,
  -- Carga horária
  carga_horaria_total          INTEGER,
  carga_horaria_hora_relogio   INTEGER,
  carga_horaria_integralizada  INTEGER,
  -- Processo de registro E-MEC
  numero_processo_emec   VARCHAR(50),
  tipo_processo_emec     VARCHAR(50),
  data_processo_emec     DATE,
  -- Reconhecimento
  tipo_reconhecimento       VARCHAR(100),
  numero_reconhecimento     VARCHAR(50),
  data_reconhecimento       DATE,
  -- Autorização
  tipo_autorizacao          VARCHAR(100),
  numero_autorizacao        VARCHAR(50),
  data_autorizacao          DATE,
  -- Endereço do curso (pode diferir da IES)
  logradouro  VARCHAR(255),
  numero      VARCHAR(20),
  bairro      VARCHAR(100),
  municipio   VARCHAR(100),
  codigo_municipio VARCHAR(10),
  uf          CHAR(2),
  cep         VARCHAR(10),
  -- Controle
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DIPLOMADOS (Alunos)
-- ============================================
CREATE TABLE diplomados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             VARCHAR(255) NOT NULL,
  nome_social      VARCHAR(255),
  cpf              VARCHAR(14) UNIQUE NOT NULL,
  ra               VARCHAR(30),
  email            VARCHAR(255),
  telefone         VARCHAR(20),
  data_nascimento  DATE NOT NULL,
  sexo             sexo_tipo,
  -- Naturalidade
  nacionalidade        VARCHAR(100) DEFAULT 'Brasileira',
  naturalidade_municipio VARCHAR(100),
  naturalidade_uf      CHAR(2),
  -- RG
  rg_numero            VARCHAR(30),
  rg_orgao_expedidor   VARCHAR(30),
  rg_uf                CHAR(2),
  -- Controle
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FILIAÇÃO DO DIPLOMADO
-- ============================================
CREATE TABLE filiacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diplomado_id  UUID NOT NULL REFERENCES diplomados(id) ON DELETE CASCADE,
  nome          VARCHAR(255) NOT NULL,
  nome_social   VARCHAR(255),
  sexo          sexo_tipo,
  ordem         INTEGER DEFAULT 1
);

-- ============================================
-- DIPLOMAS (Entidade central — Pipeline)
-- ============================================
CREATE TABLE diplomas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id            UUID NOT NULL REFERENCES cursos(id),
  diplomado_id        UUID NOT NULL REFERENCES diplomados(id),
  -- Status do pipeline
  status              status_diploma DEFAULT 'rascunho',
  segunda_via         BOOLEAN DEFAULT FALSE,
  -- Datas acadêmicas
  data_conclusao      DATE,
  data_colacao_grau   DATE,
  data_expedicao      DATE,
  periodo_letivo      VARCHAR(20),
  situacao_aluno      VARCHAR(50) DEFAULT 'Formado',
  forma_acesso        VARCHAR(100),
  data_ingresso       DATE,
  -- Código de validação e QR
  codigo_validacao    VARCHAR(64) UNIQUE,
  qrcode_url          TEXT,
  xml_url             TEXT,
  pdf_url             TEXT,
  -- Livro de registro
  livro_registro_id   UUID,
  numero_registro     VARCHAR(30),
  pagina_registro     INTEGER,
  processo_registro   VARCHAR(50),
  data_registro       DATE,
  -- Histórico
  codigo_curriculo    VARCHAR(50),
  data_emissao_historico DATE,
  data_vestibular     DATE,
  informacoes_adicionais TEXT,
  -- Controle
  versao_xsd          VARCHAR(10) DEFAULT '1.06',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCIPLINAS DO DIPLOMA (Histórico Escolar)
-- ============================================
CREATE TABLE diploma_disciplinas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  codigo          VARCHAR(30) NOT NULL,
  nome            VARCHAR(255) NOT NULL,
  periodo         VARCHAR(30),
  situacao        situacao_disciplina NOT NULL,
  -- Carga horária
  carga_horaria_aula      INTEGER,
  carga_horaria_relogio   INTEGER,
  -- Notas e conceitos
  nota                    DECIMAL(5,2),
  nota_ate_cem            DECIMAL(5,2),
  conceito                VARCHAR(10),
  conceito_rm             VARCHAR(10),
  conceito_especifico     VARCHAR(50),
  forma_integralizacao    VARCHAR(50),
  etiqueta                VARCHAR(100),
  -- Docente
  docente_nome            VARCHAR(255),
  docente_titulacao       VARCHAR(50),
  docente_cpf             VARCHAR(14),
  docente_lattes          VARCHAR(255),
  -- Ordem
  ordem           INTEGER DEFAULT 0
);

-- ============================================
-- ATIVIDADES COMPLEMENTARES
-- ============================================
CREATE TABLE diploma_atividades_complementares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  codigo          VARCHAR(30),
  tipo            VARCHAR(100),
  carga_horaria_relogio INTEGER,
  data_inicio     DATE,
  data_fim        DATE,
  data_registro   DATE,
  etiqueta        VARCHAR(100),
  descricao       TEXT,
  -- Docente
  docente_nome        VARCHAR(255),
  docente_titulacao   VARCHAR(50),
  docente_cpf         VARCHAR(14),
  docente_lattes      VARCHAR(255)
);

-- ============================================
-- ESTÁGIOS
-- ============================================
CREATE TABLE diploma_estagios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id          UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  codigo_unidade_curricular VARCHAR(30),
  data_inicio         DATE,
  data_fim            DATE,
  etiqueta            VARCHAR(100),
  concedente_cnpj     VARCHAR(18),
  concedente_razao_social   VARCHAR(255),
  concedente_nome_fantasia  VARCHAR(255),
  carga_horaria_relogio     INTEGER,
  descricao           TEXT,
  -- Docente
  docente_nome        VARCHAR(255),
  docente_titulacao   VARCHAR(50),
  docente_cpf         VARCHAR(14),
  docente_lattes      VARCHAR(255)
);

-- ============================================
-- ASSINANTES
-- ============================================
CREATE TABLE assinantes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id  UUID NOT NULL REFERENCES instituicoes(id),
  cpf             VARCHAR(14) NOT NULL,
  nome            VARCHAR(255) NOT NULL,
  cargo           cargo_assinante NOT NULL,
  outro_cargo     VARCHAR(100),
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FLUXO DE ASSINATURAS (Pipeline por diploma)
-- ============================================
CREATE TABLE fluxo_assinaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  assinante_id    UUID NOT NULL REFERENCES assinantes(id),
  ordem           INTEGER NOT NULL,
  status          status_assinatura DEFAULT 'pendente',
  data_assinatura TIMESTAMPTZ,
  tipo_certificado VARCHAR(10),   -- 'A3', 'A4', etc.
  hash_assinatura  VARCHAR(128),  -- hash do documento assinado
  CONSTRAINT uk_fluxo_diploma_ordem UNIQUE (diploma_id, ordem)
);

-- ============================================
-- ENADE
-- ============================================
CREATE TABLE diploma_enade (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  situacao        VARCHAR(50) NOT NULL,
  condicao        VARCHAR(50),
  condicao_nao_habilitado VARCHAR(50),
  situacao_substituta     VARCHAR(50),
  ano_edicao      INTEGER NOT NULL
);

-- ============================================
-- HABILITAÇÕES
-- ============================================
CREATE TABLE diploma_habilitacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  nome            VARCHAR(255) NOT NULL,
  data_habilitacao DATE
);

-- ============================================
-- ÁREAS DO CURSO
-- ============================================
CREATE TABLE curso_areas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id  UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  codigo    VARCHAR(20) NOT NULL,
  nome      VARCHAR(255) NOT NULL
);

-- ============================================
-- TEMPLATES DE DOCUMENTOS
-- ============================================
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(100) NOT NULL,
  tipo            VARCHAR(50) NOT NULL, -- 'diploma_graduacao', 'historico', 'certificado_pos', 'email'
  arquivo_url     TEXT,
  variaveis       JSONB DEFAULT '{}',
  versao          INTEGER DEFAULT 1,
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LOG DE AÇÕES (Auditoria)
-- ============================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID,
  acao        VARCHAR(100) NOT NULL,
  entidade    VARCHAR(50) NOT NULL,
  entidade_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  ip          VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Índices de Performance

```sql
-- Diplomas
CREATE INDEX idx_diplomas_status ON diplomas(status);
CREATE INDEX idx_diplomas_curso ON diplomas(curso_id);
CREATE INDEX idx_diplomas_diplomado ON diplomas(diplomado_id);
CREATE INDEX idx_diplomas_codigo_validacao ON diplomas(codigo_validacao);
CREATE INDEX idx_diplomas_created ON diplomas(created_at DESC);

-- Disciplinas
CREATE INDEX idx_disciplinas_diploma ON diploma_disciplinas(diploma_id);

-- Fluxo
CREATE INDEX idx_fluxo_diploma ON fluxo_assinaturas(diploma_id);
CREATE INDEX idx_fluxo_status ON fluxo_assinaturas(status);

-- Auditoria
CREATE INDEX idx_audit_entidade ON audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

---

## 4. Diagrama de Relacionamentos

```
instituicoes ──┬── cursos ──┬── diplomas ──┬── diploma_disciplinas
               │            │              ├── diploma_atividades_complementares
               │            │              ├── diploma_estagios
               │            │              ├── diploma_enade
               │            │              ├── diploma_habilitacoes
               │            │              ├── fluxo_assinaturas ── assinantes
               │            │              └── filiacoes (via diplomado)
               │            └── curso_areas
               └── assinantes

diplomados ──── diplomas
templates (independente)
audit_log (independente)
```

---

## 5. Resumo — Total de Tabelas

| # | Tabela | Registros estimados |
|---|--------|-------------------|
| 1 | `instituicoes` | 4 (emissora, registradora, 2 mantenedoras) |
| 2 | `cursos` | 5-20 |
| 3 | `diplomados` | Centenas/milhares |
| 4 | `filiacoes` | 2 por diplomado |
| 5 | `diplomas` | Centenas/milhares |
| 6 | `diploma_disciplinas` | ~40-60 por diploma |
| 7 | `diploma_atividades_complementares` | 0-10 por diploma |
| 8 | `diploma_estagios` | 0-2 por diploma |
| 9 | `assinantes` | 5-10 |
| 10 | `fluxo_assinaturas` | 5 por diploma |
| 11 | `diploma_enade` | 1-3 por diploma |
| 12 | `diploma_habilitacoes` | 0-2 por diploma |
| 13 | `curso_areas` | 1-5 por curso |
| 14 | `templates` | 4-8 |
| 15 | `audit_log` | Cresce continuamente |

**Total: 15 tabelas**

---

*Documento elaborado em parceria: Claude (Opus) — arquitetura e consolidação | MiniMax M2.5 — modelagem SQL e recomendação de stack.*
