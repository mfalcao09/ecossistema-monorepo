# Plano Pipeline End-to-End — Diploma Digital FIC
**Criado em:** 14/04/2026  
**Sessão:** 093  
**Status:** Aprovado com todas as decisões respondidas  
**Referência:** Sprints 6–9 do Masterplan v4.0

---

## Decisões Confirmadas

| # | Decisão | Resposta |
|---|---------|----------|
| D1 | Templates dos Termos (Expedição + Registro) | ✅ Layouts disponíveis — fornecidos pela FIC |
| D2 | BRy Assinatura Digital | ✅ Contrato ativo — pode usar `api-assinatura-digital` |
| D3 | Protocolo de envio à UFMS/694 | ✅ Upload manual no sistema web da UFMS |
| D4 | Layout do RVDD | ✅ Modelo institucional da FIC disponível |

Com todas as decisões resolvidas, **nenhum sprint está bloqueado**. Podemos implementar os 4 sprints em sequência sem dependências externas pendentes.

---

## Diagnóstico: Estado Atual do Pipeline

```
Etapa 0: Extração      ✅ Funciona (drag-drop → IA → revisão → processo)
Etapa 1: XML           ✅ Funciona (geração → BRy Diploma → assinatura → carimbo)
Etapa 2: Docs/Acervo   ❌ Ignorada — verificarEAvancarPacote pula direto
Etapa 3: Registro      ❌ Não implementada (ZIP, upload UFMS, retorno XML)
Etapa 4: RVDD          ❌ Não implementada (PDF visual do diploma)
Etapa 5: Publicado     ❌ Não implementada (repositório público + portal)
```

### Gaps Identificados (11 no total)

| Gap | Descrição | Sprint |
|-----|-----------|--------|
| G1  | Arquivos "Acervo" do processo não são copiados para o diploma na criação | S6 |
| G2  | `/api/converter/pdfa` existe mas nunca é chamada no fluxo de acervo | S6 |
| G3  | `verificarEAvancarPacote` pula Etapa 2 inteira (vai direto para `aguardando_envio_registradora`) | S6 |
| G4  | Histórico Escolar em PDF não implementado | S7 |
| G5  | Termo de Expedição não implementado | S7 |
| G6  | Termo de Registro não implementado | S7 |
| G7  | BRy `api-assinatura-digital` não integrada (app OAuth separado) | S7 |
| G8  | Pacote ZIP para registradora não montado | S8 |
| G9  | Mecanismo de upload no sistema UFMS não implementado | S8 |
| G10 | Recebimento e processamento do XML registrado não implementado | S8 |
| G11 | Bloco "Ações do pipeline" sem ações para Etapas 2, 3, 4 e 5 | S6–S9 |

---

## Sprint 6 — Acervo Digital
**Objetivo:** Ativar a Etapa 2 completa — transferência de arquivos, conversão PDF/A e UI de acervo  
**Estimativa:** 3–4 dias  
**Gaps fechados:** G1, G2, G3, G11 (parcial — Etapa 2)  
**Pré-requisitos:** Nenhum — pode iniciar imediatamente

### 6.1 — Transferência de arquivos na criação do processo (G1)

**Onde alterar:** RPC `converter_sessao_em_processo` (função Supabase)  
**O que fazer:**  
Ao criar o processo a partir de uma sessão de extração, a RPC deve:
1. Varrer `processo_arquivos` filtrando `destino_acervo = true` para aquela sessão
2. Para cada arquivo encontrado, inserir em `diploma_documentos_comprobatorios` vinculado ao diploma recém-criado
3. Status inicial de cada documento: `pendente_conversao`

**Campos a inserir:**
```sql
INSERT INTO diploma_documentos_comprobatorios (
  diploma_id, processo_arquivo_id, tipo_documento,
  nome_arquivo, arquivo_url, status
)
```

### 6.2 — Conversão PDF/A automática (G2)

**Onde alterar:** Nova função trigger ou job disparado após INSERT em `diploma_documentos_comprobatorios`  
**O que fazer:**  
1. Para cada documento com `status = 'pendente_conversao'`, chamar `POST /api/converter/pdfa`
2. A rota já existe e chama o Ghostscript no Railway — só precisa ser invocada
3. Ao receber resposta, atualizar:
   - `status = 'convertido'` + `arquivo_pdfa_url = [URL do bucket documentos-pdfa]`
   - Se erro: `status = 'erro_conversao'` + `erro_mensagem`
4. Suporte a JPEG, PNG, PDF, TIFF — max 20MB (limites existentes)

