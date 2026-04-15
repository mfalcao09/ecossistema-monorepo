# Briefing Técnico — Ferramenta de Diploma Digital para a FIC

**Faculdades Integradas de Cassilândia (FIC)**
**Data:** 19 de março de 2026
**Versão:** 1.0

---

## 1. O que é o Diploma Digital?

O Diploma Digital é um documento acadêmico em formato eletrônico (XML), com validade jurídica em todo o território nacional, que substitui o diploma físico tradicional. Ele é assinado digitalmente com certificados da ICP-Brasil (Infraestrutura de Chaves Públicas Brasileira), garantindo autenticidade, integridade, irretratabilidade e interoperabilidade.

Na prática, o diplomado recebe um documento que pode ser verificado por qualquer pessoa ou instituição, a qualquer momento, por meio de um código de validação ou QR Code.

---

## 2. Base Legal e Normativa

### 2.1 Legislação Principal

| Normativa | Descrição |
|-----------|-----------|
| **Portaria MEC nº 554/2019** | Marco regulatório original — estabeleceu as diretrizes para emissão e registro de diplomas de graduação em formato digital |
| **Instrução Normativa SESU/MEC nº 1/2020** | Detalhou os requisitos técnicos (esquemas XML, assinaturas, representação visual) |
| **Instrução Normativa SESU/MEC nº 2/2021** | Atualizou a sintaxe XML e os anexos técnicos |
| **Portaria MEC nº 70/2025** | Ampliou a obrigatoriedade para pós-graduação stricto sensu e residências em saúde, e atualizou prazos |

### 2.2 Prazos Obrigatórios

| Prazo | Obrigatoriedade |
|-------|----------------|
| **1º de julho de 2025** | Diploma digital obrigatório para **graduação** em todas as IES do Sistema Federal de Ensino (públicas federais e privadas) |
| **2 de janeiro de 2026** | Obrigatório para **pós-graduação stricto sensu** (mestrado e doutorado) e **certificados de Residência em Saúde** |

**Importante para a FIC:** Como IES privada pertencente ao Sistema Federal de Ensino, a FIC já deveria estar emitindo diplomas digitais de graduação desde julho de 2025. A conformidade é urgente.

### 2.3 Sanções

O descumprimento dos prazos pode resultar em sanções administrativas previstas no Decreto nº 9.235/2017, que incluem desde notificações até a suspensão de processos seletivos e atos autorizativos.

---

## 3. Arquitetura Técnica do Diploma Digital

### 3.1 Os Três Arquivos XML

O diploma digital é composto por **três arquivos XML distintos**, cada um com função específica:

#### a) Documentação Acadêmica de Registro (`DocumentacaoAcademicaRegistro`)
- Contém os **dados privados** do diploma (informações sensíveis do aluno)
- Informações sobre o rito de emissão e registro
- Dados da IES emissora e da IES registradora
- **NÃO é público** — fica sob custódia da IES

#### b) Histórico Escolar Digital (`HistoricoEscolarDigital`)
- Dados completos do histórico escolar do aluno
- Disciplinas, cargas horárias, notas, frequência
- Emitido na finalização da relação do discente com a IES
- Acompanha o diploma como documento complementar

#### c) Diploma Digital (`DiplomaDigital`)
- Contém os **dados públicos** do diploma
- É o arquivo que o diplomado recebe e pode compartilhar
- Acessível via código de validação e QR Code
- Contém: nome do diplomado, curso, data de colação, dados da IES, número de registro

### 3.2 Esquemas XML (XSD)

O MEC disponibiliza os XML Schema Definitions (XSD) que definem a estrutura obrigatória dos XMLs:

- `DiplomaDigital_v1.05.xsd` (ou versão vigente)
- `DocumentacaoAcademicaRegistroDiplomaDigital_v1.05.xsd`
- `HistoricoEscolarDigital_v1.05.xsd`

A versão mais recente exigida pela Portaria 70/2025 é a **v1.06**. Esses schemas são disponibilizados pelo MEC no portal oficial.

### 3.3 Formato de Assinatura Digital

- **Padrão:** XAdES (XML Advanced Electronic Signature)
- **Infraestrutura:** ICP-Brasil
- **Tipo de certificado:** A3 ou superior (obrigatório — certificados A1 NÃO são aceitos)
- **Carimbo de tempo:** obrigatório, registra a data/hora exata da assinatura
- **Padrão brasileiro:** PBAD (Padrão Brasileiro de Assinaturas Digitais)

### 3.4 Ordem das Assinaturas

A ordem de assinatura é regulamentada e deve ser seguida rigorosamente:

