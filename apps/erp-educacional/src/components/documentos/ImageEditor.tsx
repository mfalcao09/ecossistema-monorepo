"use client";

// ============================================================
// EDITOR DE IMAGEM — Tipo Adobe Scan
// Trata fotos de documentos antes de converter para PDF/A
//
// Funcionalidades:
// - Crop (recorte retangular)
// - Rotação (90° CW/CCW)
// - Brilho e Contraste
// - Filtros (original, P&B, escala de cinza, alto contraste)
// - Preview em tempo real via Canvas
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import {
  RotateCcw, RotateCw, Crop, Sun, Contrast,
  Maximize2, Download, Undo2, Check, X,
  ZoomIn, ZoomOut, Palette,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────

type FiltroTipo = "original" | "pb" | "cinza" | "alto_contraste";

interface ImageEditorProps {
  /** URL ou base64 da imagem original */
  src: string;
  /** Callback ao confirmar edição — retorna blob da imagem editada */
  onSave: (blob: Blob, filename: string) => void;
  /** Callback ao cancelar */
  onCancel: () => void;
  /** Nome do arquivo original */
  filename?: string;
}

interface EditorState {
  rotacao: number;       // 0, 90, 180, 270
  brilho: number;        // -100 a 100 (0 = normal)
  contraste: number;     // -100 a 100 (0 = normal)
  filtro: FiltroTipo;
  cropMode: boolean;
  crop: { x: number; y: number; w: number; h: number } | null;
}

const FILTROS: { id: FiltroTipo; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "cinza", label: "Cinza" },
  { id: "pb", label: "P&B" },
  { id: "alto_contraste", label: "Alto contraste" },
];

// ── Componente ─────────────────────────────────────────────