**Atenção ao edge case:** PDF > 15MB deve falhar com mensagem clara ao operador, não ficar em loop (bug já documentado em memory).

### 6.3 — Corrigir `verificarEAvancarPacote` (G3)

**Onde alterar:** `src/lib/diploma/verificar-e-avancar-pacote.ts` (ou equivalente)  
**O que fazer:**  
Alterar a lógica de transição após `assinado`:
```
ANTES: assinado → aguardando_envio_registradora
DEPOIS: assinado → aguardando_documentos
```

A transição para `aguardando_envio_registradora` só deve ocorrer quando:
- Todos os comprobatórios obrigatórios da FIC estiverem com `status = 'convertido'` (PDF/A)
- O acervo tiver sido confirmado pelo operador
- Os documentos do processo (histórico, termos) estiverem com `status = 'assinado'`

### 6.4 — UI de acervo no bloco "Ações do pipeline" (G11 parcial)

**Onde alterar:** `src/app/(erp)/diploma/diplomas/[id]/page.tsx` — bloco de ações da Etapa 2  
**O que mostrar:**
- Lista de comprobatórios com status de cada um (ícone de spinner, check, erro)
- Para documentos com `erro_conversao`: botão "Tentar novamente"
- Botão para adicionar documento manualmente (upload avulso)
- Indicador de progresso: "X de Y documentos convertidos"
- Botão "Confirmar acervo" — habilitado só quando todos os obrigatórios estiverem `convertido`

---

## Sprint 7 — Documentos do Processo
**Objetivo:** Gerar Histórico Escolar PDF + Termos + assinatura via BRy Assinatura Digital  
**Estimativa:** 5–7 dias  
**Gaps fechados:** G4, G5, G6, G7, G11 (parcial — ações de Etapa 2)  
**Pré-requisitos:** Layouts dos termos (D1 ✅) + credenciais BRy Assinatura Digital (D2 ✅)

### 7.1 — Histórico Escolar em PDF (G4)

**Abordagem:** Template HTML → Puppeteer (mesmo microserviço Railway)  
**Nova rota:** `POST /api/documentos/historico-escolar`  
**Dados utilizados:**
- Do diploma: nome, CPF, data nascimento, curso, data conclusão
- Das disciplinas: nome, carga horária, nota/conceito, período
- Da IES: nome, CNPJ, endereço, código MEC

**Fluxo:**
1. Operador clica "Gerar Histórico Escolar" na UI da Etapa 2
2. API gera o HTML preenchido e chama Puppeteer
3. PDF salvo no bucket `documentos-processo/[diploma_id]/historico.pdf`
4. Status atualizado em `diploma_documentos_processo`

### 7.2 — Termos de Expedição e Registro (G5, G6)

**Abordagem:** Mesma do histórico — templates HTML fornecidos pela FIC → PDF via Puppeteer  

**Termo de Expedição:** gerado pela IES emissora (FIC) — formaliza que o diploma foi expedido  
**Termo de Registro:** gerado junto com o pacote para a UFMS — confirma o envio para registro  

**Fluxo para cada termo:**
1. Templates HTML criados a partir dos layouts fornecidos
2. Campos dinâmicos: `{{nome_diplomado}}`, `{{cpf}}`, `{{curso}}`, `{{data_expedicao}}`, etc.
3. PDF gerado e salvo em `documentos-processo/[diploma_id]/`
4. Aguarda assinatura (próximo item)

### 7.3 — Integração BRy Assinatura Digital (G7)

**API:** `api-assinatura-digital` da BRy (app OAuth diferente do api-diploma-digital)  
**O que implementar:**
1. Configurar credenciais no ambiente: `BRY_ASSINATURA_CLIENT_ID`, `BRY_ASSINATURA_CLIENT_SECRET`
2. Fluxo OAuth2: obter token → upload do PDF → solicitar assinatura → webhook de retorno
3. Webhook endpoint: `POST /api/webhooks/bry-assinatura`
4. Ao receber confirmação: download do PDF assinado, salvar no bucket, atualizar status

**Status de documentos:**
```
pendente → enviado_para_assinatura → assinado | erro_assinatura
```

**Signatários (a confirmar com FIC):**
- Diretor Geral da FIC
- Coordenador do curso
- Secretário acadêmico

### 7.4 — UI de documentos do processo (G11 parcial)

**O que mostrar na Etapa 2:**
- Cards para: Histórico Escolar, Termo de Expedição, Termo de Registro
- Status de cada um: "Não gerado" / "Gerado, aguardando assinatura" / "Assinado ✓" / "Erro"
- Botões: "Gerar" → "Enviar para assinatura" → preview do PDF assinado

