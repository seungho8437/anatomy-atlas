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

// Minimal structureId -> asset storagePath lookup (registry-backed, no new Asset Registry abstraction)
function getAssetPathForStructure(structureId: string): string | null {
  const structure = structuresRegistry.structures.find((s) => s.id === structureId);
  const assetId = structure?.assetRefs?.[0];
  if (!assetId) return null;
  const asset = structuresRegistry.assets.find((a) => a.assetId === assetId);
  return asset?.storagePath ?? null;
}

function getStructureDetails(structureId: string) {
  return structuresRegistry.structures.find((s) => s.id === structureId) ?? null;
}

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
  assetPath,
  isSelected,
  hidden = false,
  onLoaded,
  onSelect,
}: {
  structureId: string;
  assetPath: string;
  isSelected: boolean;
  hidden?: boolean;
  onLoaded: (
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
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = false;
        if (!originalMaterialsRef.current.has(object)) {
          if (Array.isArray(object.material)) {
            const cloned = object.material.map((m) => m.clone());
            object.material = cloned;
            originalMaterialsRef.current.set(object, cloned);
          } else if (object.material) {
            const cloned = object.material.clone();
            object.material = cloned;
            originalMaterialsRef.current.set(object, cloned);
          }
        }
      }
    });

    onLoaded(structureId, scene);
  }, [scene, structureId, onLoaded]);

  // Apply visual highlight non-destructively based on isSelected
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
  }, [scene, isSelected]);

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
 * STEP 3-8
 *
 * Prototype scene for validating the BodyParts3D shared coordinate system.
 *
 * All assets remain in their original coordinates.
 * Only the parent SceneGroup receives centering and normalization.
 */
