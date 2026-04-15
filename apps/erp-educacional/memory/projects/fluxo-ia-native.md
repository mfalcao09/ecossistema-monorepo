# Fluxo IA Native — Módulo Diploma Digital FIC

**Versão:** 1.4
**Data:** 2026-03-20
**Autor:** Marcelo Silva + Claude Sonnet 4.6
**Status:** Planejamento
**Mudança v1.4:** Correção crítica — documentos de suporte devem ser **PDF/A** (ISO 19005), NÃO PDF/X-1a. PDF/X-1a é padrão gráfico de impressão e não atende à norma de arquivamento exigida pelo MEC e Arquivo Nacional. Fluxo reestruturado em 4 fases conforme macroprocesso real (FIC prepara → Registradora registra → FIC gera RVDD → Portal público). Auditoria Acadêmica adicionada como etapa explícita. Fluxo FIC↔Registradora mapeado corretamente.

---

## Visão Geral

O sistema de Diploma Digital da FIC é **100% IA Native**: a inteligência artificial conduz o usuário em cada etapa do processo, extrai dados de documentos, valida informações, orienta o que falta, e só avança quando tudo está correto. O usuário não precisa saber preencher formulários complexos — ele apenas envia documentos e responde perguntas simples.

---

## Princípios do Design IA Native

1. **IA como copiloto permanente** — chat contextual em todas as telas, sempre disponível
2. **Documentos como fonte primária de dados** — o usuário envia o documento, a IA extrai
3. **Zero digitação manual de dados críticos** — campos preenchidos automaticamente via extração
4. **Validação em linguagem natural** — erros explicados como uma pessoa explicaria, não como código
5. **Progresso guiado** — a IA informa o que falta e o que vem a seguir
6. **Memória de contexto** — a IA lembra o que já foi enviado e não pede duas vezes
7. **Decisão assistida** — quando há ambiguidade, a IA apresenta opções com explicação

---

## Macroprocesso — 4 Fases

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: FIC prepara e envia para a registradora                │
│  [Auditoria] → [Cadastro] → [Histórico] → [Conversão PDF/A]    │
│  → [Geração XMLs] → [Assinatura ICP-Brasil] → [Transmissão]    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ FIC envia pacote
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: Registradora valida, registra e retorna                │
│  [Recepção] → [Validação] → [Assinatura registradora]           │
│  → [Retorno do XML registrado para a FIC]                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Registradora devolve XML assinado
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: FIC recebe, gera RVDD e entrega ao diplomado           │
│  [Recepção do XML registrado] → [Geração RVDD PDF]              │
│  → [Publicação no repositório] → [Entrega ao diplomado]         │
│    (XML + RVDD PDF)                                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Diploma publicado
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 4: Portal público de consulta e verificação               │
│  [URL pública HTTPS] → [QR Code / código alfanumérico]          │
│  → [Integração validadordiplomadigital.mec.gov.br]              │
└─────────────────────────────────────────────────────────────────┘
```

> **Importante:** O **XML é o diploma legal** — é o documento jurídico válido.
> A **RVDD é apenas a representação visual** (PDF) — um facilitador de leitura humana, não o diploma em si.
> O diplomado recebe **dois arquivos**: o XML assinado (diploma legal) + a RVDD (PDF visual).

---

## Arquitetura dos Dados Necessários

Para gerar os 3 XMLs obrigatórios (XSD v1.06), o sistema precisa coletar dados em 4 grupos:

### Grupo 1 — Dados da IES (já no cadastro)
- Nome da instituição, CNPJ, código MEC, endereço
- Dados do ato autorizativo (portaria, DOU, data)
- Dados da mantenedora
- Representantes legais (Reitor + Secretário Acadêmico) com CPF e cargo

### Grupo 2 — Dados do Curso (já no cadastro)
- Nome do curso, código MEC, modalidade, grau
- Carga horária, duração mínima
- Ato autorizativo do curso
- Habilitações e ênfases (se aplicável)

### Grupo 3 — Dados do Diplomado (cadastro + documentos)
- Nome completo (como no RG)
- CPF, RG, data de nascimento, naturalidade
- Filiação (pai e mãe)
- Nacionalidade
- Necessidades especiais (se houver)

### Grupo 4 — Dados Acadêmicos do Diploma (gerados no processo)
- Data de conclusão do curso
- Data de colação de grau
- Número do processo/protocolo
- Número do livro e folha de registro
- Histórico escolar (disciplinas, notas, cargas horárias)
- Data de expedição do diploma

---

## Fase 1 — FIC Prepara e Envia

### Etapa 1 — Auditoria Acadêmica (Verificação Automática)

**Quem executa:** Sistema + IA
**Tempo estimado:** Automático (< 1 minuto)
**Documentos necessários:** Nenhum (dados já cadastrados)

#### O que a IA verifica automaticamente:

A IA realiza um checklist de pendências antes de iniciar qualquer processo de emissão de diploma. Sem interação humana nesta etapa — é uma varredura silenciosa.

**Pendências acadêmicas:**
- [ ] Todas as disciplinas obrigatórias concluídas com aprovação
- [ ] Carga horária total ≥ mínima exigida pelo curso
- [ ] Estágio supervisionado concluído e documentado
- [ ] TCC entregue, aprovado e registrado
- [ ] Colação de grau realizada e com data confirmada
- [ ] Débitos com a biblioteca quitados (livros devolvidos)
- [ ] Pendências financeiras com a instituição quitadas

**Pendências institucionais:**
- [ ] IES cadastrada com CNPJ e Código MEC válidos
- [ ] Ato autorizativo do curso presente (portaria + DOU)
- [ ] Representantes legais cadastrados (Reitor e Secretário Acadêmico)
- [ ] Certificados digitais A3 configurados e válidos
- [ ] API de assinatura digital conectada e funcional

#### Interação IA se há pendências:
```
🤖 "Antes de emitir o diploma de João Pedro, preciso que algumas
    pendências sejam resolvidas:

    🔴 Pendências que bloqueiam a emissão:
    • Livro 'Gestão Estratégica' ainda consta como emprestado (biblioteca)
    • Colação de grau ainda não tem data confirmada no sistema

    🟡 Pendências de atenção (não bloqueiam, mas precisam ser registradas):
    • Certificado digital do Reitor vence em 15 dias

    Quando as pendências em vermelho forem resolvidas, podemos continuar.
    [Verificar novamente] [Registrar resolução]"