---

## Sprint 8 — Registro na UFMS
**Objetivo:** Montar o pacote ZIP, fazer upload no sistema UFMS e processar o XML registrado  
**Estimativa:** 4–6 dias  
**Gaps fechados:** G8, G9, G10, G11 (parcial — Etapa 3)  
**Pré-requisitos:** Sprint 7 concluído (documentos assinados disponíveis)

### 8.1 — Montagem do pacote ZIP (G8)

**Quando disparar:** Quando `verificarEAvancarPacote` detectar que:
- Acervo confirmado (todos os comprobatórios em PDF/A ✅)
- Histórico Escolar assinado ✅
- Termo de Expedição assinado ✅
- Termo de Registro assinado ✅

**Estrutura do ZIP gerado:**
```
pacote_[CPF]_[AAAA-MM-DD].zip
├── DiplomaDigital.xml
├── HistoricoEscolarDigital.xml
├── DocumentacaoAcademicaRegistro.xml
├── HistoricoEscolar_assinado.pdf
├── TermoExpedicao_assinado.pdf
├── TermoRegistro_assinado.pdf
└── comprobatorios/
    ├── RG.pdf          (PDF/A)
    ├── HistoricoEM.pdf (PDF/A)
    ├── Certidao.pdf    (PDF/A)
    └── TituloEleitor.pdf (PDF/A)
```

**Armazenamento:** bucket `pacotes-registradora/[diploma_id]/pacote_AAAA-MM-DD.zip`

### 8.2 — Interface de upload para o sistema UFMS (G9)

**Fluxo no sistema:**
1. Status avança para `pronto_para_registro`
2. Na UI da Etapa 3: botão "Baixar pacote ZIP" — gera URL assinada temporária do bucket
3. Instruções para o operador: "Acesse o sistema UFMS → [seção de registro] → faça upload deste arquivo"
4. Campo: "Confirmar data/hora de envio" (preenchido pelo operador após fazer o upload no UFMS)
5. Ao confirmar: status avança para `enviado_registradora`

**Observação:** O upload é manual no sistema web da UFMS — o operador baixa o ZIP aqui e faz o upload lá. Futuramente pode ser automatizado se a UFMS disponibilizar API.

### 8.3 — Recebimento do XML registrado (G10)

**Fluxo:**
1. Após registro na UFMS, operador recebe o XML registrado (por e-mail ou baixa do sistema UFMS)
2. Na UI da Etapa 3: campo de upload "XML Registrado (retorno da UFMS)"
3. Sistema processa o XML:
   - Valida que é um XML de diploma válido
   - Extrai o número de registro
   - Salva no bucket `xml-diplomas/[diploma_id]/diploma-registrado.xml`
4. Status avança: `enviado_registradora → registrado`
5. Campo `numero_registro` preenchido no diploma

### 8.4 — UI de registro na Etapa 3 (G11 parcial)

**O que mostrar:**
- Status atual do pacote (em preparação / pronto / enviado / registrado)
- Botão "Baixar pacote ZIP" (habilitado quando `pronto_para_registro`)
- Formulário de confirmação de envio com data/hora
- Campo de upload do XML registrado
- Preview do número de registro após recebimento

---

## Sprint 9 — RVDD e Publicação
**Objetivo:** Gerar o PDF visual do diploma e publicar no repositório público  
**Estimativa:** 4–5 dias  
**Gaps fechados:** G11 (completo — Etapas 4 e 5)  
**Pré-requisitos:** Layout do RVDD (D4 ✅) + Sprint 8 concluído (diploma registrado)

### 9.1 — Geração do RVDD (Etapa 4)

**Abordagem:** Template HTML institucional da FIC → Puppeteer  
**Nova rota:** `POST /api/documentos/rvdd`

**Conteúdo do RVDD:**
- Brasão e identidade visual da FIC
- Dados do diplomado: nome completo, CPF (parcial), data nascimento
- Dados do diploma: curso, habilitação, data conclusão, data expedição
- Dados da IES emissora (FIC) e registradora (UFMS)
- Número de registro
- QR code linkando para `diploma.fic.edu.br/verificar/[hash]`
- Espaço para assinaturas digitais (extraídas do DiplomaDigital.xml)

**Armazenamento:** bucket `rvdd/[diploma_id]/rvdd.pdf`

**UI na Etapa 4:**
- Botão "Gerar RVDD" (habilitado após `registrado`)
- Preview do PDF gerado
- Botão "Aprovar e Publicar" → dispara Sprint 9 item 9.2

### 9.2 — Repositório Público e Publicação (Etapa 5)

