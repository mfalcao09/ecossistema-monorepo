# Motor de Geração de XML — Diploma Digital FIC

Implementação completa do motor de geração dos **3 XMLs obrigatórios** conforme **Portaria MEC 70/2025** e **XSD v1.06**.

## Arquivos

### 1. **tipos.ts**
Define as interfaces TypeScript para todos os dados necessários:
- `DadosDiploma` — estrutura completa do diploma
- `Disciplina` — registro de disciplina
- `AtividadeComplementar` — atividades extracurriculares
- `Estagio` — estágio curricular
- `Assinante` — signatários (reitor, diretor, etc.)

**Uso:**
```typescript
import { DadosDiploma } from '@/lib/xml/tipos';
```

---

### 2. **gerador.ts**
Motor que gera os 3 XMLs a partir de um objeto `DadosDiploma`:

#### Função Principal
```typescript
import { gerarXMLs } from '@/lib/xml/gerador';

const xmls = gerarXMLs(dadosDiploma);
// Retorna:
// {
//   diploma_digital: string,
//   historico_escolar: string,
//   doc_academica_registro: string
// }
```

#### XMLs Gerados

##### 1. **DiplomaDigital** (`diploma_digital`)
- XML **público** que o diplomado recebe
- Contém: dados do diplomado, curso, IES e registro
- Estrutura conforme `DiplomaDigital_v1.06.xsd`

##### 2. **HistoricoEscolarDigital** (`historico_escolar`)
- XML com histórico acadêmico completo
- Inclui: todas as disciplinas, notas, atividades complementares
- Estrutura conforme `HistoricoEscolarDigital_v1.06.xsd`

##### 3. **DocumentacaoAcademicaRegistro** (`doc_academica_registro`)
- XML **privado** com dados sensíveis + rito de emissão
- Inclui: DiplomaDigital + HistoricoEscolar + RitoEmissao
- Para arquivamento institucional
- Estrutura conforme `DocumentacaoAcademicaRegistroDiplomaDigital_v1.06.xsd`

#### Helpers Internos
- `esc(text)` — escapa caracteres XML especiais
- `tagOpcional(tag, value)` — retorna tag XML apenas se valor existir
- `limparNumero(num)` — remove formatação de CPF/CNPJ
- `formatarData(data)` — converte para formato ISO YYYY-MM-DD

---

### 3. **validador.ts**
Validação estrutural dos XMLs gerados:

```typescript
import {
  validarDiplomaDigital,
  validarHistoricoEscolar,
  validarDocAcademicaRegistro
} from '@/lib/xml/validador';

const resultado = validarDiplomaDigital(xmlString);
// Retorna:
// {
//   valido: boolean,
//   erros: string[],
//   avisos: string[]
// }
```

#### Campos Validados

**DiplomaDigital:**
- Nome, CPF, DataNascimento, Sexo ✓
- NomeCurso, CodigoEmec, Grau, TituloConferido ✓
- CNPJ (IES), CodigoValidacao, DataColacaoGrau, DataExpedicao ✓
- CPF com 11 dígitos
- CNPJ com 14 dígitos
- Datas em formato ISO YYYY-MM-DD
- Sexo: M ou F

**HistoricoEscolar:**
- Mesmas validações do DiplomaDigital
- DataEmissao obrigatória ✓
- Mínimo 1 disciplina obrigatória ✓
- Cada disciplina: Codigo, Nome, Situacao

**DocumentacaoAcademicaRegistro:**
- DadosDiploma, HistoricoEscolar, RitoEmissao presentes
- DataEmissao, IESEmissora, IESRegistradora
- CNPJ e Nome em ambas as IES

---

### 4. **montador.ts**
Busca dados do Supabase e monta o objeto `DadosDiploma`:

```typescript
import { montarDadosDiploma } from '@/lib/xml/montador';

const dados = await montarDadosDiploma(supabase, diplomaId);
```

