/**
 * TerrainViewer3D.tsx — Visualização 3D do terreno com Three.js
 * Bloco D — Fase 5 do módulo Parcelamento de Solo
 *
 * Renderiza o DEM (Digital Elevation Model) como malha 3D com:
 * - Terrain mesh colorizado por altitude (verde→marrom)
 * - Contorno do lote extrudado sobre o terreno
 * - OrbitControls para navegação 3D
 * - Iluminação ambiente + direcional
 *
 * ⚠️ NÃO usa CapsuleGeometry (introduzido r142, CDN r128)
 * ⚠️ Lazy-loaded no ParcelamentoDetalhe.tsx
 */
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import type {
  ElevationGrid,
  ElevationPoint,
  BoundingBox,
  ParcelamentoDevelopment,
} from "@/lib/parcelamento/types";
import { Loader2, RotateCcw, ZoomIn, ZoomOut, Mountain, Maximize2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte lat/lng do grid em coordenadas locais X/Z (metros relativos ao centro) */
function geoToLocal(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
): [number, number] {
  const R = 6371000; // raio médio da Terra em metros
  const x = (lng - centerLng) * (Math.PI / 180) * R * Math.cos((centerLat * Math.PI) / 180);
  const z = -(lat - centerLat) * (Math.PI / 180) * R; // invertido para Z apontar "norte" → negativo
  return [x, z];
}

/** Interpola cor do terreno baseada na altitude normalizada (0→1) */
function elevationColor(t: number): THREE.Color {
  // Verde baixo → amarelo médio → marrom alto
  const colors = [
    new THREE.Color(0x4caf50), // verde
    new THREE.Color(0x8bc34a), // verde claro
    new THREE.Color(0xcddc39), // lima
    new THREE.Color(0xffeb3b), // amarelo
    new THREE.Color(0xff9800), // laranja
    new THREE.Color(0x795548), // marrom
  ];
  const idx = Math.min(t * (colors.length - 1), colors.length - 1.001);
  const i = Math.floor(idx);
  const frac = idx - i;
  return colors[i].clone().lerp(colors[Math.min(i + 1, colors.length - 1)], frac);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TerrainMeshProps {
  grid: ElevationGrid;
  centerLat: number;
  centerLng: number;
  elevMin: number;
  elevRange: number;
  verticalExaggeration: number;
}

/** Normaliza lat/lng para chave de lookup (fix: Buchecha review — floating point precision) */
const toKey = (lat: number, lng: number) => `${lat.toFixed(6)}_${lng.toFixed(6)}`;

/** Malha 3D do terreno gerada a partir do elevation grid */
function TerrainMesh({
  grid,
  centerLat,
  centerLng,
  elevMin,
  elevRange,
  verticalExaggeration,
}: TerrainMeshProps) {
  const geometry = useMemo(() => {
    const pts = grid.coordinates;
    if (!pts || pts.length < 4) return null;

    // Mapear elevação por lat/lng normalizado para lookup rápido
    const elevMap = new Map<string, number>();
    pts.forEach((p) => elevMap.set(toKey(p.lat, p.lng), p.elevation));

    // Descobrir dimensões do grid (rows × cols) — normalizado via toFixed
    const latSet = new Set<number>();
    const lngSet = new Set<number>();
    pts.forEach((p) => {
      latSet.add(+p.lat.toFixed(6));
      lngSet.add(+p.lng.toFixed(6));
    });
    const lats = [...latSet].sort((a, b) => b - a); // norte→sul
    const lngs = [...lngSet].sort((a, b) => a - b); // oeste→leste
    const rows = lats.length;
    const cols = lngs.length;

    if (rows < 2 || cols < 2) return null;

    // Criar geometria indexada
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lat = lats[r];
        const lng = lngs[c];
        const elev = elevMap.get(toKey(lat, lng)) ?? elevMin;

        const [x, z] = geoToLocal(lat, lng, centerLat, centerLng);
        const y = ((elev - elevMin) / Math.max(elevRange, 1)) * verticalExaggeration * 50;

        vertices.push(x, y, z);

        // Cor por altitude
        const t = elevRange > 0 ? (elev - elevMin) / elevRange : 0.5;
        const color = elevationColor(t);
        colors.push(color.r, color.g, color.b);
      }
    }

    // Índices para triângulos
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = r * cols + c;
        const tr = tl + 1;
        const bl = (r + 1) * cols + c;
        const br = bl + 1;
        indices.push(tl, bl, tr);
        indices.push(tr, bl, br);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [grid, centerLat, centerLng, elevMin, elevRange, verticalExaggeration]);

  // Dispose da BufferGeometry ao desmontar (fix: Buchecha review — memory leak)
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} flatShading />
    </mesh>
  );
}

interface LotBoundaryProps {
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  centerLat: number;
  centerLng: number;
  elevAvg: number;
  elevMin: number;
  elevRange: number;
  verticalExaggeration: number;
}

/**
 * Contorno do lote como linhas 3D sobre o terreno.
 * Usa abordagem imperativa (THREE.Line + primitive) para compatibilidade
 * com Three.js r152+ onde <bufferAttribute> declarativo pode falhar.
 */