```

#### Interação IA quando está tudo OK:
```
🤖 "✅ Auditoria concluída. Nenhuma pendência encontrada.
    João Pedro Alves Silva está habilitado para emissão de diploma.
    [Iniciar processo de emissão →]"
```

---

### Etapa 2 — Cadastro do Diplomado

**Quem executa:** Secretaria Acadêmica (com IA copiloto)
**Tempo estimado:** 3–5 minutos
**Documentos necessários:** RG (ou CNH) + CPF

#### Fluxo de interação:

**Passo 2.1 — Upload do documento de identidade**

A IA solicita o documento e extrai os dados automaticamente:

```
🤖 "Vamos começar pelo diplomado. Por favor, envie uma foto ou PDF do
    RG ou CNH dele. Vou extrair todas as informações automaticamente."

    [📎 Enviar documento]
```

Após o upload, a IA extrai via OCR/Vision:
- Nome completo
- Número do RG e órgão emissor
- Data de nascimento
- Naturalidade (cidade e estado)
- Filiação (nome do pai e da mãe)

E apresenta para confirmação:
```
🤖 "Encontrei os seguintes dados. Confirme se estão corretos:

    Nome: JOÃO PEDRO ALVES SILVA
    RG: 12.345.678-9 SSP/MS
    Nascimento: 15/03/1998
    Naturalidade: Cassilândia/MS
    Pai: Pedro Alves Silva
    Mãe: Maria de Fátima Silva

    ✅ Tudo certo  |  ✏️ Corrigir algo"
```

**Passo 2.2 — Validação do CPF**

```
🤖 "Qual é o CPF do diplomado? Vou validar se está regular na Receita Federal."

    [Campo CPF com máscara]
```

A IA valida matematicamente o CPF e consulta a Receita Federal.

**Passo 2.3 — Informações complementares**

A IA pergunta apenas o que não conseguiu extrair do documento:

```
🤖 "Só mais duas informações que não estão no documento:
    1. O diplomado tem alguma necessidade especial que deva constar no diploma?
       [Não] [Sim — qual?]
    2. Qual é a nacionalidade dele?
       [Brasileira] [Outra]"
```

**Passo 2.4 — Conversão dos documentos para PDF/A ⚠️ OBRIGATÓRIO**

Após a extração dos dados, o sistema converte automaticamente cada documento pessoal recebido para **PDF/A** — formato de arquivamento de longo prazo exigido pelo MEC e pelo Arquivo Nacional para documentos embutidos no XML `DocumentacaoAcademicaRegistro`:

```
Documento recebido (JPG/PNG/PDF qualquer formato)
    → Normalização (padronização de resolução, orientação)
    → Conversão para PDF/A via Ghostscript
        (metadados XMP, fontes embutidas, sRGB, perfil ICC embutido)
    → veraPDF valida conformidade PDF/A
    → Codificação em Base64
    → Pronto para embutir no XML DocumentacaoAcademicaRegistro
```

A IA informa o usuário discretamente:
```
🤖 "Documento recebido e processado. ✅
    RG convertido para o formato de arquivamento exigido pelo MEC."
```

> **Por que PDF/A e não PDF/X-1a?**
> O **PDF/A** (ISO 19005) é o padrão de arquivamento de longo prazo exigido pelo MEC e pelo
> Arquivo Nacional para preservação de documentos digitais. Garante que o documento será
> legível e verificável nos próximos 10, 20, 30+ anos, independente do software utilizado.
>
> O **PDF/X-1a** (ISO 15930-1) é um padrão voltado para **impressão gráfica** — garante
> reprodução de cores em gráficas, não preservação arquivística. **Não atende** à norma
> de arquivamento digital exigida pelo MEC.

**Documentos que a IA pode processar:**
| Documento | O que extrai |
|-----------|-------------|
| RG (foto ou PDF) | Nome, RG, nascimento, filiação, naturalidade |
| CNH | Nome, nascimento, CPF, filiação |
| Certidão de nascimento | Nome, filiação, naturalidade, data de nascimento |
| Passaporte | Nome, nascimento, nacionalidade |

---

### Etapa 3 — Histórico Acadêmico

**Quem executa:** Secretaria Acadêmica (com IA copiloto)
**Tempo estimado:** 5–15 minutos
**Documentos necessários:** Histórico escolar do sistema acadêmico + Ata de colação

#### Fluxo de interação:

**Passo 3.1 — Vinculação ao curso**

```
🤖 "Em qual curso o diplomado se formou?"

    [Lista de cursos cadastrados]
    → Administração — Bacharelado (Código MEC: 12345)
    → Direito — Bacharelado (Código MEC: 67890)
