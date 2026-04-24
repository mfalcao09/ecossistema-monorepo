# Benchmark Plataformas de Atendimento — Relatório Final

**Objetivo:** Capturar boas ideias para aprimorar o módulo de atendimento Nexvy/FIC a partir de 5 SaaS concorrentes de atendimento multicanal (Digisac, Zaapy, Chatwoot, Whaticket, Press Ticket).

**Período:** 2026-04-22 00:47 → 2026-04-23 02:20
**Data do relatório:** 2026-04-23
**Status:** ✅ **CONCLUÍDO** — 126/133 vídeos processados (94.7%) | 7 pendentes por YouTube bot detection

---

## 1. Sumário

- **5 plataformas** benchmarkadas
- **126 vídeos processados integralmente** — transcrição palavra-por-palavra + frames de tela em todos os momentos relevantes
- **6473 frames de tela** capturados
- **~2.8 MB de transcrição integral** (~700k palavras, todas pesquisáveis via grep)
- **7 erros recuperados** — 6 token-limit via split em 2 partes + 1 rate-limit 429 via retry simples
- **7 vídeos bloqueados por YouTube bot detection** — ação pendente do Marcelo (cookies.txt)

## 2. Stats por plataforma

| Plataforma | Total | OK | Pendente | Frames | Transcrições |
|---|---:|---:|---:|---:|---:|
| **chatwoot** ✅ | 6 | 6 | 0 | 222 | 36 KB |
| **whaticket** ✅ | 10 | 10 | 0 | 241 | 44 KB |
| **pressticket** ✅ | 18 | 18 | 0 | 736 | 160 KB |
| **zaapy** ✅ | 29 | 29 | 0 | 1170 | 256 KB |
| **digisac** 🏁 | 70 | 63 | 7 (YT-bot) | 4104 | 2092 KB |
| **TOTAL** | **133** | **126** | **7** | **6473** | **2588 KB** |

## 3. Erros tratados

### 3a. Token-limit (400 INVALID_ARGUMENT) — 6 vídeos ✅

Vídeos longos (60-68min) que estouraram o limite de 1M tokens do Gemini em chamada única. Resolvidos via `retry_split.py`: split do MP4 em 2 metades via ffmpeg (`-ss 0 -t dur/2` e `-ss dur/2`), upload Gemini local de cada parte, concatenação de transcrições com marcadores `[PARTE A]`/`[PARTE B]`, timestamps da parte B com offset `+dur/2` aplicado, extração de frames no MP4 completo com timestamps ajustados, README único.

| Vid | Título | Duração | Frames |
|---|---|---:|---:|
| Swtnf_rwy5I | IMPLANTAÇÃO DIGISAC | 66.0min | 187 |
| XH4-eqZhz0A | TREINAMENTO DIGISAC – FERRAMENTAS AUXILIARES | 68.3min | 363 |
| CkOCBEhlBj4 | Principais Novidades de Fevereiro | 67.9min | 81 |
| Qh51819F_ms | Funcionalidades mais Utilizadas da Digisac | 59.7min | 140 |
| kXVQNo06li4 | Feedback e dados para melhorar campanhas | 63.8min | 88 |
| RaQgXSZicls | Caixa de Entrada #8 — IA no dia a dia empresarial | 67.0min | 125 |

**Total frames via retry_split**: 984

### 3b. Rate-limit (429 RESOURCE_EXHAUSTED) — 1 vídeo ✅

- `pressticket/MrQsFoiuNzI` — 15 Remarketing → resolvido no 2º attempt (sem concorrência Gemini). **28 frames**.

## 4. Pendências: YouTube bot detection (7 vídeos)

7 vídeos receberam `Sign in to confirm you're not a bot` do YouTube durante `yt-dlp` (provavelmente por volume de downloads seguidos na mesma sessão IP/fingerprint). Precisam **cookies.txt** de sessão logada do Chrome do Marcelo.

### Vídeos pendentes

| Vid | Título |
|---|---|
| jA8NuQtwL5s | Caixa de Entrada #6 — Futuro da experiência do cliente |
| pvGe3EJvw5o | Caixa de Entrada #5 — Transformação digital jurídico |
| 0IHSdW0sOs0 | Caixa de Entrada #4 — Segredos do Marketing no WhatsApp |
| bvwV6P--m9U | Caixa de Entrada #3 — Gestão do pequeno negócio |
| Ts5LJUbWNTA | Caixa de Entrada #2 — Customer Success e Experience |
| nhxI-8oUzeY | Caixa de Entrada #1 — Análise de Dados |
| USwNQSVfeqc | Como Habilitar Número na API Oficial do WhatsApp em 5 Passos |

