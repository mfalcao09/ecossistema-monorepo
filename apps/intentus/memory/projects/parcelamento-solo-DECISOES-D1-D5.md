# Decisões D1–D5 — Parcelamento de Solo

> **Data:** 07/04/2026
> **Decididas por:** Marcelo
> **Status:** ✅ Todas decididas. Plano de Fase 1 reorganizado abaixo.

---

## D1 — Modelagem: ✅ OPÇÃO B (unificar com `developments`)

**Decisão:** Reusar a tabela `developments` existente, estendendo o conceito de "Empreendimento" para abranger tanto verticais (prédios) quanto horizontais (loteamentos e condomínios de lotes).

### Descoberta surpreendente

A tabela `developments` **já tem** as colunas que precisamos para Opção B:

```
id, tenant_id, created_by, name, description,
city, state, neighborhood, address,
total_units, vgv_estimado, data_lancamento, logo_url,
tipo (enum development_type),
status_empreendimento (enum development_status),
created_at, updated_at
```

E o enum `development_type` já tem dois valores:
- `loteamento` (default)
- `vertical`

**Faltam apenas:**
1. Adicionar valor `condominio` ao enum (condomínio de lotes ≠ loteamento — sem desafetação de área pública)
2. Adicionar colunas geoespaciais: `geometry geography`, `area_m2`, `area_ha`, `kml_file_url`, `elevation_grid jsonb`, `analysis_results jsonb`, `centroid jsonb`
3. Criar tabelas-filhas com prefixo **`development_parcelamento_*`** (mantém o namespace `development_*` semanticamente unificado)

### Por que isso é uma vitória enorme

- ❌ Eliminamos a necessidade de criar `parcelamento_projects` independente
- ✅ CRM, CLM e Properties já reconhecem `developments` — herança automática
- ✅ Um único conceito de "Empreendimento" no sistema (alinhado com a visão IA-native)
- ✅ Economia estimada: ~30% das tabelas que íamos criar

### Renomeação aprovada

| Antes (plano original) | Depois (Opção B) |
|---|---|
| `parcelamento_projects` | usar `developments` (estender) |
| `parcelamento_project_files` | `development_parcelamento_files` |
| `parcelamento_financial_analyses` | `development_parcelamento_financial` |
| `parcelamento_legal_compliance` | `development_parcelamento_compliance` |
| `parcelamento_reserva_legal_cache` | `development_parcelamento_rl_cache` (cache global, sem tenant) |
| EF `parcelamento-elevation` | `development-elevation` |
| EF `parcelamento-geo-layers` | `development-geo-layers` |
| EF `parcelamento-sicar` | `development-sicar-query` |
| EF `parcelamento-datageo` | `development-datageo-rl` |
| EF `parcelamento-dwg-validator` | `development-dwg-validator` |

---

## D2 — DWG-to-DXF: ⏳ AGUARDANDO ESTUDO DE OPÇÕES

**Decisão de Marcelo:** "ainda não sei o que fazer. Como tratar isso de modo profissional?"

### Contexto do problema

DWG é o formato proprietário binário do AutoCAD. A versão do header (ex: `AC1027` = AutoCAD 2013) determina a estrutura interna. **Não existe biblioteca pura JavaScript/Deno** capaz de parsear DWG — é proprietário e a Autodesk só liberou o "OpenDWG SDK" via licença comercial paga (RealDWG ~US$ 7.000/ano por desenvolvedor).

DXF, ao contrário, é texto/ASCII (ou binário) bem documentado e tem parsers gratuitos (`dxf-parser` no JS, `ezdxf` em Python).

**A pergunta real é:** quão importante é aceitar DWG sem pedir ao usuário para converter?

### Opções profissionais — análise comparativa

#### Opção 1 — Manter como validador inteligente (custo R$ 0)

**O que muda em relação ao stub atual:**
- Detectar versão do DWG via magic header e dizer ao usuário qual versão exata enviou
- Mostrar tutorial em vídeo/screenshot de como salvar como DXF no AutoCAD/BricsCAD/QCAD/LibreCAD
- Detectar pelo navegador se o arquivo veio do Google Drive/Dropbox e oferecer link direto pro AutoCAD Web Online (gratuito) que faz a conversão