```

**Passo 3.2 — Upload do histórico escolar**

```
🤖 "Agora preciso do histórico escolar completo. Pode ser o PDF exportado
    do seu sistema acadêmico (TOTVS, Lyceum, Quero Educação, etc.) ou
    uma planilha Excel.

    Vou extrair automaticamente todas as disciplinas, notas e cargas horárias."

    [📎 Enviar histórico]
```

A IA extrai via processamento de PDF/Excel:
- Lista de todas as disciplinas
- Nota ou conceito de cada disciplina
- Carga horária de cada disciplina
- Período/semestre cursado
- Situação (aprovado/dispensado/etc.)
- Carga horária total
- Coeficiente de rendimento (se disponível)

E apresenta um resumo:
```
🤖 "Encontrei 42 disciplinas no histórico:
    ✅ 40 aprovadas
    ⚠️ 2 com informação incompleta (carga horária ausente)

    Carga horária total identificada: 3.200h
    Carga mínima do curso: 3.000h ✅

    Vou precisar da carga horária das 2 disciplinas com problema:
    • Estágio Supervisionado I
    • Trabalho de Conclusão de Curso

    Qual é a carga horária de cada uma?"
```

**Passo 3.3 — Dados de conclusão**

```
🤖 "Agora preciso das datas do processo de diplomação:

    1. Data de conclusão das disciplinas (último dia letivo aprovado)?
       [Calendário]

    2. Data da colação de grau?
       [Calendário]

    3. Tem a ata de colação de grau? Posso extrair a data de lá.
       [📎 Enviar ata] [Informar manualmente]"
```

**Passo 3.4 — Número de registro**

```
🤖 "Para registrar o diploma no livro da secretaria, preciso:

    Número do livro de registro: [____]
    Número da folha: [____]
    Número do processo/protocolo: [____]

    💡 Esses dados normalmente estão no livro de registro de diplomas
       da secretaria acadêmica."
```

**Passo 3.5 — Conversão dos documentos acadêmicos para PDF/A**

Assim como os documentos pessoais, o histórico escolar e a ata de colação também são convertidos para PDF/A antes de serem embutidos no XML:

```
Histórico escolar PDF / Ata de colação PDF
    → Conversão para PDF/A via Ghostscript
    → veraPDF valida conformidade
    → Codificação em Base64
    → Pronto para embutir no XML DocumentacaoAcademicaRegistro
```

**Documentos que a IA pode processar:**
| Documento | O que extrai |
|-----------|-------------|
| Histórico PDF (qualquer sistema) | Disciplinas, notas, CH, situação |
| Planilha Excel/CSV | Disciplinas, notas, CH |
| Ata de colação de grau | Data da colação, nome do formando |
| Declaração de conclusão | Data de conclusão, curso |

---

### Etapa 4 — Revisão e Validação IA

**Quem executa:** IA (automático) + confirmação humana
**Tempo estimado:** 1–2 minutos
**Documentos necessários:** Nenhum (usa dados coletados)

#### O que a IA faz:

Antes de gerar os XMLs, a IA faz uma revisão completa e inteligente:

**Validações técnicas (obrigatórias pelo MEC):**
- Nome do diplomado idêntico ao do documento de identidade
- CPF válido e sem inconsistências
- Datas coerentes (conclusão < colação < expedição)
- Carga horária total ≥ mínima do curso
- Todas as disciplinas com nota e CH preenchidas
- Dados da IES e curso vinculados corretamente
- Ordem de assinatura configurada
- Documentos de suporte em PDF/A confirmados

**Validações inteligentes (IA):**
- Nome com capitalização correta (sem tudo maiúsculo ou tudo minúsculo)
- Naturalidade no formato correto (Cidade/UF)
- Datas em formato correto para o XSD
- Disciplinas com nomes muito abreviados (sugere nome completo)
- Carga horária de estágio proporcional à regulamentação

**Apresentação do resultado:**

Se tudo OK:
```
🤖 "✅ Revisão concluída! Tudo está correto.

    Resumo do diploma:
    👤 João Pedro Alves Silva — CPF 123.456.789-00
    🎓 Administração — Bacharelado
    📅 Conclusão: 15/12/2025 | Colação: 20/02/2026
    📚 42 disciplinas | 3.200h
    🏛️ FIC — Faculdades Integradas de Cassilândia
    📎 4 documentos em PDF/A prontos para o XML

    Pronto para gerar os XMLs? [Gerar agora]"