export default function ImageEditor({ src, onSave, onCancel, filename = "documento.jpg" }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState<EditorState>({
    rotacao: 0,
    brilho: 0,
    contraste: 0,
    filtro: "original",
    cropMode: false,
    crop: null,
  });
  const [zoom, setZoom] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Crop drag state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Carregar imagem
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = src;
  }, [src]);

  // Renderizar canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isRotated = state.rotacao === 90 || state.rotacao === 270;
    const drawW = isRotated ? img.naturalHeight : img.naturalWidth;
    const drawH = isRotated ? img.naturalWidth : img.naturalHeight;

    canvas.width = drawW;
    canvas.height = drawH;

    ctx.clearRect(0, 0, drawW, drawH);
    ctx.save();

    // Rotação
    ctx.translate(drawW / 2, drawH / 2);
    ctx.rotate((state.rotacao * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    // Aplicar filtros via manipulação de pixels
    if (state.brilho !== 0 || state.contraste !== 0 || state.filtro !== "original") {
      const imageData = ctx.getImageData(0, 0, drawW, drawH);
      const data = imageData.data;

      const brilhoFator = state.brilho * 2.55; // -255 a +255
      const contrasteFator = (259 * (state.contraste + 255)) / (255 * (259 - state.contraste));

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Brilho
        r += brilhoFator;
        g += brilhoFator;
        b += brilhoFator;

        // Contraste
        r = contrasteFator * (r - 128) + 128;
        g = contrasteFator * (g - 128) + 128;
        b = contrasteFator * (b - 128) + 128;

        // Filtros
        switch (state.filtro) {
          case "cinza": {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray;
            break;
          }
          case "pb": {
            const gray2 = 0.299 * r + 0.587 * g + 0.114 * b;
            const bw = gray2 > 128 ? 255 : 0;
            r = g = b = bw;
            break;
          }
          case "alto_contraste": {
            const gray3 = 0.299 * r + 0.587 * g + 0.114 * b;
            // Limiar adaptativo
            r = gray3 > 100 ? 255 : 0;
            g = gray3 > 100 ? 255 : 0;
            b = gray3 > 100 ? 255 : 0;
            break;
          }
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imageData, 0, 0);
    }

    // Desenhar área de crop
    if (state.cropMode && state.crop) {
      ctx.save();
      // Overlay escura
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, drawW, drawH);
      // Limpar área de crop
      ctx.clearRect(state.crop.x, state.crop.y, state.crop.w, state.crop.h);
      // Re-draw a imagem no crop
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = drawW;
      tempCanvas.height = drawH;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(canvas, 0, 0);
      // Isso é um shortcut — o ideal seria re-renderizar, mas para UX ok
      ctx.restore();
      // Borda do crop
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(state.crop.x, state.crop.y, state.crop.w, state.crop.h);
    }
  }, [state, imgLoaded]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ── Handlers ──

  const rotacionar = (direcao: "cw" | "ccw") => {
    setState(prev => ({
      ...prev,
      rotacao: (prev.rotacao + (direcao === "cw" ? 90 : -90) + 360) % 360,
    }));
  };

  const resetar = () => {
    setState({
      rotacao: 0,
      brilho: 0,
      contraste: 0,
      filtro: "original",
      cropMode: false,
      crop: null,
    });
    setZoom(1);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!state.cropMode) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setDragStart({ x, y });
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !state.cropMode) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setState(prev => ({
      ...prev,
      crop: {
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        w: Math.abs(x - dragStart.x),
        h: Math.abs(y - dragStart.y),
      },
    }));
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const aplicarCrop = () => {
    if (!state.crop || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const { x, y, w, h } = state.crop;

    // Extrair recorte
    const cropData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(cropData, 0, 0);

    // Atualizar imgRef para a imagem recortada
    const tempImg = new Image();
    tempImg.src = canvas.toDataURL("image/png");
    tempImg.onload = () => {
      imgRef.current = tempImg;
      setState(prev => ({ ...prev, cropMode: false, crop: null }));
    };
  };

  const salvar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const ext = filename.split(".").pop() ?? "jpg";
        const nome = filename.replace(`.${ext}`, `_editado.${ext}`);
        onSave(blob, nome);
      }
    }, "image/jpeg", 0.92);
  };

  if (!imgLoaded) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-2xl">
        <div className="animate-pulse text-gray-400 text-sm">Carregando imagem...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Toolbar superior */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <button onClick={() => rotacionar("ccw")} className="p-2 hover:bg-gray-200 rounded-lg transition" title="Rotacionar anti-horário">
            <RotateCcw size={16} className="text-gray-600" />
          </button>
          <button onClick={() => rotacionar("cw")} className="p-2 hover:bg-gray-200 rounded-lg transition" title="Rotacionar horário">
            <RotateCw size={16} className="text-gray-600" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={() => setState(prev => ({ ...prev, cropMode: !prev.cropMode, crop: null }))}
            className={`p-2 rounded-lg transition ${state.cropMode ? "bg-blue-100 text-blue-600" : "hover:bg-gray-200 text-gray-600"}`}
            title="Modo recorte"
          >
            <Crop size={16} />
          </button>

          {state.cropMode && state.crop && (
            <button onClick={aplicarCrop} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition" title="Aplicar recorte">
              <Check size={16} />
            </button>
          )}

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Zoom in"
          >
            <ZoomIn size={16} className="text-gray-600" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Zoom out"
          >
            <ZoomOut size={16} className="text-gray-600" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Tamanho real"
          >
            <Maximize2 size={16} className="text-gray-600" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button onClick={resetar} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-500" title="Resetar tudo">
            <Undo2 size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition flex items-center gap-1.5"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            onClick={salvar}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5"
          >
            <Download size={14} /> Salvar
          </button>
        </div>
      </div>

      {/* Canvas + controles laterais */}
      <div className="flex">
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-900/5 p-4 flex items-center justify-center" style={{ minHeight: 400, maxHeight: 600 }}>
          <canvas
            ref={canvasRef}
            className="shadow-lg rounded-lg bg-white"
            style={{
              maxWidth: "100%",
              maxHeight: 560,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              cursor: state.cropMode ? "crosshair" : "default",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Painel de ajustes */}
        <div className="w-56 border-l border-gray-100 bg-white p-4 space-y-5">
          {/* Brilho */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
              <Sun size={13} /> Brilho
              <span className="ml-auto text-gray-400 font-normal">{state.brilho}</span>
            </label>
            <input
              type="range"
              min={-100}
              max={100}
              value={state.brilho}
              onChange={e => setState(prev => ({ ...prev, brilho: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Contraste */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
              <Contrast size={13} /> Contraste
              <span className="ml-auto text-gray-400 font-normal">{state.contraste}</span>
            </label>
            <input
              type="range"
              min={-100}
              max={100}
              value={state.contraste}
              onChange={e => setState(prev => ({ ...prev, contraste: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Filtros */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
              <Palette size={13} /> Filtro
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FILTROS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setState(prev => ({ ...prev, filtro: f.id }))}
                  className={`px-2 py-1.5 text-[10px] font-medium rounded-lg border transition ${
                    state.filtro === f.id
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Ajuste a imagem antes de converter para PDF/A. O filtro "P&B" é recomendado para documentos com texto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
