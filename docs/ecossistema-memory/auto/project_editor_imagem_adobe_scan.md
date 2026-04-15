---
name: project_editor_imagem_adobe_scan
description: Editor de imagem tipo Adobe Scan para tratamento digital de fotos de documentos antes de converter para PDF/A
type: project
---

Marcelo quer um editor de imagem integrado ao sistema, inspirado no Adobe Scan (referência: vídeo de screen recording de 29/03/2026).

Funcionalidades desejadas:
- Corte automático (detecção de bordas)
- Correção de perspectiva (deskew)
- Filtros (cor original, cor automática, escala de cinza, P&B alto contraste)
- Sliders de brilho e contraste
- Borracha mágica (remover sombras) — futuro
- Rotação
- Preview antes de salvar

**Why:** Documentos que são fotos de documento físico precisam de tratamento antes de virar PDF/A para o acervo acadêmico e envio à registradora.

**How to apply:** Implementar como componente React com Canvas API (preview instantâneo) + backend Sharp/ImageMagick (processamento final). MVP = crop + deskew + filtros + brilho/contraste. Nível 2 = borracha mágica + OCR.