```

---

### Etapa 5 — Geração dos XMLs

**Quem executa:** Sistema (automático)
**Tempo estimado:** < 30 segundos
**Documentos necessários:** Nenhum

#### O que acontece:

A IA gera automaticamente os 3 XMLs obrigatórios conforme XSD v1.06:

**XML 1 — DocumentacaoAcademicaRegistro**
- Dados privados do processo de emissão
- Rito de emissão (livro, folha, processo)
- Documentos de suporte embutidos em Base64 (PDF/A)
- Referência aos demais XMLs

**XML 2 — HistoricoEscolarDigital**
- Todas as disciplinas cursadas
- Notas, cargas horárias, situações
- Dados de conclusão

**XML 3 — DiplomaDigital**
- Dados públicos do diploma
- Dados do diplomado
- Dados da IES e do curso
- Dados de expedição

**Feedback da IA durante a geração:**
```
🤖 "Gerando os XMLs...
    ✅ DocumentacaoAcademicaRegistro.xml — OK (com 4 documentos PDF/A embutidos)
    ✅ HistoricoEscolarDigital.xml — OK
    ✅ DiplomaDigital.xml — OK

    ✅ Validação contra XSD v1.06 — APROVADO

    Os 3 arquivos estão prontos para assinatura."
```

---

### Etapa 6 — Assinatura Digital ICP-Brasil

**Quem executa:** Representantes legais (com IA orientando)
**Tempo estimado:** 10–30 minutos
**Documentos necessários:** Certificados digitais A3 (token USB ou nuvem)

#### Ordem obrigatória (MEC):

```
1º → Reitor (e-CPF A3) assina o nó DadosDiploma
2º → IES (e-CNPJ) assina o nó DadosDiploma
3º → IES (e-CNPJ AD-RA) assina o nó raiz DocumentacaoAcademicaRegistro
```

#### Fluxo de interação:

**Para cada signatário, a IA notifica e guia:**

```
🤖 "É hora de assinar o diploma de João Pedro Alves Silva.

    Você é: Prof. Carlos Mendes — Reitor

    O que você precisa:
    • Seu certificado digital A3 (token USB ou certificado em nuvem)
    • Acesso ao portal de assinatura

    Quando estiver com o certificado em mãos, clique em Assinar.
    [🔏 Assinar agora] [Enviar por e-mail para o Reitor]"
```

**Acompanhamento em tempo real:**
```
Status das assinaturas:
✅ 1ª assinatura — Reitor (e-CPF A3) — 20/03/2026 14:32
⏳ 2ª assinatura — IES (e-CNPJ) — aguardando...
⏳ 3ª assinatura — IES (e-CNPJ AD-RA) — aguardando...
```

**Após todas as assinaturas:**
```
🤖 "✅ Todas as assinaturas ICP-Brasil concluídas!

    🔐 Carimbo de tempo (TSA) adicionado — 20/03/2026 15:45

    O pacote está pronto para ser enviado à registradora."
```

---

### Etapa 7 — Transmissão para a Registradora

**Quem executa:** Sistema (automático)
**Tempo estimado:** < 1 minuto (envio) + tempo de resposta da registradora

#### O que o sistema envia:

O sistema monta e transmite o **pacote completo** para a IES Registradora:
- `DocumentacaoAcademicaRegistro.xml` (assinado, com documentos PDF/A embutidos)
- `HistoricoEscolarDigital.xml` (assinado)
- `DiplomaDigital.xml` (assinado)
- Todos com carimbo de tempo TSA

```
🤖 "Enviando pacote para a registradora...

    ✅ Pacote enviado para: [Nome da IES Registradora]
    📦 3 XMLs assinados + carimbo de tempo
    🕐 Aguardando retorno (prazo estimado: X dias úteis)

    Você receberá uma notificação quando o diploma for registrado."
```

---

## Fase 2 — Registradora Valida, Registra e Retorna

**Quem executa:** IES Registradora (processo externo ao nosso sistema)
**Visibilidade:** Acompanhamento no dashboard do painel admin

### O que a registradora faz (processo externo):

1. **Recepção** — recebe o pacote XML enviado pela FIC
2. **Validação técnica** — valida os XMLs contra o XSD v1.06
3. **Validação documental** — verifica os documentos PDF/A embutidos
4. **Verificação das assinaturas** — confirma assinaturas ICP-Brasil
5. **Registro** — insere no sistema de registro com número oficial
6. **Assinatura da registradora** — assina o XML com seu próprio certificado ICP-Brasil
7. **Retorno** — devolve o XML registrado e assinado para a FIC

### Como o sistema acompanha:

```
Dashboard — Status do diploma FIC-2026-00123:

📤 Enviado para registradora — 20/03/2026 15:50
⏳ Aguardando validação da registradora...

[Ver detalhes do pacote enviado]
```

### Quando a registradora retorna:

```
🤖 "🎉 O diploma de João Pedro foi registrado pela registradora!

    ✅ XML registrado recebido
    📋 Número de registro: XXXXXX
    🔐 Assinatura da registradora: verificada

    Agora vou gerar a RVDD (representação visual do diploma).
    [Gerar RVDD →]"
```

> **Nota:** Se a registradora rejeitar o pacote (erro técnico ou documental),
> o sistema recebe o retorno com o motivo e a IA orienta a correção.

---

## Fase 3 — FIC Recebe, Gera RVDD e Entrega

### Etapa 8 — Geração da RVDD (Representação Visual)

**Quem executa:** Sistema (automático)
**Tempo estimado:** < 1 minuto
**Documentos necessários:** XML registrado e assinado pela registradora

#### O que é a RVDD

A RVDD é a **representação visual** do diploma digital — um PDF formatado para leitura humana. **Não é o diploma legal** (o XML é o documento jurídico válido). A RVDD facilita o dia a dia: o diplomado pode imprimir, apresentar em uma entrevista, mostrar no celular.

#### Pipeline de geração:

```
XML DiplomaDigital registrado
    → Extração dos dados para o template
    → Renderização do layout FIC em HTML/CSS
    → Geração de QR Code + código alfanumérico de verificação
    → PDF via Puppeteer (headless Chromium, server-side)
    → Repositório público HTTPS
