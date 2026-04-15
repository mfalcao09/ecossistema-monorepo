# Plano de Ação — Integração com Scanner (USB + Rede)

> ERP Educacional FIC — Módulo Pessoas / Documentos
> Data: 05/04/2026 | Autor: Claude (Arquiteto) + Pesquisa técnica

---

## Visão Geral

Integrar detecção e digitalização de documentos diretamente no navegador, suportando:
- **Scanners USB** → via WebUSB API + sane-wasm (WebAssembly)
- **Scanners de Rede** → via protocolo eSCL/AirScan (HTTP) com proxy no backend

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Chrome/Edge)               │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ ScannerPanel │───►│  ScannerManager (TypeScript)  │   │
│  │ (React UI)   │    │                               │   │
│  └──────────────┘    │  ┌─────────┐  ┌───────────┐  │   │
│                      │  │USB Mode │  │Network Mode│  │   │
│                      │  │WebUSB + │  │eSCL via    │  │   │
│                      │  │sane-wasm│  │API proxy   │  │   │
│                      │  └────┬────┘  └─────┬──────┘  │   │
│                      └───────┼─────────────┼─────────┘   │
│                              │             │              │
└──────────────────────────────┼─────────────┼──────────────┘
                               │             │
                    USB direto │             │ HTTP
                    (browser)  │             │
                               ▼             ▼
                        ┌──────────┐  ┌─────────────────┐
                        │ Scanner  │  │ Next.js API      │
                        │ USB      │  │ /api/scanner/*   │
                        │ (físico) │  │   ↓               │
                        └──────────┘  │ HTTP GET/POST     │
                                      │   ↓               │
                                      │ Scanner de Rede   │
                                      │ (192.168.x.x)     │
                                      └─────────────────┘
```

---

## Fase 1: Scanner USB via WebUSB + sane-wasm

### O que é
O projeto **sane-wasm** compila a biblioteca SANE (Scanner Access Now Easy — padrão Linux) para WebAssembly. Isso permite que o navegador acesse scanners USB diretamente, sem instalar drivers ou programas.

### Como funciona (passo a passo)
1. Usuário clica em "Detectar Scanner USB"
2. Navegador abre popup pedindo permissão para acessar dispositivo USB
3. Usuário seleciona o scanner na lista
4. sane-wasm (WASM) se comunica com o scanner via WebUSB
5. Scanner digitaliza e retorna imagem (JPEG/PNG)
6. Imagem aparece na tela para revisão/upload

### Compatibilidade
| Item | Suporte |
|------|---------|
| Chrome 61+ | ✅ Funciona |
| Edge (Chromium) | ✅ Funciona |
| Firefox | ❌ Não suporta WebUSB |
| Safari | ❌ Não suporta WebUSB |
| Windows | ✅ (pode precisar driver WinUSB via Zadig) |
| macOS | ✅ Funciona |
| Linux | ✅ (precisa regras udev) |

### Scanners suportados (via sane-wasm)
- Epson (maioria dos modelos USB)
- Canon (CanoScan série)
- HP (ScanJet série)
- Brother (DCP, MFC série)
- Xerox
- Fujitsu (ScanSnap)
- ~30+ modelos testados

### Implementação técnica

**Dependência:**
```bash
npm install sane-wasm
```

**Componente React:**
```typescript
// src/components/scanner/USBScanner.tsx
import { useState } from 'react'

export function USBScanner({ onScanComplete }: { onScanComplete: (image: Blob) => void }) {
  const [status, setStatus] = useState<'idle' | 'detecting' | 'scanning' | 'done'>('idle')
  const [device, setDevice] = useState<string | null>(null)

  async function detectarScanner() {
    setStatus('detecting')
    // Importar sane-wasm dinamicamente (é pesado ~2MB)
    const sane = await import('sane-wasm')
    await sane.init()

    // Lista dispositivos USB disponíveis
    const devices = await sane.getDevices()
    if (devices.length > 0) {
      setDevice(devices[0].name)
      setStatus('idle')
    }
  }

  async function digitalizar() {
    setStatus('scanning')
    const sane = await import('sane-wasm')

    // Abrir dispositivo e configurar
    const handle = await sane.open(device!)
    await sane.setOption(handle, 'resolution', 300) // 300 DPI
    await sane.setOption(handle, 'mode', 'Color')   // Colorido

    // Iniciar digitalização
    const imageData = await sane.scan(handle)

    // Converter para Blob
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) onScanComplete(blob)
      setStatus('done')
    }, 'image/jpeg', 0.95)

    await sane.close(handle)
  }

  return (/* UI do scanner */)
}
```

### Estimativa: 2-3 dias de desenvolvimento

---

## Fase 2: Scanner de Rede via eSCL (AirScan)

### O que é
eSCL (Everywhere Scan) é um protocolo HTTP padrão da Mopria Alliance. Scanners de rede modernos (impressoras multifuncionais) expõem uma API REST na rede local. Funciona como uma API web — você faz GET/POST para o IP do scanner.

### Como funciona (passo a passo)
1. Usuário clica em "Detectar Scanner de Rede"
2. Opção A: Usuário digita o IP do scanner manualmente (ex: 192.168.1.100)
3. Opção B: Backend faz descoberta automática via mDNS/Bonjour
4. Frontend chama `/api/scanner/capabilities?ip=192.168.1.100`
5. Backend faz proxy HTTP para o scanner e retorna capacidades (resoluções, modos)
6. Usuário configura e clica "Digitalizar"
7. Backend envia comando de scan via eSCL e retorna a imagem

### Por que precisa de proxy no backend?
O navegador NÃO PODE chamar `http://192.168.1.100` diretamente por causa de:
- **CORS**: Scanner não envia headers `Access-Control-Allow-Origin`
- **Private Network Access**: Chrome bloqueia chamadas de sites HTTPS para IPs locais

