---
name: Editor de imagem tipo Adobe Scan
description: Editor de imagem tipo Adobe Scan
type: project
project: erp
tags: ["editor", "imagem", "pdf", "canvas"]
success_score: 0.78
supabase_id: 6d12259f-bae8-4f7c-8ff1-8b60511f0597
created_at: 2026-04-13 09:25:18.754153+00
updated_at: 2026-04-13 19:06:18.037171+00
---

Editor integrado para tratamento de fotos de documentos antes de converter para PDF/A. Funcionalidades: corte automático (detecção bordas), correção perspectiva (deskew), filtros (cor original/automática/cinza/P&B alto contraste), sliders brilho/contraste, rotação, preview. Futuro: borracha mágica (remover sombras). Why: documentos físicos fotografados precisam de tratamento antes do acervo acadêmico + envio registradora. How to apply: React Canvas API para preview instantâneo + backend Sharp/ImageMagick processamento final. MVP = crop+deskew+filtros+brilho. Nível 2 = borracha mágica + OCR.