function LotBoundary({
  geometry,
  centerLat,
  centerLng,
  elevAvg,
  elevMin,
  elevRange,
  verticalExaggeration,
}: LotBoundaryProps) {
  const lineObjects = useMemo(() => {
    const rings: number[][][] =
      geometry.type === "MultiPolygon"
        ? geometry.coordinates.flatMap((poly) => poly)
        : geometry.coordinates;

    const y =
      ((elevAvg - elevMin) / Math.max(elevRange, 1)) * verticalExaggeration * 50 + 1;

    return rings.map((ring) => {
      const flatCoords = ring.flatMap(([lng, lat]) => {
        const [x, z] = geoToLocal(lat, lng, centerLat, centerLng);
        return [x, y, z];
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(flatCoords, 3));
      const mat = new THREE.LineBasicMaterial({ color: "#ef4444" });
      return new THREE.Line(geo, mat);
    });
  }, [geometry, centerLat, centerLng, elevAvg, elevMin, elevRange, verticalExaggeration]);

  // Dispose ao desmontar ou ao recriar
  useEffect(() => {
    return () => {
      lineObjects.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
    };
  }, [lineObjects]);

  return (
    <>
      {lineObjects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </>
  );
}

/** Marcador do Norte */
function NorthIndicator() {
  return (
    <group position={[0, 60, 0]}>
      <Text
        position={[0, 0, -5]}
        fontSize={4}
        color="#1e40af"
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>
      <mesh position={[0, -2, -5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1.5, 4, 4]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
    </group>
  );
}

/** Auto-fit da câmera quando o terreno carrega */
function CameraFitter({ terrainSize }: { terrainSize: number }) {
  const { camera } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    if (!fitted.current && terrainSize > 0) {
      const dist = terrainSize * 1.2;
      camera.position.set(dist * 0.6, dist * 0.5, dist * 0.6);
      camera.lookAt(0, 0, 0);
      fitted.current = true;
    }
  }, [terrainSize, camera]);

  return null;
}

// ---------------------------------------------------------------------------
// Error boundary — impede que falhas no Canvas WebGL derrubem a página toda
// ---------------------------------------------------------------------------

interface ThreeErrorState { hasError: boolean; error: Error | null }

class ThreeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ThreeErrorState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ThreeErrorState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[TerrainViewer3D] WebGL error:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border-2 border-dashed border-red-200 bg-red-50/50">
          <Mountain className="w-12 h-12 text-red-300 mb-3" />
          <p className="text-sm font-medium text-red-600">Erro na visualização 3D</p>
          <p className="text-xs text-red-400 mt-1 max-w-md text-center px-4">
            {this.state.error?.message ?? "Falha ao inicializar renderizador WebGL."}
          </p>
          <button
            className="mt-3 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TerrainViewer3DProps {
  project: ParcelamentoDevelopment;
}