**Prós:** Zero custo, zero infra nova, zero dependência externa.
**Contras:** Frição UX. Engenheiro precisa abrir o AutoCAD, salvar como DXF, voltar e fazer upload.
**Quando faz sentido:** Se a maioria dos seus engenheiros já mexe em AutoCAD diariamente, eles fazem isso em 30 segundos. Sem dor real.

#### Opção 2 — CloudConvert API (custo variável, US$ 0,005–0,02/conversão)

**O que é:** Serviço SaaS profissional de conversão de arquivos. Suporta DWG → DXF nativamente.
- Cadastro: cloudconvert.com
- Free tier: 25 minutos/dia (≈ 50 conversões DWG pequenos)
- Pago: ~US$ 9/mês para 500 minutos OR pay-as-you-go US$ 0,02/conversão
- Latência: 5–15 segundos por arquivo

**Prós:** Funciona, é managed, tem SLA.
**Contras:** Vazamento de dados (o arquivo do cliente sobe pro CloudConvert), custo recorrente, dependência externa.
**Quando faz sentido:** MVP rápido, volume baixo (<100 conversões/mês).

#### Opção 3 — ConvertAPI (concorrente do CloudConvert)

**Praticamente idêntico ao CloudConvert.**
- Free tier: 1.500 segundos/mês
- Pago: US$ 9/mês para 5.000 conversões
- API mais simples
- Mesmas trade-offs de privacidade

#### Opção 4 — Lambda Python com `ezdxf` + `LibreDWG` (custo R$ 0–10/mês)

**O que é:** Subir um microserviço Python (Lambda/Cloud Run/Fly.io) que usa **LibreDWG** (open-source GNU) para converter DWG→DXF e devolver o resultado. `ezdxf` então parseia o DXF.

**Prós:**
- Dados nunca saem da sua infra (LGPD-friendly)
- Custo praticamente zero (Lambda free tier)
- Você dono do código

**Contras:**
- Você assume manutenção
- LibreDWG não suporta TODAS as versões de DWG (versões muito novas, AC1032+, podem falhar)
- 1 dia de trabalho pra montar o serviço

**Quando faz sentido:** Volume médio/alto, requisito de privacidade, time tem cacife pra manter.

#### Opção 5 — Containerizar ODA File Converter (custo: licença comercial)

**O que é:** A Open Design Alliance (ODA) tem um conversor de linha de comando free para uso pessoal mas pago para uso comercial (~US$ 1.500/ano). É o "padrão ouro" da indústria CAD.

**Prós:** Suporta praticamente todas as versões DWG.
**Contras:** Licença comercial paga, complexidade de empacotamento.
**Quando faz sentido:** Empresa grande que processa milhares de DWG/dia.

#### Opção 6 — Suportar APENAS KML/KMZ + DXF (custo R$ 0, decisão de produto)

**O que é:** Não aceitar DWG no MVP. Pedir explicitamente "envie KML, KMZ ou DXF". O Lovable original já parseia esses 3.

**Prós:** Decisão limpa de produto, sem ambiguidade.
**Contras:** Engenheiros que trabalham 100% no AutoCAD precisam fazer um passo extra.
**Quando faz sentido:** Se você consegue educar o usuário no onboarding ("nosso sistema aceita DXF, KML, KMZ — exporte do seu AutoCAD em 5 segundos").

### Matriz de decisão sugerida

| Cenário | Recomendação |
|---|---|
| **MVP rápido, volume baixo, time pequeno** | Opção 1 + Opção 6 (validador + educação no onboarding) |
| **Quer DWG funcionando já, aceita custo** | Opção 2 ou 3 (CloudConvert/ConvertAPI) |
| **Privacidade é crítica, há tempo** | Opção 4 (Lambda Python + LibreDWG) |
| **Operação em escala, indústria CAD** | Opção 5 (ODA File Converter licenciado) |

### Recomendação Claudinho

**Para o MVP do Parcelamento de Solo:** **Opção 1 + Opção 6 combinadas.** Concretamente:
1. A EF `development-dwg-validator` continua como stub validador, mas com **mensagem de erro útil** (versão detectada + tutorial passo a passo + link pro AutoCAD Web Online).
2. No onboarding do módulo, deixar claro: "**Aceitamos KML, KMZ, DXF, GeoJSON, Shapefile.** Para arquivos DWG, exporte como DXF (Salvar como → DXF AutoCAD R12 ou superior)."
3. **Fica documentado** que a Opção 4 (Lambda Python) é o roadmap quando atingirmos volume.

