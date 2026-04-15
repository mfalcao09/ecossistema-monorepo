import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  CADElement,
  CADLayer,
  CADSettings,
  CADTool,
  CADElementCategory,
  CATEGORY_STYLES,
  CATEGORY_DEFAULT_LAYER,
  DEFAULT_LAYERS,
  DEFAULT_SETTINGS,
} from "@/types/cad";
import {
  computeAreaM2,
  computePerimeterM,
  findSnapVertex,
  formatLength,
  buildSvgPath,
  haversineM,
  midpoint,
  coordsCenter,
} from "@/lib/geoTransform";
import { CADToolbar } from "./CADToolbar";
import { LayerManager } from "./LayerManager";
import { CADSidePanel } from "./CADSidePanel";
import { toast } from "sonner";

// Mapbox types (loaded dynamically)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxMap = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricCanvas = any;

interface CADEditorProps {
  developmentId: string;
  projectId: string;
  projectName: string;
  initialElements: CADElement[];
  initialLayers: CADLayer[];
  initialSettings: CADSettings;
  initialViewport?: { center: [number, number]; zoom: number };
  developmentGeometry?: GeoJSON.Geometry | null;
  onSave: (elements: CADElement[], layers: CADLayer[]) => void;
  saving: boolean;
}

const MAX_UNDO = 50;