**Domínio:** `diploma.fic.edu.br` (já configurado no middleware)

**Página pública `/verificar/[hash]`:**
- Exibe dados públicos do diploma (nome, curso, data, IES)
- Botão de download do RVDD em PDF
- Indicador de autenticidade com número de registro UFMS
- Não exige login

**Página de verificação para terceiros:**
- Qualquer pessoa pode digitar CPF + número de registro para confirmar autenticidade
- Exibe: nome, curso, IES emissora, IES registradora, data de registro

**Fluxo de publicação:**
1. Operador clica "Publicar diploma" após aprovar o RVDD
2. Sistema gera hash único do diploma (SHA-256 do DiplomaDigital.xml)
3. Status avança para `publicado`
4. E-mail automático enviado ao diplomado:
   - Link para `diploma.fic.edu.br/verificar/[hash]`
   - Link de download direto do RVDD
   - Instruções de uso do QR code

---

## Cronograma de Implementação

```
Semana 1 (hoje):   Sprint 6 — Acervo Digital
Semana 2:          Sprint 7 — Documentos do Processo
Semana 3:          Sprint 8 — Registro UFMS
Semana 4:          Sprint 9 — RVDD e Publicação
```

**Piloto com Kauana Karine:**
O diploma da Kauana já está em `aguardando_envio_registradora` (status avançado manualmente).
Com o Sprint 6 concluído, o fluxo da Etapa 2 estará disponível para novos diplomas.
Para o piloto da Kauana especificamente, poderemos usar o Sprint 8 direto (pacote ZIP + upload UFMS)
pois os documentos de acervo já estão no processo.

---

## Arquivos a Criar/Modificar por Sprint

### Sprint 6
- `supabase/migrations/` → Alterar RPC `converter_sessao_em_processo`
- `src/lib/diploma/verificar-e-avancar-pacote.ts` → Corrigir transição de status
- `src/app/api/diplomas/[id]/acervo/` → Disparar conversão PDF/A automática
- `src/app/(erp)/diploma/diplomas/[id]/page.tsx` → UI Etapa 2

### Sprint 7
- `src/app/api/documentos/historico-escolar/route.ts` → Nova rota
- `src/app/api/documentos/termos/route.ts` → Nova rota
- `src/app/api/webhooks/bry-assinatura/route.ts` → Webhook
- `src/lib/bry/assinatura-digital.ts` → Novo cliente BRy
- `src/templates/historico-escolar.html` → Template HTML
- `src/templates/termo-expedicao.html` → Template HTML
- `src/templates/termo-registro.html` → Template HTML

### Sprint 8
- `src/lib/diploma/montar-pacote-zip.ts` → Nova função
- `src/app/api/diplomas/[id]/pacote/route.ts` → Nova rota (gerar/baixar ZIP)
- `src/app/api/diplomas/[id]/xml-registrado/route.ts` → Nova rota (upload XML)
- `src/app/(erp)/diploma/diplomas/[id]/page.tsx` → UI Etapa 3

### Sprint 9
- `src/app/api/documentos/rvdd/route.ts` → Nova rota
- `src/templates/rvdd.html` → Template HTML (leiaute FIC)
- `src/app/(diploma)/verificar/[hash]/page.tsx` → Página pública
- `src/app/api/diplomas/[id]/publicar/route.ts` → Nova rota
- `src/app/(erp)/diploma/diplomas/[id]/page.tsx` → UI Etapas 4 e 5

---

## Notas Técnicas

**Microserviço Railway (Puppeteer):**
- Já usado para geração de XMLs e conversão PDF/A
- Adicionar novas rotas: `/historico-escolar`, `/termo-expedicao`, `/termo-registro`, `/rvdd`
- Variáveis de ambiente necessárias: `BRY_ASSINATURA_CLIENT_ID`, `BRY_ASSINATURA_CLIENT_SECRET`

**Buckets Supabase a criar:**
- `documentos-processo` — histórico + termos (antes de assinatura)
- `pacotes-registradora` — ZIPs para upload na UFMS
- `rvdd` — PDFs visuais dos diplomas

**Tabelas a criar:**
- `diploma_documentos_processo` — histórico escolar + termos (com status de assinatura)
- `diploma_registro_ufms` — controle de envio/retorno da UFMS

**RLS:** Toda tabela nova nasce com RLS ON + policy `auth.uid() IS NOT NULL` (padrão do projeto).

---

*Documento gerado na Sessão 093 — 14/04/2026*  
*Atualizar este arquivo ao iniciar cada sprint e ao concluir cada item.*
