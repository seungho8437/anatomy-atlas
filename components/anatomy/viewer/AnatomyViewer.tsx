/**
 * AnatomyViewer - 3D Anatomy Visualization Component (Optimized)
 */

"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, PerspectiveCamera, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import structuresRegistry from "@/data/registry/structures.json";
import { AnatomyStructure, Asset, AnatomyDetail } from "@/lib/anatomy/types";
import { anatomyRelationships } from "@/lib/anatomy/relationships";
import { anatomyDetailsData } from "@/data/anatomy/details";
import { getAnatomyMaterialStyle } from "@/data/anatomy/visualization";

const combinedStructures = (
  structuresRegistry as { structures: AnatomyStructure[]; assets: Asset[] }
).structures;

const combinedAssets = (
  structuresRegistry as { structures: AnatomyStructure[]; assets: Asset[] }
).assets;

const DEFAULT_INITIAL_STRUCTURE_IDS = [
  "bone.femur",
  "bone.tibia",
  "bone.hip.right",
  "bone.patella.right",
  "muscle.sartorius",
  "nerve.optic",
  "vessel.femoral.artery",
  "organ.kidney.right",
];

function getAnatomyDetail(structureId: string): AnatomyDetail | null {
  return anatomyDetailsData[structureId] ?? null;
}

function getRelationshipsForStructure(structureId: string) {
  return anatomyRelationships
    .filter((rel) => rel.sourceId === structureId || rel.targetId === structureId)
    .map((rel) => {
      const isSource = rel.sourceId === structureId;
      const otherStructureId = isSource ? rel.targetId : rel.sourceId;
      const otherDetails = getStructureDetails(otherStructureId);
      const otherName = otherDetails?.names?.en ?? otherStructureId;

      return {
        relationship: rel,
        otherStructureId,
        otherName,
        otherDetails,
        type: rel.type,
        description: rel.description,
      };
    });
}

function getAssetPathsForStructure(structureId: string): string[] {
  const structure = combinedStructures.find((s) => s.id === structureId);
  if (!structure || !structure.assetRefs || structure.assetRefs.length === 0) return [];

  const paths: string[] = [];
  for (const ref of structure.assetRefs) {
    const asset = combinedAssets.find((a) => a.assetId === ref);
    if (asset?.storagePath) {
      paths.push(`/${asset.storagePath.replace(/^\//, "")}`);
    }
  }
  return paths;
}

function getStructureDetails(structureId: string) {
  return combinedStructures.find((s) => s.id === structureId) ?? null;
}

export type VisibilityScope = "default" | "selected" | "system" | "all";

interface AnatomyViewerProps {
  structureIds?: string[];
  onStructureSelected?: (structureId: string) => void;
  cameraPosition?: [number, number, number];
  showGrid?: boolean;
  showEnvironment?: boolean;
}

/**
 * Shared Coordinate Asset Loader
 * 최적화: frustumCulled 활성화 및 불필요한 메테리얼 재할당 방지
 */
function SharedCoordinateAsset({
  structureId,
  assetKey,
  assetPath,
  isSelected,
  isRelated = false,
  hidden = false,
  onLoaded,
  onSelect,
}: {
  structureId: string;
  assetKey: string;
  assetPath: string;
  isSelected: boolean;
  isRelated?: boolean;
  hidden?: boolean;
  onLoaded: (assetKey: string, structureId: string, scene: THREE.Object3D) => void;
  onSelect: (id: string) => void;
}) {
  const { scene } = useGLTF(assetPath);
  const meshMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    scene.visible = !hidden;
  }, [scene, hidden]);

  useEffect(() => {
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);

    const structure = getStructureDetails(structureId);
    const materialStyle = getAnatomyMaterialStyle(structure);
    const collectedMats: THREE.MeshStandardMaterial[] = [];

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // [최적화 1] Frustum Culling 복구: 시야 밖 메쉬는 GPU 연산에서 제외
        object.frustumCulled = true;

        if (object.material) {
          const mat = object.material.clone() as THREE.MeshStandardMaterial;
          if ("color" in mat) mat.color.set(materialStyle.color);
          if ("roughness" in mat) mat.roughness = materialStyle.roughness;
          if ("metalness" in mat) mat.metalness = materialStyle.metalness;
          object.material = mat;
          collectedMats.push(mat);
        }
      }
    });

    meshMaterialsRef.current = collectedMats;
    onLoaded(assetKey, structureId, scene);
  }, [scene, assetKey, structureId, onLoaded]);

  // [최적화 2] 전체 traverse 대신 캐시된 Material 배열만 빠르게 emissive 변경
  useEffect(() => {
    const mats = meshMaterialsRef.current;
    if (mats.length === 0) return;

    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (isSelected) {
        mat.emissive.setHex(0x3b82f6);
        mat.emissiveIntensity = 0.8;
      } else if (isRelated) {
        mat.emissive.setHex(0x06b6d4);
        mat.emissiveIntensity = 0.45;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
    }
  }, [isSelected, isRelated]);

  return (
    <primitive
      object={scene}
      onClick={(event: any) => {
        event.stopPropagation();
        onSelect(structureId);
      }}
    />
  );
}

