/**
 * AnatomyViewer - 3D Anatomy Visualization Component
 * 
 * Phase 1 MVP component for the 3D anatomy viewer.
 * 
 * Supports:
 * - 3D structure rendering
 * - Orbit/rotation camera controls
 * - Zoom and pan
 * - Structure selection and highlighting
 * - Visibility toggling
 * - Opacity control
 * 
 * Future enhancements:
 * - Structure details panel
 * - Search functionality
 * - System filtering
 * - Movement visualization
 * - Animation support
 */

"use client";

import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import structuresRegistry from "@/data/registry/structures.json";
import { AnatomyStructure, Asset, AnatomyDetail, AnatomyRelationship } from "@/lib/anatomy/types";
import { anatomyRelationships } from "@/lib/anatomy/relationships";
import { anatomyDetailsData } from "@/data/anatomy/details";
import { getAnatomyMaterialStyle } from "@/data/anatomy/visualization";

// Combined registry lookup: Production structures + Test structures for non-destructive coexistence
const combinedStructures = (
  structuresRegistry as {
    structures: AnatomyStructure[];
    assets: Asset[];
  }
).structures;

const combinedAssets = (
  structuresRegistry as {
    structures: AnatomyStructure[];
    assets: Asset[];
  }
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

/**
 * Bidirectional lookup for anatomical relationships associated with a structure
 */
function getRelationshipsForStructure(structureId: string) {
  return anatomyRelationships
    .filter(
      (rel) => rel.sourceId === structureId || rel.targetId === structureId
    )
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

// Registry-backed 1:N asset paths lookup: returns array of storagePaths for all assetRefs
function getAssetPathsForStructure(structureId: string): string[] {
  const structure = combinedStructures.find((s) => s.id === structureId);
  if (!structure || !structure.assetRefs || structure.assetRefs.length === 0) {
    return [];
  }
  const paths: string[] = [];
  for (const ref of structure.assetRefs) {
    const asset = combinedAssets.find((a) => a.assetId === ref);
    if (asset?.storagePath) {
      const normalizedPath = `/${asset.storagePath.replace(/^\//, "")}`;
      paths.push(normalizedPath);
    }
  }
  return paths;
}

function getStructureDetails(structureId: string) {
  return combinedStructures.find((s) => s.id === structureId) ?? null;
}

export type VisibilityScope = "default" | "selected" | "system" | "all";

interface AnatomyViewerProps {
  /**
   * List of structure IDs to render
   * In MVP: ["bone.femur", "bone.tibia", "muscle.sartorius"]
   */
  structureIds?: string[];

  /**
   * Callback when a structure is selected
   */
  onStructureSelected?: (structureId: string) => void;

  /**
   * Initial camera position
   */
  cameraPosition?: [number, number, number];

  /**
   * Enable grid display
   */
  showGrid?: boolean;

  /**
   * Enable environment lighting
   */
  showEnvironment?: boolean;
}

/**
 * Placeholder mesh for development
 * In Phase 2, this will be replaced with actual asset loading
 */
function PlaceholderStructure({
  structureId,
  onSelect,
}: {
  structureId: string;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_state) => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh
      ref={meshRef}
      onClick={() => onSelect(structureId)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={hovered ? "#ff6b6b" : "#4c6ef5"}
        emissive={hovered ? "#ff6b6b" : "#000000"}
      />
    </mesh>
  );
}

/**
 * Real GLB-backed structure, loaded via the registry's asset storagePath
 */
function RealStructure({
  structureId,
  assetPath,
  onSelect,
}: {
  structureId: string;
  assetPath: string;
  onSelect: (id: string) => void;
}) {
  const { scene } = useGLTF(assetPath);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  console.log("STEP 3-8 — Asset loaded:", structureId, assetPath);
console.log("Scene:", scene);


  // BodyParts3D meshes use whole-body mm coordinates, not origin-centered;
  // recenter and normalize scale so the model is framed like the placeholder.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    scene.position.set(-center.x, -center.y, -center.z);
    if (groupRef.current) {
      const targetScale = 2 / maxDimension;
      groupRef.current.scale.setScalar(targetScale);
    }
  }, [scene]);

  return (
    <group
      ref={groupRef}
      onClick={() => onSelect(structureId)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <primitive object={scene} />
    </group>
  );
}

/**
 * STEP 3-8
 *
 * Individual asset loader for the shared BodyParts3D coordinate prototype.
 *
 * IMPORTANT:
 * - Does NOT center the asset.
 * - Does NOT normalize the asset.
 * - Preserves the original BodyParts3D coordinates.
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
  onLoaded: (
    assetKey: string,
    structureId: string,
    scene: THREE.Object3D
  ) => void;
  onSelect: (id: string) => void;
}) {
  const { scene } = useGLTF(assetPath);
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());

  // Control visibility via Object3D visible property without altering transform or geometry
  useEffect(() => {
    scene.visible = !hidden;
  }, [scene, hidden]);

  useEffect(() => {
    // Explicitly preserve the original BodyParts3D transform.
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);

    // STEP 3-8: Disable frustum culling for diagnostic rendering.
    // Ensure independent materials per mesh to prevent cross-asset highlight bleed.
    const structure = getStructureDetails(structureId);
    const materialStyle = getAnatomyMaterialStyle(structure);

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = false;
        if (!originalMaterialsRef.current.has(object)) {
          if (Array.isArray(object.material)) {
            const cloned = object.material.map((m) => {
              const mat = m.clone();
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                mat.color.set(materialStyle.color);
                mat.roughness = materialStyle.roughness;
                mat.metalness = materialStyle.metalness;
                if (materialStyle.clearcoat !== undefined && "clearcoat" in mat) {
                  mat.clearcoat = materialStyle.clearcoat;
                }
                if (materialStyle.clearcoatRoughness !== undefined && "clearcoatRoughness" in mat) {
                  mat.clearcoatRoughness = materialStyle.clearcoatRoughness;
                }
              }
              return mat;
            });
            object.material = cloned;
            originalMaterialsRef.current.set(object, cloned);
          } else if (object.material) {
            const mat = object.material.clone();
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              mat.color.set(materialStyle.color);
              mat.roughness = materialStyle.roughness;
              mat.metalness = materialStyle.metalness;
              if (materialStyle.clearcoat !== undefined && "clearcoat" in mat) {
                mat.clearcoat = materialStyle.clearcoat;
              }
              if (materialStyle.clearcoatRoughness !== undefined && "clearcoatRoughness" in mat) {
                mat.clearcoatRoughness = materialStyle.clearcoatRoughness;
              }
            }
            object.material = mat;
            originalMaterialsRef.current.set(object, mat);
          }
        }
      }
    });

    onLoaded(assetKey, structureId, scene);
  }, [scene, assetKey, structureId, onLoaded]);

  // Apply visual highlight non-destructively based on isSelected and isRelated
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => {
          if ("emissive" in mat && mat.emissive instanceof THREE.Color) {
            if (isSelected) {
              mat.emissive.setHex(0x3b82f6); // Highlight with blue emissive glow
              if ("emissiveIntensity" in mat && typeof mat.emissiveIntensity === "number") {
                mat.emissiveIntensity = 0.8;
              }
            } else if (isRelated) {
              mat.emissive.setHex(0x06b6d4); // Highlight related structures with cyan emissive glow
              if ("emissiveIntensity" in mat && typeof mat.emissiveIntensity === "number") {
                mat.emissiveIntensity = 0.45;
              }
            } else {
              mat.emissive.setHex(0x000000); // Reset emissive
              if ("emissiveIntensity" in mat && typeof mat.emissiveIntensity === "number") {
                mat.emissiveIntensity = 0.0;
              }
            }
          }
        });
      }
    });
  }, [scene, isSelected, isRelated]);

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
 * STEP 3-8 & PHASE 15 (1:N asset support)
 *
 * Scene for validating the BodyParts3D shared coordinate system.
 * Supports 1:1 and 1:N ELEMENT GLBs grouped under their logical structureId.
 *
 * All assets remain in their original coordinates.
 * Only the parent SceneGroup receives centering and normalization.
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

  // Maps assetKey -> Object3D
  const loadedScenesRef = useRef(
    new Map<string, { structureId: string; scene: THREE.Object3D }>()
  );

  const [version, setVersion] = useState(0);

  const handleLoaded = React.useCallback(
    (assetKey: string, structureId: string, scene: THREE.Object3D) => {
      loadedScenesRef.current.set(assetKey, { structureId, scene });
      setVersion((value) => value + 1);

      if (onScenesLoaded) {
        const structureSceneMap = new Map<string, THREE.Object3D[]>();
        loadedScenesRef.current.forEach(({ structureId: sId, scene: sc }) => {
          if (!structureSceneMap.has(sId)) {
            structureSceneMap.set(sId, []);
          }
          structureSceneMap.get(sId)!.push(sc);
        });
        onScenesLoaded(structureSceneMap);
      }
    },
    [onScenesLoaded]
  );

  // Flatten all assets across structures into individual render items with unique keys
  const flatAssets: { structureId: string; assetKey: string; assetPath: string }[] = [];
  structureIds.forEach((structureId, sIdx) => {
    const paths = getAssetPathsForStructure(structureId);
    paths.forEach((assetPath, aIdx) => {
      flatAssets.push({
        structureId,
        assetKey: `${structureId}_${sIdx}_asset_${aIdx}_${assetPath}`,
        assetPath,
      });
    });
  });

  useEffect(() => {
    if (!groupRef.current) return;
    if (loadedScenesRef.current.size === 0) return;

    // Reset parent group transform to avoid cumulative/oscillating transforms
    groupRef.current.position.set(0, 0, 0);
    groupRef.current.scale.setScalar(1);
    groupRef.current.updateMatrixWorld(true);

    // Calculate one combined bounding box using
    // the ORIGINAL BodyParts3D coordinates.
    const combinedBox = new THREE.Box3();

    loadedScenesRef.current.forEach(({ scene }) => {
      combinedBox.expandByObject(scene);
    });

    if (combinedBox.isEmpty()) return;

    const center = combinedBox.getCenter(
      new THREE.Vector3()
    );

    const size = combinedBox.getSize(
      new THREE.Vector3()
    );

    const maxDimension = Math.max(
      size.x,
      size.y,
      size.z
    );

    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
      return;
    }

    // Only the parent scene is transformed.
    // Individual BodyParts3D assets retain their original coordinates and relative scale.
    const sharedScale = 2 / maxDimension;

    groupRef.current.position.set(
      -center.x * sharedScale,
      -center.y * sharedScale,
      -center.z * sharedScale
    );

    groupRef.current.scale.setScalar(sharedScale);
    groupRef.current.updateMatrixWorld(true);
  }, [version]);

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

/**
 * Canvas content component
 */
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

  const handleScenesLoaded = React.useCallback((scenes: Map<string, THREE.Object3D[]>) => {
    loadedScenesMapRef.current = scenes;
  }, []);

  useEffect(() => {
    // Reset camera position and OrbitControls on initial load or resetTrigger change
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, resetTrigger]);

  // Handle Focus trigger on selected structure (supports 1:1 and 1:N scenes)
  useEffect(() => {
    if (focusTrigger === 0 || !selectedStructure) return;
    const targetScenes = loadedScenesMapRef.current.get(selectedStructure);
    if (!targetScenes || targetScenes.length === 0) return;

    // Compute combined bounding box across all element meshes belonging to the structure
    const worldBox = new THREE.Box3();
    targetScenes.forEach((scene) => {
      scene.updateWorldMatrix(true, true);
      worldBox.expandByObject(scene);
    });

    if (worldBox.isEmpty()) return;

    const center = worldBox.getCenter(new THREE.Vector3());
    const size = worldBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 0.5;

    // Calculate distance based on camera fov
    const perspCamera = camera as THREE.PerspectiveCamera;
    const fov = perspCamera.fov ? (perspCamera.fov * Math.PI) / 180 : Math.PI / 4;
    const distance = Math.max((maxDim / 2) / Math.tan(fov / 2) * 1.8, 0.8);

    // Position camera along current view direction vector or default [0, 0, distance]
    const direction = new THREE.Vector3().subVectors(camera.position, controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0)).normalize();
    if (direction.lengthSq() < 0.001) {
      direction.set(0, 0, 1);
    }

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
        dampingFactor={0.05}
        autoRotate={false}
        enablePan={true}
      />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />

      <Grid args={[10, 10]} cellColor={"#6f6f6f"} sectionColor={"#9d4edd"} infiniteGrid />

{/* Shared BodyParts3D coordinate system (1:1 & 1:N assets) */}
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

/**
 * Main AnatomyViewer component
 */
export function AnatomyViewer({
  structureIds = [],
  onStructureSelected,
  cameraPosition = [0, 0, 5],
  showGrid = true,
  showEnvironment = true,
}: AnatomyViewerProps) {
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [hiddenStructures, setHiddenStructures] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // Visibility Scope state
  const [scopeMode, setScopeMode] = useState<VisibilityScope>("default");
  const [loadedScopeIds, setLoadedScopeIds] = useState<string[]>(DEFAULT_INITIAL_STRUCTURE_IDS);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelBatchRef = useRef(false);

  // Extract unique systems dynamically from the registry
  const availableSystems = Array.from(
    new Set(
      combinedStructures
        .map((s) => s.system)
        .filter((sys): sys is string => typeof sys === "string" && sys.length > 0)
    )
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const displayedStructures = combinedStructures.filter((s) => {
    // 1. System filter check
    if (selectedSystem !== null && s.system !== selectedSystem) {
      return false;
    }

    // 2. Search query check (AND condition with system filter)
    if (trimmedQuery) {
      const matchId = s.id.toLowerCase().includes(trimmedQuery);
      const matchEn = s.names?.en?.toLowerCase().includes(trimmedQuery) ?? false;
      const matchKo = s.names?.ko?.toLowerCase().includes(trimmedQuery) ?? false;
      return matchId || matchEn || matchKo;
    }

    return true;
  });

  // Handle Visibility Scope switching
  const handleScopeChange = (newScope: VisibilityScope) => {
    if (newScope === scopeMode) return;
    setScopeMode(newScope);

    // Cancel any in-flight batch loading
    if (batchLoading) {
      cancelBatchRef.current = true;
      setBatchLoading(false);
      setBatchProgress(null);
    }

    if (newScope === "default") {
      setLoadedScopeIds(DEFAULT_INITIAL_STRUCTURE_IDS);
    } else if (newScope === "selected") {
      if (selectedStructure) {
        setLoadedScopeIds([selectedStructure]);
      } else {
        setLoadedScopeIds(DEFAULT_INITIAL_STRUCTURE_IDS);
      }
    } else if (newScope === "system") {
      // Find system from selectedStructure or active selectedSystem filter, or fallback to skeletal
      const targetSystem =
        (selectedStructure ? getStructureDetails(selectedStructure)?.system : null) ??
        selectedSystem ??
        "skeletal";
      
      const systemStructures = combinedStructures
        .filter((s) => s.system?.toLowerCase() === targetSystem.toLowerCase())
        .map((s) => s.id);
      
      if (systemStructures.length > 50) {
        // Batch load system structures if large
        startBatchLoading(systemStructures, 30);
      } else {
        setLoadedScopeIds(systemStructures.length > 0 ? systemStructures : DEFAULT_INITIAL_STRUCTURE_IDS);
      }
    } else if (newScope === "all") {
      // Progressive batch loading for all 2,905 structures
      const allIds = combinedStructures.map((s) => s.id);
      startBatchLoading(allIds, 40);
    }
  };

  const startBatchLoading = (targetIds: string[], batchSize = 30) => {
    cancelBatchRef.current = false;
    setBatchLoading(true);
    setBatchProgress({ current: Math.min(batchSize, targetIds.length), total: targetIds.length });

    // Seed with first batch
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

      // Yield frame to keep UI and WebGL responsive
      setTimeout(loadNextBatch, 80);
    };

    setTimeout(loadNextBatch, 80);
  };

  const handleCancelBatch = () => {
    cancelBatchRef.current = true;
    setBatchLoading(false);
    setBatchProgress(null);
  };

  const handleStructureSelect = (structureId: string | null) => {
    if (structureId) {
      console.log(`PHASE 10 — Selected structure: ${structureId}`);
    } else {
      console.log("PHASE 10 — Deselected structure");
    }
    setSelectedStructure(structureId);
    if (structureId) {
      onStructureSelected?.(structureId);
      if (scopeMode === "selected") {
        setLoadedScopeIds([structureId]);
      } else if (scopeMode === "system") {
        const sys = getStructureDetails(structureId)?.system;
        if (sys) {
          const sysIds = combinedStructures
            .filter((s) => s.system?.toLowerCase() === sys.toLowerCase())
            .map((s) => s.id);
          if (sysIds.length > 50) {
            startBatchLoading(sysIds, 30);
          } else {
            setLoadedScopeIds(sysIds);
          }
        }
      }
    }
  };

  const handleListItemClick = (structureId: string) => {
    console.log(`PHASE 12 — Structure list item selected: ${structureId}`);
    handleStructureSelect(structureId);
  };

  const handleToggleHide = () => {
    if (!selectedStructure) return;
    const isCurrentlyHidden = hiddenStructures.has(selectedStructure);
    console.log(
      `PHASE 11 — ${isCurrentlyHidden ? "Show" : "Hide"} requested for: ${selectedStructure}`
    );

    const nextHidden = new Set(hiddenStructures);
    if (isCurrentlyHidden) {
      nextHidden.delete(selectedStructure);
      setHiddenStructures(nextHidden);
    } else {
      nextHidden.add(selectedStructure);
      setHiddenStructures(nextHidden);
      // Clean up selection so hidden structure is no longer selected
      setSelectedStructure(null);
    }
  };

  const handleShowAll = () => {
    console.log("PHASE 11 — Show All requested");
    setHiddenStructures(new Set());
  };

  const handleResetView = () => {
    console.log("PHASE 11 — Reset View requested");
    setResetTrigger((prev) => prev + 1);
  };

  const handleFocus = () => {
    if (!selectedStructure) return;
    console.log(`PHASE 11 — Focus requested on: ${selectedStructure}`);
    setFocusTrigger((prev) => prev + 1);
  };

  // Derive set of directly related structure IDs from existing bidirectional relationship data
  const relatedStructureIds = React.useMemo(() => {
    if (!selectedStructure) return new Set<string>();
    const rels = getRelationshipsForStructure(selectedStructure);
    return new Set(rels.map((r) => r.otherStructureId));
  }, [selectedStructure]);

  // Compute effective structure IDs based on prop override, scopeMode, and loadedScopeIds
  const effectiveStructureIdsToRender = React.useMemo(() => {
    if (structureIds.length > 0) return structureIds;
    if (scopeMode === "selected") {
      return selectedStructure ? [selectedStructure] : DEFAULT_INITIAL_STRUCTURE_IDS;
    }
    return loadedScopeIds;
  }, [structureIds, scopeMode, selectedStructure, loadedScopeIds]);

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas
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

      {/* Left Sidebar: Search and Structure List panel */}
      <div className="absolute top-4 left-4 w-72 sm:w-80 max-h-[calc(100vh-2rem)] flex flex-col gap-2 pointer-events-none z-10">
        {/* Structure List & Search Panel */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-md flex flex-col overflow-hidden pointer-events-auto">
          {/* Panel Header with toggle */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Structures
              </span>
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

          {/* Search bar inside panel */}
          <div className="p-2 border-b border-slate-800/80">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anatomy..."
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

          {/* System Filter Chips */}
          <div className="px-2 py-1.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSystem(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                selectedSystem === null
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80"
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
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80"
                  }`}
                >
                  {sys}
                </button>
              );
            })}
          </div>

          {/* Structure List items */}
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
                      onClick={() => handleListItemClick(s.id)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${
                        isSelected
                          ? "bg-blue-900/50 border-l-4 border-l-blue-400"
                          : "hover:bg-slate-800/60"
                      } ${isHidden ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-medium ${isSelected ? "text-blue-200" : "text-white"}`}>
                          {s.names?.en ?? s.id}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isHidden && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800/60 font-medium">
                              Hidden
                            </span>
                          )}
                          {s.system && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                              {s.system}
                            </span>
                          )}
                        </div>
                      </div>
                      {s.names?.ko && (
                        <span className="text-[11px] text-slate-300">
                          {s.names.ko}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                  No structures match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* HUD: Selected structure info & Anatomy Detail Panel */}
        {selectedStructure && (() => {
          const details = getStructureDetails(selectedStructure);
          const anatomyDetail = getAnatomyDetail(selectedStructure);
          const relatedStructures = getRelationshipsForStructure(selectedStructure);

          return (
            <div className="bg-slate-900/90 text-white p-3.5 rounded-lg border border-blue-500 shadow-xl backdrop-blur-md space-y-2.5 pointer-events-auto max-h-96 overflow-y-auto">
              <div className="space-y-1 pb-2 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Selected Structure</p>
                  {hiddenStructures.has(selectedStructure) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700/60">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold">
                  {details?.names?.en ?? selectedStructure}
                  {details?.names?.ko && (
                    <span className="text-xs font-normal text-gray-300 ml-2">({details.names.ko})</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 font-mono">ID: {selectedStructure}</p>
                <div className="flex items-center gap-3 text-xs text-gray-300 pt-0.5">
                  {details?.system && (
                    <p>
                      <span className="text-gray-500">System:</span> {details.system}
                    </p>
                  )}
                  {details?.region && (
                    <p>
                      <span className="text-gray-500">Region:</span> {details.region}
                    </p>
                  )}
                </div>
              </div>

              {/* Detail Panel Content */}
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
                    {anatomyDetail.location && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Location</span>
                        <p className="text-slate-200 leading-relaxed text-[11px]">{anatomyDetail.location}</p>
                      </div>
                    )}
                    {anatomyDetail.clinical && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Clinical Significance</span>
                        <p className="text-slate-200 leading-relaxed text-[11px]">{anatomyDetail.clinical}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400 italic text-[11px] py-1">
                    No detailed information available.
                  </p>
                )}
              </div>

              {/* Anatomical Relationships Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                  Anatomical Relationships
                </span>
                {relatedStructures.length > 0 ? (
                  <div className="space-y-2">
                    {relatedStructures.map((relItem, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/60 p-2 rounded border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-200 text-[11px]">
                            {relItem.otherName}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50 font-mono">
                            {relItem.type}
                          </span>
                        </div>
                        {relItem.description && (
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {relItem.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px] py-1">
                    No anatomical relationships available.
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Action Controls & Visibility Scope: Focus, Hide / Show, Scope switcher, Reset View */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none z-10">
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Visibility Scope Segmented Buttons */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-0.5 flex items-center shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => handleScopeChange("default")}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                scopeMode === "default"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("selected")}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                scopeMode === "selected"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              Selected
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("system")}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                scopeMode === "system"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              System
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("all")}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                scopeMode === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              All
            </button>
          </div>

          <button
            type="button"
            onClick={handleFocus}
            disabled={!selectedStructure}
            className={`text-xs font-semibold px-3 py-2 rounded border shadow-md transition-colors ${
              selectedStructure
                ? "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-blue-400 cursor-pointer"
                : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60"
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={handleToggleHide}
            disabled={!selectedStructure}
            className={`text-xs font-semibold px-3 py-2 rounded border shadow-md transition-colors ${
              selectedStructure
                ? hiddenStructures.has(selectedStructure)
                  ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border-emerald-400 cursor-pointer"
                  : "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border-amber-400 cursor-pointer"
                : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60"
            }`}
          >
            {selectedStructure && hiddenStructures.has(selectedStructure) ? "Show" : "Hide"}
          </button>
          {hiddenStructures.size > 0 && (
            <button
              type="button"
              onClick={handleShowAll}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-emerald-400 text-xs font-semibold px-3 py-2 rounded border border-emerald-500/50 shadow-md transition-colors cursor-pointer"
            >
              Show All ({hiddenStructures.size})
            </button>
          )}
          <button
            type="button"
            onClick={handleResetView}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded border border-slate-600 shadow-md transition-colors cursor-pointer"
          >
            Reset View
          </button>
        </div>

        {/* Batch Loading Progress and Cancel Bar */}
        {batchLoading && batchProgress && (
          <div className="bg-slate-900/95 border border-blue-500/60 rounded-lg px-3 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-blue-300">Loading anatomy...</span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelBatch}
              className="text-xs px-2 py-1 bg-rose-600/80 hover:bg-rose-500 active:bg-rose-700 text-white rounded font-medium transition-colors shadow-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* HUD: Controls info */}
      <div className="absolute bottom-4 right-4 bg-slate-900 bg-opacity-80 text-white px-4 py-2 rounded text-xs text-gray-300">
        <p>Middle Mouse: Rotate | Scroll: Zoom | Right Drag: Pan</p>
      </div>
    </div>
  );
}

export default AnatomyViewer;