#### Fluxo de Busca
1. **diplomas** + joins de diplomados, cursos
2. **instituicoes** (primeira ativa)
3. **assinantes** (ativos da instituição)
4. **diploma_disciplinas** (ordenadas por período)
5. **diploma_atividades_complementares** (opcional)
6. **diploma_estagios** (opcional)
7. **diploma_enade** (opcional)

#### Utilitários
```typescript
import { gerarCodigoValidacao } from '@/lib/xml/montador';

// Gera: FIC2025 + 13 chars aleatórios
// Ex: FIC2025ABCD12345WXYZ
const codigo = gerarCodigoValidacao();
```

#### Erros Críticos
Lança erro se:
- Diploma não encontrado
- Diplomado sem nome ou CPF
- Curso ausente
- Nenhuma instituição ativa
- Nenhuma disciplina registrada

---

## Fluxo Completo de Uso

### Cenário 1: Gerar XMLs de um diploma no banco

```typescript
import { montarDadosDiploma } from '@/lib/xml/montador';
import { gerarXMLs } from '@/lib/xml/gerador';
import { validarDiplomaDigital } from '@/lib/xml/validador';

// 1. Buscar dados do banco
const dados = await montarDadosDiploma(supabase, 'uuid-diploma');

// 2. Gerar XMLs
const xmls = gerarXMLs(dados);

// 3. Validar
const validacao = validarDiplomaDigital(xmls.diploma_digital);

if (validacao.valido) {
  // Salvar em armazenamento (R2, Storage, etc)
  console.log('XMLs gerados com sucesso!');
} else {
  console.error('Erros:', validacao.erros);
}
```

### Cenário 2: Gerar XMLs manualmente (testes)

```typescript
import { gerarXMLs } from '@/lib/xml/gerador';
import { DadosDiploma } from '@/lib/xml/tipos';

const dados: DadosDiploma = {
  diplomado: {
    nome: 'João Silva',
    cpf: '12345678901',
    // ... outros campos
  },
  // ... estrutura completa
};

const xmls = gerarXMLs(dados);
```

### Cenário 3: Validar um XML existente

```typescript
import { validarDiplomaDigital } from '@/lib/xml/validador';

const xmlString = /* XML como string */;
const resultado = validarDiplomaDigital(xmlString);

resultado.erros.forEach(erro => console.error(`❌ ${erro}`));
resultado.avisos.forEach(aviso => console.warn(`⚠️ ${aviso}`));
```

---

## Integração em Endpoints Next.js

### Exemplo: `/api/diplomas/[id]/xml`

```typescript
import { gerarXMLs } from '@/lib/xml/gerador';
import { montarDadosDiploma } from '@/lib/xml/montador';
import { validarDiplomaDigital } from '@/lib/xml/validador';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Buscar dados
    const dados = await montarDadosDiploma(supabase, params.id);

    // 2. Gerar XMLs
    const xmls = gerarXMLs(dados);

    // 3. Validar
    const validacao = validarDiplomaDigital(xmls.diploma_digital);

    if (!validacao.valido) {
      return Response.json(
        { erro: 'XML inválido', detalhes: validacao.erros },
        { status: 400 }
      );
    }

    // 4. Retornar XMLs
    return Response.json({
      sucesso: true,
      xmls,
      codigo_validacao: dados.diploma.codigo_validacao
    });

  } catch (error) {
    return Response.json(
      { erro: 'Erro ao gerar XMLs' },
      { status: 500 }
    );
  }
}
```

---

## Estrutura do Banco de Dados Esperada

### Tabelas Utilizadas