1. **Representantes da IES** assinam o nó `DadosDiploma` com seus respectivos **e-CPFs** (certificado A3)
2. **IES Emissora** assina o nó `DadosDiploma` com **e-CNPJ**
3. **IES Emissora** assina o nó raiz `DocumentacaoAcademicaRegistro` com certificado **e-CNPJ de Arquivamento** (tipo AD-RA)

> Os signatários digitais devem ser os mesmos estabelecidos pela IES para o diploma físico (Reitor, Secretário Acadêmico, etc.).

---

## 4. Representação Visual do Diploma Digital (RVDD)

### 4.1 O que é

A RVDD é um arquivo PDF que oferece uma versão de "fácil leitura" do diploma digital. Ela preserva a tradição e o simbolismo do diploma físico, impedindo que o diploma digital fique limitado à linguagem computacional (XML).

### 4.2 Estrutura

| Lado | Conteúdo |
|------|----------|
| **Anverso (frente)** | Layout visual do diploma (similar ao físico) + **código de validação** na parte inferior central |
| **Verso** | **QR Code** que redireciona para a URL única do diploma digital |

### 4.3 Personalização

A IES pode manter o mesmo layout já adotado para o diploma físico, desde que inclua os mecanismos obrigatórios de segurança (código de validação e QR Code).

---

## 5. Mecanismos de Acesso e Verificação

### 5.1 Código de Validação
Código alfanumérico único que permite acessar o XML do diploma digital no repositório da IES.

### 5.2 QR Code
Código de barras bidimensional que aponta para a URL do diploma digital.

### 5.3 URL de Armazenamento
A IES deve disponibilizar ao MEC uma **URL em HTTPS** destinada exclusivamente ao armazenamento e consulta dos XMLs dos diplomas digitais.

---

## 6. Fluxo Completo de Emissão