export default function TerrainViewer3D({ project }: TerrainViewer3DProps) {
  const [verticalExaggeration, setVerticalExaggeration] = useState(3);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showNorth, setShowNorth] = useState(true);

  // Parse elevation grid
  const elevationGrid = useMemo<ElevationGrid | null>(() => {
    const raw = (project as any).elevation_grid;
    if (!raw) return null;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw as ElevationGrid;
  }, [project]);

  // Parse geometry
  const parsedGeometry = useMemo<GeoJSON.MultiPolygon | GeoJSON.Polygon | null>(() => {
    const raw = project.geometry;
    if (!raw) return null;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw as GeoJSON.MultiPolygon | GeoJSON.Polygon;
  }, [project]);

  // Centro e elevação
  const centerLat = useMemo(() => {
    if (project.centroid) {
      try {
        const c = typeof project.centroid === "string"
          ? JSON.parse(project.centroid)
          : project.centroid;
        return c?.coordinates?.[1] ?? -22.7;
      } catch { /* fallback */ }
    }
    if (project.bbox) return ((project.bbox.north ?? 0) + (project.bbox.south ?? 0)) / 2;
    return -22.7;
  }, [project]);

  const centerLng = useMemo(() => {
    if (project.centroid) {
      try {
        const c = typeof project.centroid === "string"
          ? JSON.parse(project.centroid)
          : project.centroid;
        return c?.coordinates?.[0] ?? -47.6;
      } catch { /* fallback */ }
    }
    if (project.bbox) return ((project.bbox.east ?? 0) + (project.bbox.west ?? 0)) / 2;
    return -47.6;
  }, [project]);

  const elevMin = project.elevation_min ?? 0;
  const elevMax = project.elevation_max ?? 100;
  const elevAvg = project.elevation_avg ?? (elevMin + elevMax) / 2;
  const elevRange = elevMax - elevMin;

  // Tamanho estimado do terreno (para câmera)
  const terrainSize = useMemo(() => {
    if (!project.bbox) return 200;
    const [x1] = geoToLocal(project.bbox.south, project.bbox.west, centerLat, centerLng);
    const [x2] = geoToLocal(project.bbox.north, project.bbox.east, centerLat, centerLng);
    return Math.max(Math.abs(x2 - x1), 100);
  }, [project.bbox, centerLat, centerLng]);

  // ---------------------------------------------------------------------------
  // Empty / loading states
  // ---------------------------------------------------------------------------

  if (!elevationGrid || !elevationGrid.coordinates?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
        <Mountain className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Dados de elevação não disponíveis</p>
        <p className="text-xs text-gray-400 mt-1">
          Execute a análise de elevação (SRTM 30m) na aba Mapa para gerar o modelo 3D
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com controles */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Modelo de Elevação 3D</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            DEM SRTM 30m — {elevationGrid.sampleCount} pontos · Elevação {elevMin.toFixed(0)}m–{elevMax.toFixed(0)}m
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Exagero vertical */}
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-medium text-gray-500 uppercase">Exagero</span>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={verticalExaggeration}
              onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
              className="w-16 h-1 accent-blue-600"
            />
            <span className="text-[10px] font-mono text-gray-600 w-5 text-right">
              {verticalExaggeration}×
            </span>
          </div>

          {/* Toggle contorno */}
          <button
            onClick={() => setShowBoundary(!showBoundary)}
            className={`px-2.5 py-1.5 text-[10px] rounded-lg font-medium transition-colors ${
              showBoundary
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            Contorno
          </button>

          {/* Toggle norte */}
          <button
            onClick={() => setShowNorth(!showNorth)}
            className={`px-2.5 py-1.5 text-[10px] rounded-lg font-medium transition-colors ${
              showNorth
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            Norte
          </button>
        </div>
      </div>

      {/* Canvas 3D */}
      <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-b from-sky-100 to-sky-50">
        <ThreeErrorBoundary>
        <Canvas
          shadows
          camera={{ fov: 50, near: 0.1, far: 50000 }}
          gl={{ antialias: true, alpha: true }}
        >
          {/* Skybox light */}
          <color attach="background" args={["#e0f2fe"]} />
          <fog attach="fog" args={["#e0f2fe", terrainSize * 2, terrainSize * 5]} />

          {/* Iluminação */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[terrainSize, terrainSize * 0.8, terrainSize * 0.5]}
            intensity={0.8}
            castShadow
          />
          <directionalLight
            position={[-terrainSize * 0.5, terrainSize * 0.3, -terrainSize]}
            intensity={0.3}
          />

          {/* Terreno */}
          <TerrainMesh
            grid={elevationGrid}
            centerLat={centerLat}
            centerLng={centerLng}
            elevMin={elevMin}
            elevRange={elevRange}
            verticalExaggeration={verticalExaggeration}
          />

          {/* Contorno do lote */}
          {showBoundary && parsedGeometry && (
            <LotBoundary
              geometry={parsedGeometry}
              centerLat={centerLat}
              centerLng={centerLng}
              elevAvg={elevAvg}
              elevMin={elevMin}
              elevRange={elevRange}
              verticalExaggeration={verticalExaggeration}
            />
          )}

          {/* Norte */}
          {showNorth && <NorthIndicator />}

          {/* Controles */}
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={10}
            maxDistance={terrainSize * 4}
          />

          {/* Auto-fit câmera */}
          <CameraFitter terrainSize={terrainSize} />
        </Canvas>
        </ThreeErrorBoundary>

        {/* Legenda de elevação */}
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200">
          <p className="text-[9px] font-medium text-gray-500 mb-1">ELEVAÇÃO (m)</p>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-600">{elevMin.toFixed(0)}</span>
            <div
              className="w-24 h-2 rounded-full"
              style={{
                background: "linear-gradient(90deg, #4caf50, #8bc34a, #cddc39, #ffeb3b, #ff9800, #795548)",
              }}
            />
            <span className="text-[9px] text-gray-600">{elevMax.toFixed(0)}</span>
          </div>
        </div>

        {/* Info do slope */}
        {project.slope_avg_pct != null && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <p className="text-[9px] font-medium text-gray-500">DECLIVIDADE MÉDIA</p>
            <p className="text-sm font-bold text-gray-800">{project.slope_avg_pct.toFixed(1)}%</p>
          </div>
        )}

        {/* Instruções */}
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[9px] text-white/80">
          🖱️ Arrastar: rotacionar · Scroll: zoom · Shift+arrastar: mover
        </div>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Elevação Mín.", value: `${elevMin.toFixed(1)} m`, color: "text-green-600" },
          { label: "Elevação Máx.", value: `${elevMax.toFixed(1)} m`, color: "text-orange-600" },
          { label: "Desnível", value: `${elevRange.toFixed(1)} m`, color: "text-blue-600" },
          {
            label: "Declividade Média",
            value: project.slope_avg_pct != null ? `${project.slope_avg_pct.toFixed(1)}%` : "N/A",
            color: (project.slope_avg_pct ?? 0) > 30 ? "text-red-600" : "text-gray-800",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 text-center"
          >
            <p className="text-[10px] font-medium text-gray-500">{stat.label}</p>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