### Como resolver (Marcelo)

1. **Instalar extensão** "Get cookies.txt LOCALLY" no Chrome onde você está logado no YouTube.
2. **Abrir youtube.com** em uma aba, clicar no ícone da extensão → "Export as cookies.txt".
3. **Salvar** em `~/.config/youtube-learn/cookies.txt`:
   ```bash
   mkdir -p ~/.config/youtube-learn
   # (mova o arquivo baixado para ~/.config/youtube-learn/cookies.txt)
   chmod 600 ~/.config/youtube-learn/cookies.txt
   ```
4. **Re-rodar** (idempotente — pulará os 63 digisac já processados):
   ```bash
   cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo/docs/research/nexvy-outrossaas
   set -a && source ~/.config/youtube-learn/.env && set +a
   export YT_DLP_COOKIES="$HOME/.config/youtube-learn/cookies.txt"
   ~/.venvs/youtube-learn/bin/python3 process_platform.py digisac
   ```
5. Se algum dos 7 também estourar token-limit depois do download, adicionar à lista em `retry_split.py` e rodar:
   ```bash
   ~/.venvs/youtube-learn/bin/python3 retry_split.py
   ```

> **Alternativa rápida**: aceitar **94.7% de cobertura** (126/133) e seguir para análise. Os 7 pendentes são majoritariamente podcasts "Caixa de Entrada" da Digisac — conteúdo conceitual, não demos de produto. O benchmark funcional está completo.

## 5. Estrutura de saída

```
nexvy-outrossaas/
├── RELATORIO-FINAL.md               ← este arquivo
├── INDEX.md                         ← índice global (gerado pelo worker principal)
├── 00-video-list.md                 ← lista bruta de URLs agrupada por plataforma
├── process_videos.py                ← pipeline base (download + Gemini + frames + README)
├── process_platform.py              ← worker parameterizado por plataforma (CLI)
├── retry_split.py                   ← retry para vídeos token-limit (split em 2 partes)
├── run-{plataforma}.log             ← log de cada worker
├── run-retry-split.log.*            ← logs de retries
├── chatwoot/                        ← 6 vídeos
│   ├── INDEX.md
│   └── <videoid>/
│       ├── README.md                ← frames com timestamps e descrições
│       ├── transcricao.txt          ← transcrição integral [MM:SS]
│       ├── timestamps.txt           ← bruto de timestamps
│       └── frame_XXX_MM-SS.jpg      ← screenshots de tela
├── digisac/                         ← 63 vídeos + 7 pendentes
├── pressticket/                     ← 18 vídeos
├── whaticket/                       ← 10 vídeos
└── zaapy/                           ← 29 vídeos
```

## 6. Uso em disco

| Categoria | Tamanho |
|---|---:|
| Total `nexvy-outrossaas/` | **567 MB** |
| Transcrições + timestamps | 2.6 MB |
| Screenshots (JPG 1280×720) | ~500 MB |
| MP4s residuais em `_videos/` | ~62 MB (só info.json + 2 MP4s dos YT-bot que baixaram parcial) |
| Disco livre no sistema | **8.6 GB** (96% usado — +4.4 GB recuperados com cleanup) |

> O pipeline usa **delete-after-frames**: MP4 removido automaticamente após extração de frames. Economiza ~80MB/vídeo. Sem essa mudança, o benchmark teria consumido ~10 GB.

## 7. Workflow técnico reutilizável

Este pipeline agora é **padrão para benchmarks de vídeo YouTube** no monorepo (complementa `docs/research/nexvy-whitelabel/` e `crm-pipedrive-benchmark`):

1. **Lista curada** (`00-video-list.md`) agrupada por plataforma/categoria
2. **Workers paralelos** (`process_platform.py <plataforma>`) — 1 por plataforma, isolados por pasta `_videos` → **ganho 4-5x de velocidade**
3. **Idempotência**: cada vídeo verifica `README.md` no início; se existe com >300B, pula
4. **Cleanup**: MP4 deletado após frames extraídos (economia de ~80MB/vid)
5. **Fallbacks automáticos**:
   - 429 rate-limit → backoff exponencial (6 tentativas, 15s→180s)
   - 403 permission_denied (Gemini URL-mode) → upload local do MP4
   - 400 token-limit → script de retry_split dedicado (split em 2 partes)
   - yt-dlp bot detection → env var `YT_DLP_COOKIES` aponta para cookies.txt exportado