export function CADEditor({
  developmentId,
  projectId,
  projectName,
  initialElements,
  initialLayers,
  initialSettings,
  initialViewport,
  developmentGeometry,
  onSave,
  saving,
}: CADEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapboxMap>(null);
  const fabricRef = useRef<FabricCanvas>(null);
  const fabricModule = useRef<typeof import("fabric") | null>(null);

  // State
  const [elements, setElements] = useState<CADElement[]>(initialElements);
  const [layers, setLayers] = useState<CADLayer[]>(
    initialLayers.length > 0 ? initialLayers : DEFAULT_LAYERS
  );
  const [settings] = useState<CADSettings>(initialSettings ?? DEFAULT_SETTINGS);
  const [activeTool, setActiveTool] = useState<CADTool>("select");
  const [activeCategory, setActiveCategory] = useState<CADElementCategory>("lote");
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0]?.id ?? "lotes");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [scaleLabel, setScaleLabel] = useState("—");

  // Drawing state (ref to avoid re-renders during draw)
  const drawingRef = useRef<{
    active: boolean;
    points: [number, number][];
    tempObjects: string[];
  }>({ active: false, points: [], tempObjects: [] });

  // Undo stack
  const undoStack = useRef<CADElement[][]>([initialElements]);
  const undoPointer = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── Undo/Redo helpers ──────────────────────────────────────────────────────
  function pushUndo(newElements: CADElement[]) {
    const stack = undoStack.current.slice(0, undoPointer.current + 1);
    stack.push(newElements);
    if (stack.length > MAX_UNDO) stack.shift();
    undoStack.current = stack;
    undoPointer.current = stack.length - 1;
    setCanUndo(undoPointer.current > 0);
    setCanRedo(false);
  }

  function undo() {
    if (undoPointer.current <= 0) return;
    undoPointer.current--;
    const prev = undoStack.current[undoPointer.current];
    setElements(prev);
    setCanUndo(undoPointer.current > 0);
    setCanRedo(true);
  }

  function redo() {
    if (undoPointer.current >= undoStack.current.length - 1) return;
    undoPointer.current++;
    const next = undoStack.current[undoPointer.current];
    setElements(next);
    setCanUndo(true);
    setCanRedo(undoPointer.current < undoStack.current.length - 1);
  }

  // ── Compute scale label from map ──────────────────────────────────────────
  function updateScaleLabel(map: MapboxMap) {
    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const metersPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);
      const pixels100 = 100;
      const meters = metersPerPx * pixels100;
      setScaleLabel(`100px = ${meters.toFixed(0)}m`);
    } catch {
      // ignore
    }
  }

  // ── Project geo → canvas pixel ────────────────────────────────────────────
  function geoToCanvasPx(map: MapboxMap, [lng, lat]: [number, number]): { x: number; y: number } {
    const px = map.project([lng, lat]);
    return { x: px.x, y: px.y };
  }

  function canvasPxToGeo(map: MapboxMap, x: number, y: number): [number, number] {
    const ll = map.unproject([x, y]);
    return [ll.lng, ll.lat];
  }

  // ── Fabric.js rendering ───────────────────────────────────────────────────
  const renderAll = useCallback((elems: CADElement[], map: MapboxMap, fc: FabricCanvas) => {
    if (!map || !fc) return;
    fc.clear();

    for (const el of elems) {
      const layer = layers.find((l) => l.id === el.layerId);
      if (layer && !layer.visible) continue;

      const style = el.style;
      const pts = el.coordinates.map(([lng, lat]) => geoToCanvasPx(map, [lng, lat]));

      if (pts.length < 2) continue;

      const isSelected = el.id === selectedElementId;
      const strokeWidth = style.strokeWidth + (isSelected ? 1 : 0);

      // ── Draw polygon / line ───────────────────────────────────────────────
      if (el.closed && pts.length >= 3) {
        // Draw filled polygon via SVG path
        const pathStr = buildSvgPath(pts, true);
        const path = new fabricModule.current!.fabric.Path(pathStr, {
          fill: hexToRgba(style.fill, style.fillOpacity),
          stroke: style.stroke,
          strokeWidth,
          selectable: true,
          evented: true,
          objectCaching: false,
          strokeUniform: true,
        });
        (path as Record<string, unknown>).cadId = el.id;
        fc.add(path);

        // Draw dimension labels
        if (settings.showDimensions && el.coordinates.length >= 2) {
          for (let i = 0; i < el.coordinates.length; i++) {
            const next = (i + 1) % el.coordinates.length;
            const lenM = haversineM(el.coordinates[i], el.coordinates[next]);
            if (lenM < 0.5) continue;
            const mid = midpoint(el.coordinates[i], el.coordinates[next]);
            const midPx = geoToCanvasPx(map, mid);
            const label = new fabricModule.current!.fabric.Text(formatLength(lenM), {
              left: midPx.x,
              top: midPx.y,
              fontSize: 10,
              fill: style.stroke,
              backgroundColor: "rgba(255,255,255,0.75)",
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
              objectCaching: false,
            });
            fc.add(label);
          }
        }

        // Element label
        if (el.label) {
          const center = coordsCenter(el.coordinates);
          const cPx = geoToCanvasPx(map, center);
          const text = new fabricModule.current!.fabric.Text(el.label, {
            left: cPx.x,
            top: cPx.y,
            fontSize: 12,
            fontWeight: "bold",
            fill: style.stroke,
            backgroundColor: "rgba(255,255,255,0.85)",
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
            objectCaching: false,
          });
          fc.add(text);
        }
      } else {
        // Polyline / line
        const points = pts.map((p) => ({ x: p.x, y: p.y }));
        const pline = new fabricModule.current!.fabric.Polyline(points, {
          fill: "transparent",
          stroke: style.stroke,
          strokeWidth,
          selectable: true,
          evented: true,
          objectCaching: false,
          strokeUniform: true,
        });
        (pline as Record<string, unknown>).cadId = el.id;
        fc.add(pline);

        if (settings.showDimensions && el.coordinates.length >= 2) {
          for (let i = 0; i < el.coordinates.length - 1; i++) {
            const lenM = haversineM(el.coordinates[i], el.coordinates[i + 1]);
            if (lenM < 0.5) continue;
            const mid = midpoint(el.coordinates[i], el.coordinates[i + 1]);
            const midPx = geoToCanvasPx(map, mid);
            const lbl = new fabricModule.current!.fabric.Text(formatLength(lenM), {
              left: midPx.x,
              top: midPx.y,
              fontSize: 10,
              fill: style.stroke,
              backgroundColor: "rgba(255,255,255,0.75)",
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
              objectCaching: false,
            });
            fc.add(lbl);
          }
        }
      }

      // Selection outline
      if (isSelected) {
        const selPts = el.coordinates.map(([lng, lat]) => geoToCanvasPx(map, [lng, lat]));
        const selPath = buildSvgPath(selPts, el.closed);
        const selObj = new fabricModule.current!.fabric.Path(selPath, {
          fill: "transparent",
          stroke: "#f59e0b",
          strokeWidth: 2,
          strokeDashArray: [6, 3],
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        fc.add(selObj);
        // Vertex handles
        for (const c of el.coordinates) {
          const cpx = geoToCanvasPx(map, c);
          const circle = new fabricModule.current!.fabric.Circle({
            left: cpx.x - 5,
            top: cpx.y - 5,
            radius: 5,
            fill: "#ffffff",
            stroke: "#f59e0b",
            strokeWidth: 2,
            selectable: false,
            evented: false,
            objectCaching: false,
          });
          fc.add(circle);
        }
      }
    }

    fc.requestRenderAll();
  }, [layers, selectedElementId, settings.showDimensions]);

  // ── Init Mapbox + Fabric ──────────────────────────────────────────────────
  useEffect(() => {
    let mapInstance: MapboxMap | null = null;
    let fabricInstance: FabricCanvas | null = null;
    let isMounted = true;

    async function init() {
      const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (!token) return;

      // Load CSS
      if (!document.getElementById("mapbox-css-cad")) {
        const link = document.createElement("link");
        link.id = "mapbox-css-cad";
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      const [mapboxMod, fabricMod] = await Promise.all([
        import("mapbox-gl"),
        import("fabric"),
      ]);

      if (!isMounted || !mapContainerRef.current || !canvasElRef.current) return;

      fabricModule.current = fabricMod;

      const mapboxgl = mapboxMod.default;
      mapboxgl.accessToken = token;

      const center: [number, number] = initialViewport?.center ?? [-47.9292, -22.0056];
      const zoom = initialViewport?.zoom ?? 16;

      mapInstance = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center,
        zoom,
        attributionControl: false,
      });

      mapInstance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapInstance.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");
      mapInstance.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      mapRef.current = mapInstance;

      // Init Fabric.js
      const container = mapContainerRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (canvasElRef.current) {
        canvasElRef.current.width = w;
        canvasElRef.current.height = h;
      }

      fabricInstance = new fabricMod.fabric.Canvas(canvasElRef.current!, {
        selection: false,
        renderOnAddRemove: false,
        skipOffscreen: true,
        preserveObjectStacking: true,
      });
      fabricRef.current = fabricInstance;

      // Map events → re-render Fabric
      mapInstance.on("move", () => {
        if (fabricRef.current && mapRef.current && isMounted) {
          renderAll(elements, mapRef.current, fabricRef.current);
          updateScaleLabel(mapRef.current);
        }
      });

      mapInstance.on("load", () => {
        if (!isMounted) return;
        updateScaleLabel(mapInstance!);

        // Render development boundary if available
        if (developmentGeometry && mapInstance) {
          try {
            mapInstance.addSource("dev-boundary", {
              type: "geojson",
              data: { type: "Feature", geometry: developmentGeometry, properties: {} },
            });
            mapInstance.addLayer({
              id: "dev-boundary-fill",
              type: "fill",
              source: "dev-boundary",
              paint: { "fill-color": "#ffffff", "fill-opacity": 0.05 },
            });
            mapInstance.addLayer({
              id: "dev-boundary-line",
              type: "line",
              source: "dev-boundary",
              paint: { "line-color": "#fbbf24", "line-width": 2, "line-dasharray": [4, 2] },
            });
          } catch {
            // ignore source already exists
          }
        }

        // Initial render
        renderAll(elements, mapInstance!, fabricInstance!);
      });

      // Resize handler
      const observer = new ResizeObserver(() => {
        if (!mapRef.current || !fabricRef.current || !isMounted) return;
        const w2 = container.clientWidth;
        const h2 = container.clientHeight;
        fabricRef.current.setWidth(w2);
        fabricRef.current.setHeight(h2);
        renderAll(elements, mapRef.current, fabricRef.current);
      });
      observer.observe(container);

      // Canvas mouse events
      setupCanvasEvents(fabricInstance, mapInstance, fabricMod);

      return observer;
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render when elements or selection changes
  useEffect(() => {
    if (mapRef.current && fabricRef.current) {
      renderAll(elements, mapRef.current, fabricRef.current);
    }
  }, [elements, renderAll, selectedElementId]);

  // ── Drawing / Selection events ────────────────────────────────────────────
  function setupCanvasEvents(fc: FabricCanvas, map: MapboxMap, fabricMod: typeof import("fabric")) {
    let snapIndicator: typeof fabricMod.fabric.Circle.prototype | null = null;
    const drawing = drawingRef.current;
    let previewLine: typeof fabricMod.fabric.Polyline.prototype | null = null;

    function getSnapPoint(canvasX: number, canvasY: number): [number, number] {
      const rawGeo = canvasPxToGeo(map, canvasX, canvasY);
      if (!settings.snapEnabled) return rawGeo;

      // Collect all existing vertices
      const allVertices: [number, number][] = [];
      for (const el of elements) {
        allVertices.push(...el.coordinates);
      }
      if (drawing.points.length > 0) {
        allVertices.push(...drawing.points);
      }

      const snapped = findSnapVertex(
        rawGeo,
        allVertices,
        settings.snapThreshold,
        (c) => geoToCanvasPx(map, c)
      );

      // Show snap indicator
      if (snapIndicator) {
        fc.remove(snapIndicator);
        snapIndicator = null;
      }
      if (snapped) {
        const spx = geoToCanvasPx(map, snapped);
        snapIndicator = new fabricMod.fabric.Circle({
          left: spx.x - 6,
          top: spx.y - 6,
          radius: 6,
          fill: "transparent",
          stroke: "#f59e0b",
          strokeWidth: 2,
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        fc.add(snapIndicator);
        fc.requestRenderAll();
        return snapped;
      }
      return rawGeo;
    }

    fc.on("mouse:down", (opt: { e: MouseEvent; pointer: { x: number; y: number } }) => {
      const { pointer } = opt;
      const geo = getSnapPoint(pointer.x, pointer.y);

      if (activeTool === "select") {
        const target = fc.findTarget(opt.e) as Record<string, unknown> | undefined;
        if (target?.cadId) {
          setSelectedElementId(target.cadId as string);
        } else {
          setSelectedElementId(null);
        }
        return;
      }

      if (activeTool === "delete") {
        const target = fc.findTarget(opt.e) as Record<string, unknown> | undefined;
        if (target?.cadId) {
          setElements((prev) => {
            const next = prev.filter((e) => e.id !== target.cadId);
            pushUndo(next);
            return next;
          });
        }
        return;
      }

      if (activeTool === "polygon" || activeTool === "line") {
        if (!drawing.active) {
          drawing.active = true;
          drawing.points = [geo];
        } else {
          // Check if closing polygon (click near first point)
          if (activeTool === "polygon" && drawing.points.length >= 3) {
            const firstPx = geoToCanvasPx(map, drawing.points[0]);
            const closeDist = Math.sqrt(
              (pointer.x - firstPx.x) ** 2 + (pointer.y - firstPx.y) ** 2
            );
            if (closeDist < 20) {
              finishDrawing(true);
              return;
            }
          }
          drawing.points.push(geo);
        }
      }
    });

    fc.on("mouse:dblclick", () => {
      if (activeTool === "polygon" && drawing.active && drawing.points.length >= 3) {
        finishDrawing(true);
      } else if (activeTool === "line" && drawing.active && drawing.points.length >= 2) {
        finishDrawing(false);
      }
    });

    fc.on("mouse:move", (opt: { pointer: { x: number; y: number } }) => {
      if (!drawing.active) return;
      const { pointer } = opt;
      getSnapPoint(pointer.x, pointer.y);

      // Update preview line
      if (previewLine) {
        fc.remove(previewLine);
        previewLine = null;
      }
      if (drawing.points.length >= 1) {
        const allPts = [
          ...drawing.points.map(([lng, lat]) => geoToCanvasPx(map, [lng, lat])),
          { x: pointer.x, y: pointer.y },
        ];
        previewLine = new fabricMod.fabric.Polyline(
          allPts.map((p) => ({ x: p.x, y: p.y })),
          {
            fill: "transparent",
            stroke: CATEGORY_STYLES[activeCategory].stroke,
            strokeWidth: 1.5,
            strokeDashArray: [5, 3],
            selectable: false,
            evented: false,
            objectCaching: false,
          }
        );
        fc.add(previewLine);
        fc.requestRenderAll();
      }
    });

    function finishDrawing(closed: boolean) {
      if (previewLine) {
        fabricRef.current?.remove(previewLine);
        previewLine = null;
      }
      if (snapIndicator) {
        fabricRef.current?.remove(snapIndicator);
        snapIndicator = null;
      }

      const coords = drawing.points;
      drawing.active = false;
      drawing.points = [];

      if (coords.length < 2) return;
      if (closed && coords.length < 3) return;

      const style = { ...CATEGORY_STYLES[activeCategory] };
      const area_m2 = closed ? computeAreaM2(coords) : 0;
      const perimeter_m = computePerimeterM(coords, closed);

      const newEl: CADElement = {
        id: crypto.randomUUID(),
        category: activeCategory,
        layerId: CATEGORY_DEFAULT_LAYER[activeCategory] ?? activeLayerId,
        coordinates: coords,
        closed,
        style,
        properties: { area_m2, perimeter_m },
        createdAt: new Date().toISOString(),
      };

      setElements((prev) => {
        const next = [...prev, newEl];
        pushUndo(next);
        return next;
      });
    }
  }

  // ── Tool cursor ───────────────────────────────────────────────────────────
  const cursorStyle = useMemo(() => {
    switch (activeTool) {
      case "select":  return "default";
      case "pan":     return "grab";
      case "line":
      case "polygon": return "crosshair";
      case "delete":  return "not-allowed";
      default:        return "default";
    }
  }, [activeTool]);

  // Mapbox drag: only when pan tool active
  useEffect(() => {
    if (!mapRef.current) return;
    if (activeTool === "pan") {
      mapRef.current.dragPan.enable();
    } else {
      // Allow scroll zoom always, but block drag when drawing
      if (activeTool === "polygon" || activeTool === "line") {
        mapRef.current.dragPan.disable();
      } else {
        mapRef.current.dragPan.enable();
      }
    }
  }, [activeTool]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === "v") setActiveTool("select");
      if (key === " ") { e.preventDefault(); setActiveTool("pan"); }
      if (key === "l") setActiveTool("line");
      if (key === "p") setActiveTool("polygon");
      if (key === "t") setActiveTool("text");
      if (key === "escape") {
        drawingRef.current.active = false;
        drawingRef.current.points = [];
        setActiveTool("select");
      }
      if (key === "delete" || key === "backspace") {
        if (selectedElementId) {
          setElements((prev) => {
            const next = prev.filter((e) => e.id !== selectedElementId);
            pushUndo(next);
            return next;
          });
          setSelectedElementId(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
      }
      if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        onSave(elements, layers);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, layers, selectedElementId, canUndo, canRedo]);

  // ── Layer actions ─────────────────────────────────────────────────────────
  function toggleLayerVisibility(id: string) {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  }
  function toggleLayerLock(id: string) {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  }
  function renameLayer(id: string, name: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  }
  function addLayer() {
    const newLayer: CADLayer = {
      id: crypto.randomUUID(),
      name: `Layer ${layers.length + 1}`,
      color: "#9ca3af",
      visible: true,
      locked: false,
      order: layers.length,
    };
    setLayers((prev) => [...prev, newLayer]);
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* Top toolbar */}
      <CADToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onUndo={undo}
        onRedo={redo}
        onSave={() => onSave(elements, layers)}
        canUndo={canUndo}
        canRedo={canRedo}
        saving={saving}
        projectName={projectName}
        developmentId={developmentId}
      />

      {/* Map + Canvas area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Mapbox map */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
          style={{ cursor: cursorStyle }}
        />

        {/* Fabric.js canvas overlay */}
        <div
          ref={canvasContainerRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            pointerEvents:
              activeTool === "pan" ? "none" : "all",
          }}
        >
          <canvas
            ref={canvasElRef}
            style={{ display: "block", cursor: cursorStyle }}
          />
        </div>

        {/* Crosshair hint during draw */}
        {(activeTool === "polygon" || activeTool === "line") && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
            {activeTool === "polygon"
              ? "Clique para adicionar vértices • Duplo-clique ou clique no 1° ponto para fechar"
              : "Clique para adicionar pontos • Duplo-clique para finalizar"}
          </div>
        )}

        {/* Layer Manager */}
        <LayerManager
          layers={layers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={setActiveLayerId}
          onLayerVisibilityToggle={toggleLayerVisibility}
          onLayerLockToggle={toggleLayerLock}
          onLayerRename={renameLayer}
          onLayerAdd={addLayer}
        />

        {/* Stats panel */}
        <CADSidePanel
          elements={elements}
          totalAreaM2={elements.reduce((s, e) => s + (e.properties.area_m2 ?? 0), 0)}
          scaleLabel={scaleLabel}
        />
      </div>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  if (hex === "transparent") return "transparent";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