Solução: Next.js API Routes fazem o proxy.

### Compatibilidade de Scanners
| Fabricante | Suporte eSCL | Modelos comuns |
|------------|-------------|----------------|
| HP | ✅ Excelente | LaserJet, OfficeJet, DeskJet (maioria pós-2015) |
| Canon | ✅ Bom | imageRUNNER, PIXMA série |
| Epson | ✅ Bom | WorkForce, EcoTank série |
| Brother | ✅ Bom | DCP, MFC série (rede) |
| Xerox | ✅ Bom | VersaLink, AltaLink |
| Ricoh | ✅ Bom | IM serie, MP serie |
| Samsung | ✅ Bom | Xpress, MultiXpress |

### Endpoints eSCL (API do scanner)
```
GET  http://{IP}:9095/eSCL/ScannerCapabilities
     → Retorna XML com resoluções, modos de cor, tamanhos de papel

GET  http://{IP}:9095/eSCL/ScannerStatus
     → Retorna status (idle, scanning, processing)

POST http://{IP}:9095/eSCL/ScanJobs
     → Envia configuração XML de digitalização
     → Retorna 201 Created + Location header com URL do job

GET  http://{IP}:9095/eSCL/ScanJobs/{jobId}/NextDocument
     → Retorna imagem digitalizada (JPEG/PDF)

DELETE http://{IP}:9095/eSCL/ScanJobs/{jobId}
     → Cancela job de digitalização
```

### Implementação técnica