```

A RVDD inclui:
- **Anverso:** layout oficial da FIC com todos os dados do diploma
- **Verso:** QR Code obrigatório + URL de verificação + código alfanumérico
- Assinaturas digitais visíveis
- Logotipo da FIC
- Resolução mínima 300 DPI

```
🤖 "Gerando a representação visual do diploma...

    ✅ Layout renderizado
    ✅ QR Code gerado: https://diplomas.fic.edu.br/verify/FIC-2026-00123
    ✅ Código de validação: FIC-2026-00123
    ✅ RVDD gerada e publicada no repositório

    Pronto para entregar ao diplomado!"
```

> **Sobre o formato da RVDD:**
> A RVDD é um PDF padrão gerado internamente pela FIC. Não requer conversão
> para PDF/A ou PDF/X-1a — ela é um documento de conveniência visual, não um
> documento de arquivo. O que tem valor legal é o XML assinado.

---

### Etapa 9 — Entrega ao Diplomado

**Quem executa:** Sistema (automático)
**Tempo estimado:** < 1 minuto

#### Dois arquivos entregues ao diplomado:

| Arquivo | Formato | O que é |
|---------|---------|---------|
| `diploma-joao-pedro.xml` | XML assinado (XAdES) | **O diploma legal** — documento jurídico válido |
| `diploma-joao-pedro-rvdd.pdf` | PDF | **Representação visual** — para leitura humana e apresentação |

#### Publicação no repositório público:

```
🤖 "Publicando no repositório público...

    ✅ Diploma publicado em:
    https://diplomas.fic.edu.br/verify/FIC-2026-00123

    QR Code funcional ✅
    Código de validação: FIC-2026-00123"
```

#### Notificação ao diplomado (Portal do Diplomado):

```
🤖 "Enviando e-mail para o diplomado...

    Para: joao.silva@gmail.com
    Assunto: Seu Diploma Digital está disponível — FIC

    O e-mail inclui:
    • XML assinado (o diploma legal)
    • PDF da RVDD (representação visual)
    • Link para o Portal do Diplomado
    • Instruções de como verificar a autenticidade do diploma"
```

#### Registro no sistema:

```
🤖 "✅ Processo concluído com sucesso!

    Diploma: FIC-2026-00123
    Diplomado: João Pedro Alves Silva
    Curso: Administração — Bacharelado
    Expedição: 20/03/2026
    Registrado por: [IES Registradora]

    O diploma está registrado, assinado, publicado e entregue."
```

---

## Fase 4 — Portal Público de Consulta e Verificação

**Quem acessa:** Qualquer pessoa (público em geral, empregadores, instituições)
**Sem login necessário**

### Funcionalidades do portal público:

**Acesso via QR Code** (escaneado da RVDD):
```
Usuário escaneia QR Code da RVDD
    → Redirecionado para https://diplomas.fic.edu.br/verify/FIC-2026-00123
    → Página mostra dados públicos do diploma (sem dados sensíveis)
    → Botão para baixar o XML (o diploma legal)
```

**Acesso via código alfanumérico:**
```
Usuário digita FIC-2026-00123 em https://diplomas.fic.edu.br/verify
    → Mesmo resultado
```

**Integração com o portal do MEC:**
```
validadordiplomadigital.mec.gov.br
    → Aceita o XML assinado para validação independente
    → Confirma autenticidade das assinaturas ICP-Brasil