function SharedCoordinateScene({
  structureIds,
  selectedStructure,
  hiddenStructures = new Set<string>(),
  onSelect,
  onScenesLoaded,
}: {
  structureIds: string[];
  selectedStructure: string | null;
  hiddenStructures?: Set<string>;
  onSelect: (id: string) => void;
  onScenesLoaded?: (scenes: Map<string, THREE.Object3D>) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const loadedScenesRef = useRef(
    new Map<string, THREE.Object3D>()
  );

  const [version, setVersion] = useState(0);

  const handleLoaded = React.useCallback(
    (structureId: string, scene: THREE.Object3D) => {
      loadedScenesRef.current.set(structureId, scene);
      setVersion((value) => value + 1);
      onScenesLoaded?.(loadedScenesRef.current);
    },
    [onScenesLoaded]
  );

  const assets = structureIds
    .map((structureId) => ({
      structureId,
      assetPath: getAssetPathForStructure(structureId),
    }))
    .filter(
      (
        item
      ): item is {
        structureId: string;
        assetPath: string;
      } => item.assetPath !== null
    );

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

    loadedScenesRef.current.forEach((scene) => {
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

    console.log(
      "STEP 3-8 — Shared Coordinate Prototype"
    );

    console.log("Combined bounds:", {
      min: combinedBox.min.toArray(),
      max: combinedBox.max.toArray(),
    });

    console.log(
      "Combined center:",
      center.toArray()
    );

    console.log(
      "Combined size:",
      size.toArray()
    );

    console.log(
      "Combined maxDimension:",
      maxDimension
    );

    // IMPORTANT:
    // Only the parent scene is transformed.
    //
    // Individual BodyParts3D assets retain their
    // original coordinates and relative scale.
    const sharedScale = 2 / maxDimension;

    groupRef.current.position.set(
      -center.x * sharedScale,
      -center.y * sharedScale,
      -center.z * sharedScale
    );

    groupRef.current.scale.setScalar(sharedScale);

    groupRef.current.updateMatrixWorld(true);

    const worldBox = new THREE.Box3().setFromObject(
      groupRef.current
    );

    const worldCenter = worldBox.getCenter(
      new THREE.Vector3()
    );

    const worldSize = worldBox.getSize(
      new THREE.Vector3()
    );

    console.log(
      "PHASE 3-8 — World Box Center:",
      worldCenter.toArray()
    );

    console.log(
      "PHASE 3-8 — World Box Size:",
      worldSize.toArray()
    );
  }, [version]);

  return (
    <group ref={groupRef}>
      {assets.map(
        ({ structureId, assetPath }) => (
          <SharedCoordinateAsset
            key={structureId}
            structureId={structureId}
            assetPath={assetPath}
            isSelected={selectedStructure === structureId}
            hidden={hiddenStructures.has(structureId)}
            onLoaded={handleLoaded}
            onSelect={onSelect}
          />
        )
      )}
    </group>
  );
}

/**
 * Canvas content component
 */
function AnatomyCanvasContent({
  structureIds = [],
  selectedStructure,
  hiddenStructures = new Set<string>(),
  resetTrigger,
  focusTrigger,
  onStructureSelected,
}: {
  structureIds: string[];
  selectedStructure: string | null;
  hiddenStructures?: Set<string>;
  resetTrigger: number;
  focusTrigger: number;
  onStructureSelected?: (id: string) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const loadedScenesMapRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const handleScenesLoaded = React.useCallback((scenes: Map<string, THREE.Object3D>) => {
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

  // Handle Focus trigger on selected structure
  useEffect(() => {
    if (focusTrigger === 0 || !selectedStructure) return;
    const targetScene = loadedScenesMapRef.current.get(selectedStructure);
    if (!targetScene) return;

    // Compute bounding box in world space
    targetScene.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(targetScene);
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

  const effectiveStructureIds = Array.from(new Set([
    ...structureIds,
    "nerve.optic",
    "vessel.femoral.artery",
    "organ.kidney.right",
    "bone.hip.right",
    "bone.patella.right"
  ]));

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

{/* STEP 3-8: Shared BodyParts3D coordinate prototype */}
<SharedCoordinateScene
  structureIds={effectiveStructureIds}
  selectedStructure={selectedStructure}
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
  const [resetTrigger, setResetTrigger] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const handleStructureSelect = (structureId: string | null) => {
    if (structureId) {
      console.log(`PHASE 10 — Selected structure: ${structureId}`);
    } else {
      console.log("PHASE 10 — Deselected structure");
    }
    setSelectedStructure(structureId);
    if (structureId) {
      onStructureSelected?.(structureId);
    }
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

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas
        className="w-full h-full"
        onPointerMissed={() => handleStructureSelect(null)}
      >
        <AnatomyCanvasContent
          structureIds={
            structureIds.length > 0
              ? Array.from(new Set([...structureIds, "vessel.femoral.artery", "organ.kidney.right", "bone.hip.right", "bone.patella.right"]))
              : ["bone.femur", "bone.tibia", "muscle.sartorius", "nerve.optic", "vessel.femoral.artery", "organ.kidney.right", "bone.hip.right", "bone.patella.right"]
          }
          selectedStructure={selectedStructure}
          hiddenStructures={hiddenStructures}
          resetTrigger={resetTrigger}
          focusTrigger={focusTrigger}
          onStructureSelected={handleStructureSelect}
        />
      </Canvas>

      {/* HUD: Selected structure info */}
      {selectedStructure && (() => {
        const details = getStructureDetails(selectedStructure);
        return (
          <div className="absolute top-4 left-4 bg-slate-900 bg-opacity-80 text-white p-4 rounded border border-blue-500 max-w-xs space-y-1">
            <p className="text-sm font-semibold text-blue-400">Selected Structure</p>
            <p className="text-base font-bold">
              {details?.names?.en ?? selectedStructure}
              {details?.names?.ko && (
                <span className="text-xs font-normal text-gray-300 ml-2">({details.names.ko})</span>
              )}
            </p>
            <p className="text-xs text-gray-400">ID: {selectedStructure}</p>
            {details?.system && (
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">System:</span> {details.system}
              </p>
            )}
            {details?.region && (
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">Region:</span> {details.region}
              </p>
            )}
          </div>
        );
      })()}

      {/* Action Controls: Focus, Hide / Show, Show All, and Reset View buttons */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
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

      {/* HUD: Controls info */}
      <div className="absolute bottom-4 right-4 bg-slate-900 bg-opacity-80 text-white px-4 py-2 rounded text-xs text-gray-300">
        <p>Middle Mouse: Rotate | Scroll: Zoom | Right Drag: Pan</p>
      </div>
    </div>
  );
}

export default AnatomyViewer;