**Por quê:** É a única opção que combina custo zero, zero risco LGPD e tempo de implementação trivial. E não te impede de evoluir depois.

**⏳ Marcelo precisa confirmar antes da Fase 1.**

---

## D3 — OpenTopography: ✅ CADASTRAR (passo a passo abaixo)

### Por que vale o cadastro

O OpenTopography dá acesso ao **SRTM 30m** (1 arc-second), enquanto o Open-Meteo só dá Copernicus 90m (3 arc-seconds). Para análise de **declividade** num terreno típico de loteamento (5–50 ha), 30m vs 90m é literalmente a diferença entre **enxergar uma curva de nível significativa ou achatar tudo**. Vale demais.

### Passo a passo detalhado

**Passo 1 — Criar conta no portal**
1. Abra https://portal.opentopography.org/myopentopo no navegador
2. Clique em **"Sign Up"** (canto superior direito)
3. Preencha:
   - **First Name** / **Last Name**: seu nome completo
   - **Email**: `mrcelooo@gmail.com`
   - **Affiliation**: `Intentus Real Estate` (ou nome jurídico que preferir)
   - **Country**: Brazil
   - **Position**: `CEO/Founder`
   - **Sector**: `Industry/Private`
   - **Research Interest** (texto livre): _"Real estate development feasibility analysis (subdivision/parcelamento), terrain elevation grids, slope analysis for land use planning under Brazilian zoning law (Lei 6.766/79)."_
   - Senha forte
4. Aceite os termos de uso (são CC-BY 4.0 — requer atribuição da fonte SRTM/NASA)
5. Confirme o e-mail que vão te mandar

**Passo 2 — Gerar a API Key**
1. Faça login em https://portal.opentopography.org/login
2. No menu superior, clique em **"My OpenTopo"** → **"My API Keys"**
3. Clique em **"Request API Key"**
4. Preencha o motivo: _"Programmatic access to SRTM 30m DEM for land subdivision feasibility analysis platform."_
5. A chave é gerada na hora — **copie e guarde em local seguro**

**Passo 3 — Configurar no Supabase**
Quando você me passar a chave, eu adiciono ela como secret na Supabase via:
```
mcp__supabase__execute_sql (ou painel Supabase Edge Functions → Secrets):
OPENTOPO_API_KEY = sua_chave_aqui
```

**Passo 4 — Verificar funcionamento (depois do deploy)**
Depois que eu deployar a EF `development-elevation`, faço um teste com um polígono de Cassilândia/MS (cidade da FIC) e mando o resultado. Se vier `source: "srtm-30m"` no JSON, está funcionando. Se vier `source: "copernicus-90m"`, é porque a chave não foi reconhecida.

### Quotas e limites do free tier

| Item | Limite |
|---|---|
| Calls/dia | 1.000 |
| Calls/mês | 30.000 (efetivo) |
| Tamanho máximo da área | 0.5° × 0.5° por chamada (≈ 55km × 55km — mais que suficiente) |
| Custo | $0 |
| O que acontece se passar | Rate limit 429, EF cai pro fallback Copernicus 90m automaticamente |

**Cobertura:** 60°N a 56°S — Brasil inteiro coberto.

---

## D4 — Escopo MVP: ✅ INCLUIR OS 3 PLACEHOLDERS

**Decisão:** Implementar Análise Financeira, Conformidade Legal e Relatórios PDF desde o MVP. Aceitamos que vamos iterar muito antes do lançamento real.

### Implicação no plano

| Módulo | Estado no Lovable | O que vamos construir no MVP |
|---|---|---|
| **Análise Financeira** | Placeholder de 32 linhas | Modelo financeiro básico: VGV estimado, custo de obra (R$/m² parametrizado), CUB SINAPI, fluxo de caixa de incorporação 36 meses, payback, TIR, VPL |
| **Conformidade Legal** | Placeholder de 34 linhas | Checklist Lei 6.766/79 + Código Florestal: APP, RL, sistema viário mínimo, áreas de uso público, distâncias sanitárias, dimensões mínimas de lote por zona |
| **Relatórios PDF** | Placeholder de 40 linhas | Parecer técnico geo + memorial descritivo + ART/RRT placeholder + tabela de áreas (NBR 12.721 simplificada) — gerados via skill `pdf` com IA |