```

**Informações exibidas na página pública:**

| Campo | Exibido |
|-------|---------|
| Nome do diplomado | ✅ (completo) |
| CPF | ❌ (privacidade — LGPD) |
| Curso | ✅ |
| Grau | ✅ |
| Instituição emissora | ✅ |
| IES Registradora | ✅ |
| Data de conclusão | ✅ |
| Data de expedição | ✅ |
| Status das assinaturas | ✅ (válido/inválido) |
| Download do XML | ✅ |

---

## Mapa de Documentos × Etapas

| Documento | Fornecido por | Fase/Etapa | Conversão | O que a IA extrai |
|-----------|--------------|-----------|-----------|-------------------|
| RG ou CNH | Secretaria | Fase 1 — Etapa 2 | → PDF/A | Nome, RG, nascimento, filiação, naturalidade |
| CPF | Secretaria | Fase 1 — Etapa 2 | → PDF/A | CPF (validação) |
| Certidão de nascimento | Secretaria (opcional) | Fase 1 — Etapa 2 | → PDF/A | Naturalidade, filiação |
| Histórico escolar (PDF/Excel) | Sistema acadêmico | Fase 1 — Etapa 3 | → PDF/A | Disciplinas, notas, CH, situação |
| Ata de colação de grau | Secretaria | Fase 1 — Etapa 3 | → PDF/A | Data da colação, nome do formando |
| Declaração de conclusão | Secretaria (opcional) | Fase 1 — Etapa 3 | → PDF/A | Data de conclusão |
| Livro de registro | Secretaria (manual) | Fase 1 — Etapa 3 | Nenhuma | Número do livro, folha, processo |
| Certificado digital A3 | Reitor + IES | Fase 1 — Etapa 6 | Nenhuma | Assinatura |

---

## Módulos de IA a Desenvolver

### 1. DocumentReader (Motor de Extração)
**Tecnologia:** OpenAI Vision API ou Google Document AI
**Função:** Processa imagens e PDFs, extrai dados estruturados
**Suporta:** RG, CNH, certidões, históricos, atas
**Output:** JSON com dados extraídos + nível de confiança por campo

### 2. AIAssistant (Chat Copiloto)
**Tecnologia:** API OpenRouter (modelos configuráveis)
**Função:** Chat contextual em cada tela, guia o usuário, responde dúvidas
**Contexto:** Sabe em qual etapa o usuário está, o que já foi preenchido, o que falta
**Personalidade:** Assistente de secretaria acadêmica especializado em diploma digital

### 3. DataValidator (Validador Inteligente)
**Tecnologia:** Regras + LLM para casos ambíguos
**Função:** Valida dados coletados contra regras do MEC e boas práticas
**Output:** Lista de erros críticos e avisos com sugestões em linguagem natural

### 4. XMLGenerator (Motor de Geração)
**Tecnologia:** Biblioteca XML + validação XSD v1.06
**Função:** Gera os 3 XMLs obrigatórios a partir dos dados coletados
**Validação:** Automática contra schemas oficiais do MEC

### 5. RVDDGenerator (Motor de Geração da RVDD)
**Tecnologia:** Puppeteer (render HTML → PDF)
**Função:** Gera o PDF visual do diploma a partir do XML registrado
**Pipeline:**
```
XML DiplomaDigital registrado
    → Extração de dados
    → HTML/CSS template FIC
    → PDF via Puppeteer (headless Chromium, server-side)
    → Repositório público HTTPS
```
**Observação:** Puppeteer precisa ser executado server-side. Usar Vercel Function com runtime Node.js.

### 6. DocumentConverter (Conversor PDF/A)
**Tecnologia:** Ghostscript (server-side, Docker)
**Função:** Converte documentos pessoais e acadêmicos do estudante (RG, CPF, histórico, ata de colação) para **PDF/A** antes de embutir no XML `DocumentacaoAcademicaRegistro`
**Pipeline:**
```
Documento recebido (JPG/PNG/PDF qualquer formato)
    → Ghostscript → PDF/A (ISO 19005)
        (metadados XMP obrigatórios, fontes embutidas, perfil ICC sRGB embutido)
    → veraPDF valida conformidade PDF/A
    → Codificação Base64
    → Pronto para embutir no XML