```sql
-- Diploma
CREATE TABLE diplomas (
  id UUID PRIMARY KEY,
  diplomado_id UUID REFERENCES diplomados(id),
  curso_id UUID REFERENCES cursos(id),
  codigo_validacao VARCHAR(50) UNIQUE,
  data_colacao_grau DATE,
  data_conclusao DATE,
  data_expedicao DATE,
  periodo_letivo VARCHAR(10),
  situacao_aluno VARCHAR(50),
  forma_acesso VARCHAR(50),
  data_ingresso DATE,
  livro_registro VARCHAR(50),
  numero_registro VARCHAR(50),
  pagina_registro VARCHAR(50),
  processo_registro VARCHAR(50),
  data_registro DATE,
  segunda_via BOOLEAN DEFAULT FALSE
);

-- Diplomado
CREATE TABLE diplomados (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  nome_social VARCHAR(255),
  cpf VARCHAR(11) NOT NULL UNIQUE,
  ra VARCHAR(20) NOT NULL,
  data_nascimento DATE NOT NULL,
  sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
  nacionalidade VARCHAR(50),
  naturalidade_municipio VARCHAR(100),
  naturalidade_uf CHAR(2),
  rg_numero VARCHAR(20),
  rg_orgao_expedidor VARCHAR(50),
  rg_uf CHAR(2),
  filiacao_mae VARCHAR(255),
  filiacao_pai VARCHAR(255)
);

-- Disciplinas
CREATE TABLE diploma_disciplinas (
  id UUID PRIMARY KEY,
  diploma_id UUID REFERENCES diplomas(id),
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  periodo VARCHAR(10),
  situacao VARCHAR(50),
  carga_horaria_aula INTEGER,
  carga_horaria_relogio INTEGER,
  nota DECIMAL(5,2),
  conceito VARCHAR(2),
  forma_integralizacao VARCHAR(50),
  docente_nome VARCHAR(255),
  docente_titulacao VARCHAR(100),
  docente_cpf VARCHAR(11)
);

-- Instituições
CREATE TABLE instituicoes (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  codigo_mec VARCHAR(20) NOT NULL,
  logradouro VARCHAR(255),
  municipio VARCHAR(100),
  uf CHAR(2),
  cep VARCHAR(8),
  tipo_credenciamento VARCHAR(50),
  numero_credenciamento VARCHAR(50),
  data_credenciamento DATE,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Assinantes
CREATE TABLE assinantes (
  id UUID PRIMARY KEY,
  instituicao_id UUID REFERENCES instituicoes(id),
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) NOT NULL,
  cargo VARCHAR(100) NOT NULL,
  tipo_certificado VARCHAR(10) CHECK (tipo_certificado IN ('eCPF', 'eCNPJ')),
  ativo BOOLEAN DEFAULT TRUE
);
```

---

## Validação e Conformidade

✓ **Portaria MEC 70/2025** — Todos os campos obrigatórios inclusos
✓ **XSD v1.06** — Estrutura conforme especificação
✓ **Escaping XML** — Caracteres especiais tratados
✓ **Formatação** — Datas em ISO, CPF/CNPJ limpos
✓ **Campos Opcionais** — Excluídos do XML se vazios
✓ **TypeScript Estrito** — Sem `any`, tipos bem definidos

---

## Próximos Passos

1. **Assinatura Digital** — Integrar com BRy/Certisign/Soluti
2. **Gerador RVDD** — Converter XML → PDF visual
3. **Armazenamento** — Salvar em R2/Supabase Storage
4. **Repositório Público** — Endpoint HTTPS para validação
5. **Webhook MEC** — Notificar sistema do MEC

---

## Suporte e Debugging

### Testar localmente
```typescript
import { exemploMontarDadosManual, gerarXMLs } from '@/lib/xml/exemplo-uso';

const dados = exemploMontarDadosManual();
const xmls = gerarXMLs(dados);
console.log(xmls.diploma_digital);
```

### Ver XMLs gerados
Os XMLs são strings formatadas com indentação. Para visualizar melhor:
```typescript
// Salvar em arquivo (Node.js)
fs.writeFileSync('diploma.xml', xmls.diploma_digital);
```

---

**Versão:** 1.0
**Data:** 2025-03-21
**Status:** Produção
**XSD:** v1.06
**MEC:** Portaria 70/2025