```
┌─────────────────────────────────────────────────────────┐
│ 1. COLAÇÃO DE GRAU                                      │
│    Aluno cola grau → IES tem até 60 dias para emitir    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 2. GERAÇÃO DOS XMLs                                     │
│    Sistema gera os 3 XMLs conforme XSD do MEC:          │
│    • Documentação Acadêmica de Registro                 │
│    • Histórico Escolar Digital                          │
│    • Diploma Digital                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 3. ASSINATURA DIGITAL                                   │
│    Representantes assinam com e-CPF (A3)                │
│    IES assina com e-CNPJ                                │
│    IES assina nó raiz com e-CNPJ Arquivamento (AD-RA)   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 4. REGISTRO (se aplicável)                              │
│    Se a IES não tem autonomia para registro próprio,    │
│    envia para IES Registradora que aplica segunda       │
│    assinatura institucional                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 5. GERAÇÃO DA RVDD (PDF)                                │
│    PDF com layout visual + código de validação + QR     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 6. ARMAZENAMENTO E DISPONIBILIZAÇÃO                     │
│    XML armazenado em URL HTTPS da IES                   │
│    Diplomado recebe código de validação por e-mail      │
│    Diploma verificável por qualquer pessoa via QR/URL   │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Requisitos de Preservação

- A IES deve manter os diplomas digitais disponíveis por **no mínimo 10 anos** em meio digital
- Deve ser possível verificar a validade jurídica **a qualquer tempo**
- Garantias exigidas: legalidade, autenticidade, integridade, confiabilidade, disponibilidade, rastreabilidade, irretratabilidade, privacidade e interoperabilidade

---

## 8. Soluções Tecnológicas Existentes no Mercado

### 8.1 RNP (Rede Nacional de Ensino e Pesquisa)
- Desenvolveu a principal solução pública em parceria com o LAVID/UFPB
- Utilizada por diversas IES públicas
- Inclui: Conector Local (integração com sistemas acadêmicos), serviço de assinatura, RAP (Registro e Armazenamento Preservado)
- Modelo voltado para IES públicas, com adaptações para privadas

### 8.2 Fornecedores Privados
- **TOTVS** (ERP acadêmico com módulo de diploma digital)
- **Lyceum** (plataforma de gestão acadêmica)
- **Jacad** (software ERP acadêmico)
- **Stoque/Ábaris** (solução especializada em diploma digital)
- **LedgerTec** (assinatura de diplomas digitais com blockchain)
- **Perseus** (sistema acadêmico)

### 8.3 Componentes Técnicos Necessários
Qualquer solução precisa contemplar:

1. **Gerador de XML** conforme XSD do MEC
2. **Validador de XML** contra os schemas oficiais
3. **Módulo de assinatura digital** (XAdES com certificados ICP-Brasil A3)
4. **Carimbo de tempo** (Autoridade de Carimbo de Tempo credenciada)
5. **Gerador de RVDD** (PDF com código de validação e QR Code)
6. **Repositório HTTPS** para armazenamento e consulta pública
7. **Integração com sistema acadêmico** (dados de alunos, cursos, histórico)

---

## 9. Análise para a FIC — Caminhos Possíveis

### Caminho 1: Contratar Solução Pronta (SaaS)
**Prós:** Implementação rápida, conformidade garantida pelo fornecedor, suporte técnico
**Contras:** Custo recorrente (mensalidade), dependência do fornecedor, menos controle
**Tempo estimado:** 1-3 meses para integração

### Caminho 2: Usar Solução da RNP
**Prós:** Solução referência do MEC, custo potencialmente menor, credibilidade
**Contras:** Voltada para IES públicas, pode ter fila de adesão, menos flexibilidade
**Tempo estimado:** 2-4 meses

### Caminho 3: Desenvolver Solução Própria
**Prós:** Controle total, personalização completa, sem custos recorrentes de licença, ativo tecnológico próprio (potencial para integrar ao portfólio Intentus/Nexvy)
**Contras:** Maior complexidade técnica, necessidade de manter conformidade com atualizações do MEC, custo de desenvolvimento
**Tempo estimado:** 3-6 meses

### Caminho 4: Solução Híbrida
**Prós:** Desenvolver o core (geração XML, RVDD, repositório) e integrar APIs de terceiros para assinatura digital e carimbo de tempo
**Contras:** Requer coordenação de múltiplos fornecedores
**Tempo estimado:** 2-4 meses

---

## 10. Recomendação Estratégica para a FIC

Considerando o perfil de Marcelo como empreendedor tech (Intentus, Nexvy) e o contexto de revitalização da FIC, o **Caminho 4 (Híbrido)** parece o mais adequado:

1. **Desenvolver internamente:** Geração de XML, validação contra XSD, geração de RVDD (PDF), repositório HTTPS, painel administrativo
2. **Integrar via API:** Assinatura digital ICP-Brasil (ex: BRy, Certisign, ou Soluti) e carimbo de tempo
3. **Valor agregado:** A ferramenta pode futuramente ser integrada à Intentus Real Estate ou comercializada como módulo para outras IES

---

## 11. Escopo Técnico para Desenvolvimento

### 11.1 Módulos da Ferramenta

1. **Painel Administrativo (Web)**
   - Cadastro e gestão de diplomados
   - Upload/integração de dados acadêmicos
   - Acompanhamento do status de cada diploma
   - Gestão de signatários

2. **Motor de Geração XML**
   - Gerar os 3 XMLs conforme XSD vigente do MEC
   - Validar contra schemas oficiais
   - Versionamento (para acompanhar atualizações do MEC)

3. **Módulo de Assinatura Digital**
   - Integração com API de assinatura ICP-Brasil (certificados A3)
   - Orquestração da ordem de assinaturas
   - Carimbo de tempo via Autoridade credenciada

4. **Gerador de RVDD**
   - Gerar PDF com layout personalizado da FIC
   - Incluir código de validação e QR Code
   - Template configurável

5. **Repositório Público**
   - URL HTTPS para consulta de diplomas
   - API de verificação (código de validação / QR Code)
   - Armazenamento seguro com garantia de preservação (mínimo 10 anos)

6. **Portal do Diplomado**
   - Acesso ao diploma digital (XML)
   - Download da RVDD (PDF)
   - Compartilhamento seguro

### 11.2 Stack Tecnológica Sugerida

| Componente | Tecnologia |
|------------|-----------|
| Backend | Node.js/TypeScript ou Python |
| Frontend (Admin) | Next.js / React |
| Banco de Dados | PostgreSQL (Supabase) |
| Geração XML | Biblioteca XML nativa + validação XSD |
| Geração PDF (RVDD) | Puppeteer, PDFKit ou similar |
| Assinatura Digital | API de terceiros (BRy, Certisign, Soluti) |
| Hospedagem | Vercel (frontend) + Supabase (backend/DB) ou Cloudflare Workers |
| Armazenamento | Cloudflare R2 ou Supabase Storage |

---

## 12. Próximos Passos

1. **Decisão:** Confirmar o caminho de desenvolvimento (recomendação: Caminho 4 — Híbrido)
2. **XSD:** Baixar os schemas XML oficiais do portal do MEC para referência
3. **Prototipação:** Começar pelo Motor de Geração XML (núcleo do sistema)
4. **Assinatura:** Pesquisar e contratar API de assinatura digital ICP-Brasil
5. **RVDD:** Definir o layout visual do diploma da FIC
6. **Infraestrutura:** Configurar repositório HTTPS e banco de dados

---

*Documento preparado como briefing técnico para o projeto de Diploma Digital da FIC.*
*Fontes consultadas: Portal MEC Diploma Digital, Portarias MEC 554/2019 e 70/2025, documentação RNP, e fornecedores especializados.*