```
**Quando é acionado:** No momento do upload de cada documento (Fase 1, Etapas 2 e 3).
**Infraestrutura:** Microserviço dedicado com Docker (Ghostscript não roda em serverless padrão).

### 7. NotificationEngine (Motor de Notificações)
**Tecnologia:** Email (Resend ou SendGrid) + WhatsApp (Twilio, opcional)
**Função:** Notifica signatários para assinar, acompanha retorno da registradora, notifica diplomado na entrega
**Templates:** E-mails personalizados com dados do diploma

---

## Telas a Construir

### Painel Admin

| Tela | Descrição |
|------|-----------|
| `/diploma` | Dashboard com pipeline e métricas |
| `/diploma/diplomas/novo` | Wizard de criação — 9 etapas com IA |
| `/diploma/diplomas/[id]` | Detalhe do diploma + status das assinaturas + status da registradora |
| `/diploma/diplomados` | CRUD de diplomados (já existe) |
| `/diploma/assinantes` | Gestão de signatários e certificados |

### Portal Público

| Tela | Descrição |
|------|-----------|
| `/verify` | Busca pública por código alfanumérico |
| `/verify/[codigo]` | Verificação pública do diploma (sem login) |
| `/diplomado/login` | Login do diplomado |
| `/diplomado/meus-diplomas` | Diplomas do diplomado autenticado (XML + RVDD) |

---

## Roadmap de Implementação

### Sprint 1 — Fundação (2 semanas)
- [ ] Banco de dados: tabelas `diplomas`, `historico_disciplinas`, `assinaturas`, `documentos_estudante`
- [ ] API CRUD diplomas
- [ ] Wizard de criação (Etapas 1–4) sem IA por enquanto
- [ ] Integração DocumentReader (extração de RG e histórico)
- [ ] **Microserviço DocumentConverter** (Docker + Ghostscript + veraPDF): conversão para **PDF/A** + codificação Base64 — necessário desde a primeira sprint pois é acionado no upload de documentos

### Sprint 2 — Motor XML (2 semanas)
- [ ] Gerador XMLs conforme XSD v1.06
- [ ] Embutir documentos PDF/A em Base64 no XML DocumentacaoAcademicaRegistro
- [ ] Validador XSD automático
- [ ] Testes com schemas oficiais do MEC
- [ ] DataValidator com regras básicas

### Sprint 3 — IA Copiloto (2 semanas)
- [ ] AIAssistant integrado nas Etapas 2, 3 e 4
- [ ] Auditoria Acadêmica automática (Etapa 1): pendências de biblioteca, financeiro, colação
- [ ] DataValidator com LLM para validações inteligentes
- [ ] Feedback em linguagem natural em todos os erros

### Sprint 4 — Assinatura + Transmissão (2 semanas)
- [ ] Integração API de assinatura (BRy ou Certisign) — orquestração ICP-Brasil A3
- [ ] Orquestração da ordem obrigatória de assinatura
- [ ] Carimbo de tempo (TSA)
- [ ] Transmissão do pacote para a IES Registradora
- [ ] Acompanhamento de status do retorno da registradora
- [ ] Notificações por e-mail para signatários

### Sprint 5 — Geração RVDD + Publicação + Portal (1-2 semanas)
- [ ] Template HTML/CSS do diploma FIC (layout anverso + verso)
- [ ] Motor Puppeteer: render HTML → PDF (server-side, Node.js)
- [ ] Geração de QR Code + código de validação alfanumérico embutidos no layout
- [ ] Repositório público `/verify/[codigo]`
- [ ] Portal do diplomado (login + download de XML + RVDD)
- [ ] Notificação ao diplomado por e-mail (XML + RVDD PDF)

### Sprint 6 — Polimento (1 semana)
- [ ] Testes de ponta a ponta (Fase 1 → 2 → 3 → 4)
- [ ] Ajustes de UX no wizard
- [ ] Documentação do sistema
- [ ] Deploy produção

---

## Notas Importantes

- **Prazo MEC graduação:** 01/07/2025 (já vencido — urgente para regularização da FIC)
- **XSD vigente:** v1.06 (validar schemas do portal MEC antes de começar Sprint 2)
- **API de assinatura:** Avaliar BRy, Certisign e Soluti — prioritário para Sprint 4
- **LGPD:** Dados pessoais dos diplomados devem ter consentimento e política de retenção
- **Backup:** XMLs assinados devem ser preservados por mínimo 10 anos
- **Dois arquivos ao diplomado:** XML assinado (legal) + RVDD PDF (visual) — sempre juntos

---

## Análise Regulatória Completa — Normativas do MEC

### Linha do Tempo das Normativas

| Normativa | Data | Impacto Principal |
|-----------|------|-------------------|
| Portaria MEC nº 1.095/2018 | 2018 | Estabeleceu layout e dados obrigatórios do diploma físico — base visual para a RVDD |
| Portaria MEC nº 554/2019 | 2019 | Marco regulatório do diploma digital: XML + XAdES + ICP-Brasil A3 + QR Code + URL HTTPS |
| Instrução Normativa SESU nº 1/2020 | Dez/2020 | Requisitos técnicos detalhados + schemas XSD + sintaxe XML (Anexo I) + especificações RVDD (Anexo II) |
| Instrução Normativa SESU nº 1/2021 | 2021 | Atualizou sintaxe XML e anexos técnicos |
| Portaria MEC nº 117/2021 | 2021 | Ajustes no processo de registro de diplomas |
| Portaria MEC nº 1.001/2021 | 2021 | Atualizações sobre obrigatoriedade e prazos |
| Instrução Normativa SESU nº 1/2022 | Mar/2022 | Atualização de schemas e requisitos técnicos |
| Instrução Normativa SESU nº 2/2022 | Mai/2022 | Novos requisitos técnicos complementares |
| Instrução Normativa SESU nº 4/2022 | 2022 | Ajustes adicionais |
| Instrução Normativa SESU nº 5/2022 | Out/2022 | **XSD v1.05** |
| Portaria MEC nº 70/2025 | 2025 | Amplia para pós-graduação + residências em saúde + **XSD v1.06** |

---

## ✅ PDF/A — Padrão Correto para Documentos de Suporte

### Por que PDF/A (e não PDF/X-1a)

O padrão correto para os documentos de suporte embutidos no XML `DocumentacaoAcademicaRegistro` é o **PDF/A** (ISO 19005), **não o PDF/X-1a** (ISO 15930-1).

| Padrão | Norma | Para quê serve | Aplicação no diploma |
|--------|-------|----------------|---------------------|
| **PDF/A** | ISO 19005 | Arquivamento de longo prazo de documentos digitais | ✅ Documentos de suporte (RG, histórico, ata) |
| **PDF/X-1a** | ISO 15930-1 | Intercâmbio de arquivos para impressão gráfica | ❌ NÃO se aplica ao processo de diploma |

**PDF/A garante:**
- Metadados XMP obrigatórios e completos
- Fontes 100% embutidas no arquivo
- Perfil ICC de cores embutido (sRGB para documentos, CMYK opcional)
- Sem JavaScript, sem conteúdo criptografado
- Sem links externos — o arquivo é autossuficiente
- Legível e verificável nos próximos 10, 20, 30+ anos

**PDF/X-1a garante (mas não é o que precisamos):**
- Cores CMYK específicas para impressoras gráficas
- Ausência de transparência (compatível com impressão offset)
- Fontes embutidas
- NÃO tem os requisitos de metadados e rastreabilidade arquivística do PDF/A

### Documentos que precisam ser convertidos para PDF/A

| Documento | Origem | Conversão |
|-----------|--------|-----------|
| RG (frente e verso) | Upload pela secretaria | JPG/PNG/PDF → PDF/A |
| CPF | Upload pela secretaria | JPG/PNG/PDF → PDF/A |
| Certidão de nascimento | Upload (opcional) | JPG/PNG/PDF → PDF/A |
| Histórico escolar original | Sistema acadêmico (PDF) | PDF → PDF/A |
| Ata de colação de grau | Secretaria (PDF) | PDF → PDF/A |
| Declaração de conclusão | Secretaria (opcional) | PDF → PDF/A |

### Parâmetros Ghostscript para conversão para PDF/A

```bash
gs -dPDFA=2 -dBATCH -dNOPAUSE \
   -sDEVICE=pdfwrite \
   -dCompatibilityLevel=1.4 \
   -sColorConversionStrategy=sRGB \
   -dEmbedAllFonts=true \
   -dSubsetFonts=true \
   -dAutoRotatePages=/None \
   -sOutputFile=documento-pdfa.pdf \
   PDFA_def.ps \
   documento-original.pdf