6. **Retry paralelo cuidadoso**: workers concorrentes podem estressar a API Gemini; em retries pesados (uploads >100MB), melhor sequencial.

## 8. Próximos passos sugeridos

### 8a. Consumir o benchmark
- **Leitura rápida por plataforma**: abrir `{plataforma}/INDEX.md` → ver frames relevantes de cada vídeo
- **Busca por tema** (ex. "Kanban", "automação", "bot", "IA", "permissões", "campanha"):
  ```bash
  cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo/docs/research/nexvy-outrossaas
  grep -l "kanban" -r */*/transcricao.txt -i
  grep -l "IA" -r */*/transcricao.txt -i | head -20
  ```
- **Síntese por tópico**: usar Claudinho/Gemini com as transcrições agrupadas por tema

### 8b. Áreas prioritárias para sintetizar
Baseado no volume de conteúdo encontrado:

1. **Bots / chatbot flow** — Digisac, Zaapy, Pressticket (≥15 vídeos combinados dedicados ao tema)
2. **Distribuição de chamados / Filas** — Digisac, Whaticket, Zaapy, Pressticket
3. **Permissões / Cargos / Usuários** — todas as 5 plataformas têm vídeos dedicados
4. **Kanban / CRM / Funil de Vendas** — Zaapy, Whaticket, Pressticket, Digisac
5. **Respostas rápidas + Tags / Etiquetas** — todas
6. **IA / Assistente de IA / Agentes IA** — Digisac (3+ vídeos), Zaapy, Pressticket
7. **WABA (WhatsApp Business API)** — Digisac tem 6+ vídeos dedicados + Habilitar em 5 Passos (pendente YT-bot)
8. **Campanhas / Disparos em massa / Remarketing** — Zaapy, Digisac, Pressticket
9. **Relatórios / Dashboards / NPS / CSAT** — Digisac, Zaapy, Pressticket, Whaticket
10. **Chat interno / Colaboração entre atendentes** — Digisac, Zaapy
11. **Integrações / Webhooks / API / n8n** — Digisac, Chatwoot, Zaapy
12. **Agendamento de mensagens** — Whaticket, Pressticket, Digisac
13. **Grupos de WhatsApp** — Zaapy, Digisac
14. **Protocolos de atendimento** — Digisac

### 8c. Comparar com benchmark Nexvy anterior
Cruzar com `docs/research/nexvy-whitelabel/` (58 vídeos processados em 2026-04-20) para identificar:
- **Gaps de paridade** (features que todos têm e Nexvy não)
- **Diferenciais** do Nexvy
- **Oportunidades** (features que só 1-2 concorrentes têm)

### 8d. Alinhar com plano atendimento FIC
Este benchmark alimenta as sprints `S10..S13` de `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md`. Priorizar validação de:
- Features Nexvy já contempladas (~12.6% segundo memória)
- Gaps críticos para atingir meta de 85% após S10

---

## 9. Timeline

| Evento | Tempo |
|---|---|
| Pipeline iniciado (sequencial) | 2026-04-22 00:47 |
| Disco estourou (35 vídeos) | 2026-04-22 01:16 |
| Pipeline retomado com delete-after-frames | 2026-04-22 22:31 |
| Paralelização com 5 workers (um por plataforma) | 2026-04-22 23:35 |
| chatwoot ✅, whaticket ✅ concluídos | 2026-04-22 23:55 |
| pressticket ✅ concluído | 2026-04-23 00:20 |
| zaapy ✅ concluído | 2026-04-23 00:30 |
| digisac ✅ principal concluído (58/70) | 2026-04-23 01:10 |
| retry_split completo (6/6 token-limit) | 2026-04-23 02:20 |
| **Relatório Final** | **2026-04-23 02:25** |

**Duração total de processamento**: ~6h ativas (distribuídas em 2 janelas separadas por gap de disco).

---

*Gerado pelo skill `youtube-learn`. Scripts reutilizáveis: `process_videos.py`, `process_platform.py`, `retry_split.py`.*