**API Route — Descobrir capacidades:**
```typescript
// src/app/api/scanner/capabilities/route.ts
export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'IP obrigatório' }, { status: 400 })

  // Validar que é IP local (segurança)
  if (!isPrivateIP(ip)) {
    return NextResponse.json({ error: 'Apenas IPs de rede local' }, { status: 403 })
  }

  const res = await fetch(`http://${ip}:9095/eSCL/ScannerCapabilities`, {
    signal: AbortSignal.timeout(5000) // timeout 5s
  })

  const xml = await res.text()
  // Parsear XML e retornar JSON
  return NextResponse.json(parseCapabilities(xml))
}
```

**API Route — Executar digitalização:**
```typescript
// src/app/api/scanner/scan/route.ts
export async function POST(req: NextRequest) {
  const { ip, resolution, colorMode, format } = await req.json()

  // 1. Criar job de scan
  const scanSettings = buildScanSettingsXML({ resolution, colorMode, format })
  const jobRes = await fetch(`http://${ip}:9095/eSCL/ScanJobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: scanSettings
  })

  const jobUrl = jobRes.headers.get('Location')

  // 2. Buscar documento digitalizado
  const docRes = await fetch(`${jobUrl}/NextDocument`)
  const imageBuffer = await docRes.arrayBuffer()

  return new NextResponse(imageBuffer, {
    headers: { 'Content-Type': 'image/jpeg' }
  })
}
```

### Estimativa: 3-4 dias de desenvolvimento

---

## Fase 3: UI Unificada — ScannerPanel

### Design do componente

```
┌─────────────────────────────────────────────┐
│  📡 Digitalizar Documento                    │
│                                              │
│  ┌─────────────────┐ ┌───────────────────┐  │
│  │  🔌 USB         │ │  🌐 Rede          │  │
│  │  Scanner local   │ │  Scanner de rede  │  │
│  └─────────────────┘ └───────────────────┘  │
│                                              │
│  Scanner detectado: HP ScanJet Pro 2500 ✅   │
│                                              │
│  Resolução: [300 DPI ▼]                     │
│  Modo:      [Colorido ▼]                    │
│  Formato:   [JPEG ▼]                        │
│                                              │
│  [    🔍 Digitalizar Documento    ]          │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │         Preview da imagem            │   │
│  │         digitalizada                 │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [ Usar este documento ] [ Digitalizar outro]│
└─────────────────────────────────────────────┘
```

### Estimativa: 2 dias de desenvolvimento

---

## Fase 4: Descoberta automática de scanners de rede (mDNS)

### O problema
mDNS/Bonjour é protocolo UDP multicast. O navegador NÃO tem acesso a UDP. A descoberta automática precisa rodar no servidor.

### Opções de implementação

**Opção A: Supabase Edge Function (recomendada)**
- Edge Function roda na mesma rede? NÃO — roda na nuvem
- ❌ Não funciona para descobrir scanners na rede local

**Opção B: API Route com instrução manual**
- Usuário digita IP do scanner (ex: 192.168.1.100)
- Backend testa se o scanner responde em /eSCL/ScannerCapabilities
- ✅ Simples e funciona

**Opção C: Script Node.js local (futuro)**
- Instalar script na rede da FIC que faz mDNS scan
- Registra scanners encontrados no Supabase
- ✅ Descoberta automática real, mas precisa de infra

### Recomendação: começar com Opção B (manual) e evoluir para C

---

## Cronograma de Implementação

| Sprint | O quê | Prazo | Dificuldade |
|--------|-------|-------|-------------|
| **S1** | Correção bug duplicação + ScannerManager base | 1 dia | Fácil |
| **S2** | USB Scanner via sane-wasm | 2-3 dias | Média |
| **S3** | Network Scanner via eSCL (proxy + API) | 3-4 dias | Média |
| **S4** | UI unificada ScannerPanel + integração com DocumentUploader | 2 dias | Fácil |
| **S5** | Descoberta automática mDNS (opcional) | 2-3 dias | Alta |
| **Total** | | **10-13 dias** | |

---

## Arquivos a criar

```
src/
├── components/
│   └── scanner/
│       ├── ScannerPanel.tsx          ← UI principal (abas USB/Rede)
│       ├── USBScanner.tsx            ← Lógica WebUSB + sane-wasm
│       ├── NetworkScanner.tsx        ← Lógica eSCL via API
│       ├── ScanPreview.tsx           ← Preview + crop da imagem
│       └── ScannerManager.ts         ← Classe abstrata (USB + Rede)
├── app/
│   └── api/
│       └── scanner/
│           ├── capabilities/route.ts  ← GET capacidades do scanner
│           ├── scan/route.ts          ← POST executar digitalização
│           ├── status/route.ts        ← GET status do scanner
│           └── discover/route.ts      ← GET descobrir scanners (futuro)
├── lib/
│   └── scanner/
│       ├── escl-client.ts            ← Cliente eSCL (parsear XML, etc.)
│       ├── escl-types.ts             ← Tipos TypeScript do eSCL
│       └── ip-validator.ts           ← Validação de IPs privados
└── types/
    └── scanner.ts                    ← Tipos compartilhados
```

---

## Dependências npm

```json
{
  "sane-wasm": "^x.x.x",      // WebUSB + SANE (scanner USB)
  "fast-xml-parser": "^4.x.x"  // Parsear XML do eSCL
}
```

---

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Scanner USB não compatível com sane-wasm | Média | Fallback para upload manual |
| Scanner de rede sem eSCL | Baixa | A maioria dos MFPs modernos suporta |
| CORS/PNA bloqueando requests | Alta | Já resolvido com proxy backend |
| sane-wasm pesado (~2MB) | Baixa | Lazy load (import dinâmico) |
| Usuário usando Firefox/Safari | Média | Mostrar aviso "Use Chrome para scanner USB" |
| Vercel não alcança rede local | Alta | eSCL proxy só funciona em dev local ou VPN |

### ⚠️ Ponto crítico: Vercel vs Rede Local
O backend roda na **Vercel (nuvem)**. Ele NÃO TEM acesso à rede local da FIC (192.168.x.x).

**Soluções:**
1. **Scanner USB**: Funciona 100% no navegador (WebUSB), sem depender do backend
2. **Scanner de Rede**: Precisa de uma das opções:
   - A) Rodar Next.js em servidor local da FIC (não na Vercel)
   - B) Instalar um micro-serviço bridge na rede da FIC
   - C) Usar Cloudflare Tunnel ou Tailscale para expor scanner
   - D) Proxy reverso na rede local

---

## Decisões pendentes (para Marcelo)

1. **Scanner USB funciona no navegador direto** — posso implementar já?
2. **Scanner de Rede**: qual abordagem de infra preferir? (A, B, C ou D acima)
3. **Qual scanner a FIC usa?** (marca/modelo) — para testar compatibilidade
4. **Prioridade**: implementar USB primeiro (mais simples) e rede depois?