/**
 * Shared Coordinate Scene
 * 최적화: 디바운싱을 통해 전체 Bounding Box 정렬 횟수를 획기적으로 축소
 */
function SharedCoordinateScene({
  structureIds,
  selectedStructure,
  relatedStructures = new Set<string>(),
  hiddenStructures = new Set<string>(),
  onSelect,
  onScenesLoaded,
}: {
  structureIds: string[];
  selectedStructure: string | null;
  relatedStructures?: Set<string>;
  hiddenStructures?: Set<string>;
  onSelect: (id: string) => void;
  onScenesLoaded?: (scenes: Map<string, THREE.Object3D[]>) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const loadedScenesRef = useRef(new Map<string, { structureId: string; scene: THREE.Object3D }>());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flatAssets = useMemo(() => {
    const assets: { structureId: string; assetKey: string; assetPath: string }[] = [];
    structureIds.forEach((structureId, sIdx) => {
      const paths = getAssetPathsForStructure(structureId);
      paths.forEach((assetPath, aIdx) => {
        assets.push({
          structureId,
          assetKey: `${structureId}_${sIdx}_asset_${aIdx}_${assetPath}`,
          assetPath,
        });
      });
    });
    return assets;
  }, [structureIds]);

  const recenterScene = useCallback(() => {
    if (!groupRef.current || loadedScenesRef.current.size === 0) return;

    groupRef.current.position.set(0, 0, 0);
    groupRef.current.scale.setScalar(1);
    groupRef.current.updateMatrixWorld(true);

    const combinedBox = new THREE.Box3();
    loadedScenesRef.current.forEach(({ scene }) => {
      combinedBox.expandByObject(scene);
    });

    if (combinedBox.isEmpty()) return;

    const center = combinedBox.getCenter(new THREE.Vector3());
    const size = combinedBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;

    if (!Number.isFinite(maxDimension) || maxDimension <= 0) return;

    const sharedScale = 2 / maxDimension;
    groupRef.current.position.set(
      -center.x * sharedScale,
      -center.y * sharedScale,
      -center.z * sharedScale
    );
    groupRef.current.scale.setScalar(sharedScale);
    groupRef.current.updateMatrixWorld(true);
  }, []);

  const handleLoaded = useCallback(
    (assetKey: string, structureId: string, scene: THREE.Object3D) => {
      loadedScenesRef.current.set(assetKey, { structureId, scene });

      if (onScenesLoaded) {
        const structureSceneMap = new Map<string, THREE.Object3D[]>();
        loadedScenesRef.current.forEach(({ structureId: sId, scene: sc }) => {
          if (!structureSceneMap.has(sId)) structureSceneMap.set(sId, []);
          structureSceneMap.get(sId)!.push(sc);
        });
        onScenesLoaded(structureSceneMap);
      }

      // [최적화 3] 에셋 로드 시마다 연산하지 않고 80ms 디바운스 적용
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        recenterScene();
      }, 80);
    },
    [onScenesLoaded, recenterScene]
  );

  return (
    <group ref={groupRef}>
      {flatAssets.map(({ structureId, assetKey, assetPath }) => (
        <SharedCoordinateAsset
          key={assetKey}
          structureId={structureId}
          assetKey={assetKey}
          assetPath={assetPath}
          isSelected={selectedStructure === structureId}
          isRelated={relatedStructures.has(structureId)}
          hidden={hiddenStructures.has(structureId)}
          onLoaded={handleLoaded}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function AnatomyCanvasContent({
  structureIds = [],
  selectedStructure,
  relatedStructures = new Set<string>(),
  hiddenStructures = new Set<string>(),
  resetTrigger,
  focusTrigger,
  onStructureSelected,
}: {
  structureIds: string[];
  selectedStructure: string | null;
  relatedStructures?: Set<string>;
  hiddenStructures?: Set<string>;
  resetTrigger: number;
  focusTrigger: number;
  onStructureSelected?: (id: string) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const loadedScenesMapRef = useRef<Map<string, THREE.Object3D[]>>(new Map());

  const handleScenesLoaded = useCallback((scenes: Map<string, THREE.Object3D[]>) => {
    loadedScenesMapRef.current = scenes;
  }, []);

  useEffect(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, resetTrigger]);

  useEffect(() => {
    if (focusTrigger === 0 || !selectedStructure) return;
    const targetScenes = loadedScenesMapRef.current.get(selectedStructure);
    if (!targetScenes || targetScenes.length === 0) return;

    const worldBox = new THREE.Box3();
    targetScenes.forEach((scene) => {
      scene.updateWorldMatrix(true, true);
      worldBox.expandByObject(scene);
    });

    if (worldBox.isEmpty()) return;

    const center = worldBox.getCenter(new THREE.Vector3());
    const size = worldBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 0.5;

    const perspCamera = camera as THREE.PerspectiveCamera;
    const fov = perspCamera.fov ? (perspCamera.fov * Math.PI) / 180 : Math.PI / 4;
    const distance = Math.max((maxDim / 2) / Math.tan(fov / 2) * 1.8, 0.8);

    const direction = new THREE.Vector3().subVectors(
      camera.position,
      controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0)
    ).normalize();
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);

    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [camera, focusTrigger, selectedStructure]);

  const effectiveStructureIds =
    structureIds.length > 0
      ? structureIds
      : selectedStructure
      ? [selectedStructure]
      : DEFAULT_INITIAL_STRUCTURE_IDS;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
        enablePan={true}
      />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1.2} />
      <Grid args={[10, 10]} cellColor={"#6f6f6f"} sectionColor={"#9d4edd"} infiniteGrid />

      <SharedCoordinateScene
        structureIds={effectiveStructureIds}
        selectedStructure={selectedStructure}
        relatedStructures={relatedStructures}
        hiddenStructures={hiddenStructures}
        onSelect={onStructureSelected || (() => {})}
        onScenesLoaded={handleScenesLoaded}
      />

      <Environment preset="studio" />
    </>
  );
}

export function AnatomyViewer({
  structureIds = [],
  onStructureSelected,
}: AnatomyViewerProps) {
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [hiddenStructures, setHiddenStructures] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const [scopeMode, setScopeMode] = useState<VisibilityScope>("default");
  const [loadedScopeIds, setLoadedScopeIds] = useState<string[]>(DEFAULT_INITIAL_STRUCTURE_IDS);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelBatchRef = useRef(false);

  const availableSystems = useMemo(() => {
    return Array.from(
      new Set(
        combinedStructures
          .map((s) => s.system)
          .filter((sys): sys is string => typeof sys === "string" && sys.length > 0)
      )
    );
  }, []);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const displayedStructures = useMemo(() => {
    return combinedStructures.filter((s) => {
      if (selectedSystem !== null && s.system !== selectedSystem) return false;
      if (trimmedQuery) {
        const matchId = s.id.toLowerCase().includes(trimmedQuery);
        const matchEn = s.names?.en?.toLowerCase().includes(trimmedQuery) ?? false;
        const matchKo = s.names?.ko?.toLowerCase().includes(trimmedQuery) ?? false;
        return matchId || matchEn || matchKo;
      }
      return true;
    });
  }, [selectedSystem, trimmedQuery]);

  const startBatchLoading = useCallback((targetIds: string[], batchSize = 30) => {
    cancelBatchRef.current = false;
    setBatchLoading(true);
    setBatchProgress({ current: Math.min(batchSize, targetIds.length), total: targetIds.length });

    const initialBatch = targetIds.slice(0, batchSize);
    setLoadedScopeIds(initialBatch);

    let currentIndex = batchSize;
    const loadNextBatch = () => {
      if (cancelBatchRef.current || currentIndex >= targetIds.length) {
        setBatchLoading(false);
        setBatchProgress(null);
        return;
      }
      const nextBatch = targetIds.slice(0, currentIndex + batchSize);
      currentIndex += batchSize;
      setLoadedScopeIds(nextBatch);
      setBatchProgress({ current: Math.min(currentIndex, targetIds.length), total: targetIds.length });
      setTimeout(loadNextBatch, 80);
    };

    setTimeout(loadNextBatch, 80);
  }, []);

  const handleScopeChange = (newScope: VisibilityScope) => {
    if (newScope === scopeMode) return;
    setScopeMode(newScope);

    if (batchLoading) {
      cancelBatchRef.current = true;
      setBatchLoading(false);
      setBatchProgress(null);
    }

    if (newScope === "default") {
      setLoadedScopeIds(DEFAULT_INITIAL_STRUCTURE_IDS);
    } else if (newScope === "selected") {
      setLoadedScopeIds(selectedStructure ? [selectedStructure] : DEFAULT_INITIAL_STRUCTURE_IDS);
    } else if (newScope === "system") {
      const targetSystem =
        (selectedStructure ? getStructureDetails(selectedStructure)?.system : null) ??
        selectedSystem ??
        "skeletal";
      const systemStructures = combinedStructures
        .filter((s) => s.system?.toLowerCase() === targetSystem.toLowerCase())
        .map((s) => s.id);

      if (systemStructures.length > 50) {
        startBatchLoading(systemStructures, 30);
      } else {
        setLoadedScopeIds(systemStructures.length > 0 ? systemStructures : DEFAULT_INITIAL_STRUCTURE_IDS);
      }
    } else if (newScope === "all") {
      const allIds = combinedStructures.map((s) => s.id);
      startBatchLoading(allIds, 40);
    }
  };

  const handleCancelBatch = () => {
    cancelBatchRef.current = true;
    setBatchLoading(false);
    setBatchProgress(null);
  };

  const handleStructureSelect = (structureId: string | null) => {
    setSelectedStructure(structureId);
    if (structureId) {
      onStructureSelected?.(structureId);
      if (scopeMode === "selected") {
        setLoadedScopeIds([structureId]);
      }
    }
  };

  const handleToggleHide = () => {
    if (!selectedStructure) return;
    const isCurrentlyHidden = hiddenStructures.has(selectedStructure);
    const nextHidden = new Set(hiddenStructures);
    if (isCurrentlyHidden) {
      nextHidden.delete(selectedStructure);
    } else {
      nextHidden.add(selectedStructure);
      setSelectedStructure(null);
    }
    setHiddenStructures(nextHidden);
  };

  const relatedStructureIds = useMemo(() => {
    if (!selectedStructure) return new Set<string>();
    const rels = getRelationshipsForStructure(selectedStructure);
    return new Set(rels.map((r) => r.otherStructureId));
  }, [selectedStructure]);

  const effectiveStructureIdsToRender = useMemo(() => {
    if (structureIds.length > 0) return structureIds;
    if (scopeMode === "selected") {
      return selectedStructure ? [selectedStructure] : DEFAULT_INITIAL_STRUCTURE_IDS;
    }
    return loadedScopeIds;
  }, [structureIds, scopeMode, selectedStructure, loadedScopeIds]);

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* [최적화 4] dpr 제한과 powerPreference로 저사양 기기 및 고해상도 모니터 렉 방지 */}
      <Canvas
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: true }}
        className="w-full h-full"
        onPointerMissed={() => handleStructureSelect(null)}
      >
        <AnatomyCanvasContent
          structureIds={effectiveStructureIdsToRender}
          selectedStructure={selectedStructure}
          relatedStructures={relatedStructureIds}
          hiddenStructures={hiddenStructures}
          resetTrigger={resetTrigger}
          focusTrigger={focusTrigger}
          onStructureSelected={handleStructureSelect}
        />
      </Canvas>

      {/* 좌측 패널: 검색 및 리스트 */}
      <div className="absolute top-4 left-4 w-72 sm:w-80 max-h-[calc(100vh-2rem)] flex flex-col gap-2 pointer-events-none z-10">
        <div className="bg-slate-900/90 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-md flex flex-col overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">Structures</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                {displayedStructures.length} / {combinedStructures.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsListOpen((prev) => !prev)}
              className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              {isListOpen ? "Hide" : "Show"}
            </button>
          </div>

          <div className="p-2 border-b border-slate-800/80">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색 (예: 대퇴골, femur)..."
                className="w-full bg-slate-950/80 text-white text-xs px-3 py-1.5 rounded border border-slate-700/80 focus:outline-none focus:border-blue-500 shadow-inner placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="px-2 py-1.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSystem(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                selectedSystem === null ? "bg-blue-600 text-white shadow-sm" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            {availableSystems.map((sys) => {
              const isCurrent = selectedSystem === sys;
              return (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setSelectedSystem(isCurrent ? null : sys)}
                  className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors capitalize ${
                    isCurrent ? "bg-blue-600 text-white shadow-sm" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sys}
                </button>
              );
            })}
          </div>

          {isListOpen && (
            <div className="overflow-y-auto max-h-64 sm:max-h-72 divide-y divide-slate-800/60">
              {displayedStructures.length > 0 ? (
                displayedStructures.map((s, idx) => {
                  const isSelected = selectedStructure === s.id;
                  const isHidden = hiddenStructures.has(s.id);

                  return (
                    <button
                      key={`${s.id}-${idx}`}
                      type="button"
                      onClick={() => handleStructureSelect(s.id)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${
                        isSelected ? "bg-blue-900/50 border-l-4 border-l-blue-400" : "hover:bg-slate-800/60"
                      } ${isHidden ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-medium ${isSelected ? "text-blue-200" : "text-white"}`}>
                          {s.names?.en ?? s.id}
                        </span>
                        {s.system && (
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            {s.system}
                          </span>
                        )}
                      </div>
                      {s.names?.ko && (
                        <span className="text-[11px] text-slate-300 font-sans">
                          {s.names.ko}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                  일치하는 구조물이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 선택된 구조물 정보 패널 */}
        {selectedStructure && (() => {
          const details = getStructureDetails(selectedStructure);
          const anatomyDetail = getAnatomyDetail(selectedStructure);
          const relatedStructures = getRelationshipsForStructure(selectedStructure);

          return (
            <div className="bg-slate-900/90 text-white p-3.5 rounded-lg border border-blue-500 shadow-xl backdrop-blur-md space-y-2.5 pointer-events-auto max-h-96 overflow-y-auto">
              <div className="space-y-1 pb-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Selected Structure</p>
                <p className="text-sm font-bold">
                  {details?.names?.en ?? selectedStructure}
                  {details?.names?.ko && (
                    <span className="text-xs font-normal text-gray-300 ml-2">({details.names.ko})</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 font-mono">ID: {selectedStructure}</p>
              </div>

              <div className="space-y-2 text-xs">
                {anatomyDetail ? (
                  <>
                    {anatomyDetail.description && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Description</span>
                        <p className="text-slate-200 leading-relaxed text-[11px]">{anatomyDetail.description}</p>
                      </div>
                    )}
                    {anatomyDetail.function && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Function</span>
                        <p className="text-slate-200 leading-relaxed text-[11px]">{anatomyDetail.function}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400 italic text-[11px] py-1">상세 정보가 없습니다.</p>
                )}
              </div>

              {relatedStructures.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Related Structures</span>
                  <div className="space-y-1">
                    {relatedStructures.map((relItem, idx) => (
                      <div key={idx} className="bg-slate-950/60 p-1.5 rounded border border-slate-800 text-[11px]">
                        <span className="font-semibold text-slate-200">{relItem.otherName}</span>
                        <span className="text-[9px] ml-1.5 px-1 py-0.2 rounded bg-blue-950 text-blue-300 font-mono">{relItem.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 우측 조작 바 */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none z-10">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-0.5 flex items-center shadow-lg backdrop-blur-md">
            {(["default", "selected", "system", "all"] as VisibilityScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => handleScopeChange(scope)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors capitalize ${
                  scopeMode === scope ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {scope}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFocusTrigger((p) => p + 1)}
            disabled={!selectedStructure}
            className={`text-xs font-semibold px-3 py-2 rounded border shadow-md transition-colors ${
              selectedStructure ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-400 cursor-pointer" : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60"
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={handleToggleHide}
            disabled={!selectedStructure}
            className={`text-xs font-semibold px-3 py-2 rounded border shadow-md transition-colors ${
              selectedStructure ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-400 cursor-pointer" : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60"
            }`}
          >
            {selectedStructure && hiddenStructures.has(selectedStructure) ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            onClick={() => setResetTrigger((p) => p + 1)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded border border-slate-600 shadow-md transition-colors cursor-pointer"
          >
            Reset View
          </button>
        </div>

        {batchLoading && batchProgress && (
          <div className="bg-slate-900/95 border border-blue-500/60 rounded-lg px-3 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-blue-300">로딩 중...</span>
                <span className="font-mono text-slate-300 text-[11px]">{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelBatch}
              className="text-xs px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4 bg-slate-900/80 text-white px-3 py-1.5 rounded text-xs text-gray-400 border border-slate-800 pointer-events-none">
        마우스 드래그: 회전 | 휠: 확대/축소 | 우클릭 드래그: 이동
      </div>
    </div>
  );
}

export default AnatomyViewer;