**Tempo estimado:** Esses 3 módulos adicionam ~3 semanas ao MVP. Marcelo confirmou "vamos iterar muito antes do lançamento" — então tudo bem.

### Prioridade dentro do MVP

1. **Conformidade Legal** (mais simples, regras bem definidas)
2. **Relatórios PDF** (consome o que Conformidade + Geo já produzem)
3. **Análise Financeira** (mais complexa, depende de premissas que precisam ser parametrizadas)

---

## D5 — IA generativa: ✅ DESDE O INÍCIO (IA-NATIVE)

**Decisão:** Toda funcionalidade que pode ser melhorada com IA usa IA desde a v0.1. "Nosso software sempre deve ser IA NATIVE."

### Onde a IA entra na v0.1

| Funcionalidade | Provider | Custo aproximado |
|---|---|---|
| **Parecer técnico geo** (texto a partir dos dados do terreno) | OpenRouter Gemini 2.0 Flash | ~R$ 0,001 por parecer |
| **Sugestão de viabilidade** (loteamento vs condomínio vs venda direta) | OpenRouter Gemini 2.0 Flash | ~R$ 0,001 |
| **Detecção de gargalos legais** (lê o checklist e explica em linguagem natural) | OpenRouter Gemini 2.0 Flash | ~R$ 0,002 |
| **Geração do memorial descritivo** | OpenRouter Gemini 2.0 Flash | ~R$ 0,005 (texto longo) |
| **Validação cruzada de áreas** (compara KML vs DXF vs cálculo Turf) | OpenRouter Gemini 2.0 Flash | ~R$ 0,001 |
| **Resumo executivo do empreendimento** (1 parágrafo para CRM card) | OpenRouter Gemini 2.0 Flash | ~R$ 0,001 |

**Total estimado por análise completa:** ~R$ 0,01–0,05.

**Padrão de prompt:** Sigo o padrão Intentus existente — sistema de prompts em `_shared/ai-prompts.ts`, `aiCall()` no `_shared/openrouter.ts`, fallback automático para GPT-4o-mini se o Gemini falhar.

### Princípio operacional

Toda EF do módulo Parcelamento que produzir dado estruturado vai ter uma EF gêmea `*-ai-insights` que consome esse dado e produz interpretação em linguagem natural. Padrão CLM/CRM já estabelecido.

---

## Resumo das mudanças no plano

| Item | Antes | Depois |
|---|---|---|
| **Tabela principal** | `parcelamento_projects` (nova) | `developments` (estender existente) |
| **Prefixo de tabelas-filhas** | `parcelamento_*` | `development_parcelamento_*` |
| **Prefixo de EFs** | `parcelamento-*` | `development-*` |
| **Tipos de empreendimento** | apenas horizontais | vertical + loteamento + condomínio (unificado) |
| **Escopo MVP** | núcleo geo apenas | núcleo geo + 3 placeholders implementados |
| **IA generativa** | "fase 2" | desde a v0.1 |
| **OpenTopography** | opcional | sim, cadastrar |
| **DWG-to-DXF** | indefinido | ⏳ aguardando confirmação Marcelo |

---

## Próximos 5 passos imediatos (aguardando GO de Marcelo)

1. ⏳ Marcelo confirma D2 (recomendação Claudinho: Opção 1 + 6)
2. ⏳ Marcelo cria conta no OpenTopography seguindo passo a passo acima e me envia a chave
3. 🔧 Eu inicio Fase 1 com Buchecha: migration `development_parcelamento_module.sql`
4. 🔧 Apply migration em branch da Supabase, validar com `get_advisors`
5. 🔧 Code review com Buchecha + commit conventional

---

## Histórico

- **07/04/2026** — D1, D3, D4, D5 decididas. D2 aguardando estudo de opções (entregue acima).
- **07/04/2026** — Descoberta: `developments` já tem coluna `tipo` e enum com `loteamento`+`vertical`. Opção B é ~30% mais barata do que estimativa inicial.