```

**Validação de conformidade:** Usar `veraPDF` com perfil PDF/A-2b para validar cada arquivo gerado antes de embutir no XML.

### Fluxo completo dos documentos de suporte

```
Secretário faz upload do documento (qualquer formato: JPG, PNG, PDF)
    → IA extrai os dados (OCR/Vision)
    → Sistema converte para PDF/A via Ghostscript
        (metadados XMP, fontes embutidas, perfil ICC sRGB)
    → veraPDF valida conformidade PDF/A-2b
    → Sistema codifica em Base64
    → Base64 embutido no XML DocumentacaoAcademicaRegistro
    → XML transmitido à registradora (com todos os docs embutidos)
```

### Fluxo da RVDD (separado — não precisa de conversão)

A RVDD é gerada internamente pela FIC e não precisa atender a nenhum padrão de conversão:
```
XML DiplomaDigital registrado
    → Extração de dados
    → HTML/CSS layout FIC
    → PDF via Puppeteer
    → Repositório público HTTPS
```

---

## Regulamentação Completa (Atualizada)

| Normativa | Status | O que exige |
|-----------|--------|-------------|
| Portaria 1.095/2018 | Vigente | Layout e dados obrigatórios do diploma (base para RVDD) |
| Portaria 554/2019 | Vigente | Marco regulatório: XML + XAdES + A3 + QR + HTTPS |
| IN SESU 1/2020 | Vigente (atualizada) | Schemas XSD, sintaxe XML, especificações RVDD |
| IN SESU 1/2021 | Vigente (atualizada) | Atualização de sintaxe e schemas |
| Portaria 117/2021 | Vigente | Processo de registro |
| Portaria 1.001/2021 | Vigente | Obrigatoriedade e prazos |
| IN SESU 1/2022 | Vigente | Atualização técnica |
| IN SESU 2/2022 | Vigente | Requisitos complementares |
| IN SESU 4/2022 | Vigente | Ajustes técnicos |
| IN SESU 5/2022 | Vigente | XSD v1.05 |
| Portaria 70/2025 | Vigente | XSD v1.06 + pós-graduação + residências |

**XSD vigente: v1.06** (Portaria 70/2025)

---

## Decisões Técnicas — Registro

| Decisão | Status | Resolução |
|---------|--------|-----------|
| Padrão documentos de suporte | ✅ Confirmado | **PDF/A** (ISO 19005) — exigido pelo MEC e Arquivo Nacional para arquivamento |
| PDF/X-1a — aplicabilidade | ✅ Confirmado | **NÃO se aplica** ao processo de diploma digital — é padrão de impressão gráfica |
| Ferramenta conversão PDF/A | ✅ Definido | Ghostscript (microserviço Docker) |
| Validação conformidade PDF/A | ✅ Definido | veraPDF (perfil PDF/A-2b) |
| Quando converter para PDF/A | ✅ Definido | No upload do documento (Fase 1, Etapas 2 e 3) |
| Formato RVDD | ✅ Confirmado | PDF padrão gerado pela FIC via Puppeteer — sem necessidade de conversão de padrão |
| XML é o diploma legal | ✅ Confirmado | O XML assinado é o documento jurídico válido — RVDD é apenas representação visual |
| Entrega ao diplomado | ✅ Confirmado | Dois arquivos: XML assinado + RVDD PDF |
| Infraestrutura para Ghostscript | ⏳ Pendente | Microserviço Docker (Fly.io/Railway) — necessário desde a Sprint 1 |
| Fornecedor de assinatura | ⏳ Pendente | BRy, Certisign ou Soluti |
| IES Registradora | ⏳ Pendente | Definir qual IES fará o registro para a FIC |
| Stack backend | ⏳ Pendente | Node.js/TS vs Python |
| Layout visual RVDD da FIC | ⏳ Pendente | Design a definir com a FIC |

---

*Documento atualizado em 2026-03-20 — v1.4. Correção crítica: PDF/A (ISO 19005) substitui PDF/X-1a (ISO 15930-1) como padrão para documentos de suporte. Fluxo reestruturado em 4 fases conforme macroprocesso real: FIC prepara → Registradora registra → FIC gera RVDD → Portal público. Auditoria Acadêmica adicionada como etapa explícita. XML confirmado como diploma legal; RVDD como representação visual. Entrega ao diplomado com dois arquivos (XML + RVDD). Portal público de verificação mapeado como Fase 4.*
