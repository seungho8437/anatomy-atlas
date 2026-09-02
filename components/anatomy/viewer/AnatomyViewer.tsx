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
 * Canvas content component
 */
function AnatomyCanvasContent({
  structureIds = [],
  onStructureSelected,
}: {
  structureIds: string[];
  onStructureSelected?: (id: string) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // Reset camera position
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate={false}
        enablePan={true}
      />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />

      <Grid args={[10, 10]} cellColor={"#6f6f6f"} sectionColor={"#9d4edd"} infiniteGrid />

      {/* Render real GLB assets where available, placeholder otherwise */}
      {(structureIds.length === 0 ? ["bone.femur"] : structureIds).map((structureId) => {
        const assetPath = getAssetPathForStructure(structureId);
        return assetPath ? (
          <RealStructure
            key={structureId}
            structureId={structureId}
            assetPath={assetPath}
            onSelect={onStructureSelected || (() => {})}
          />
        ) : (
          <PlaceholderStructure
            key={structureId}
            structureId={structureId}
            onSelect={onStructureSelected || (() => {})}
          />
        );
      })}

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

  const handleStructureSelect = (structureId: string) => {
    setSelectedStructure(structureId);
    onStructureSelected?.(structureId);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas className="w-full h-full">
        <AnatomyCanvasContent
          structureIds={structureIds.length > 0 ? structureIds : ["bone.femur"]}
          onStructureSelected={handleStructureSelect}
        />
      </Canvas>

      {/* HUD: Selected structure info */}
      {selectedStructure && (
        <div className="absolute top-4 left-4 bg-slate-900 bg-opacity-80 text-white px-4 py-2 rounded border border-blue-500">
          <p className="text-sm font-semibold">Selected Structure</p>
          <p className="text-xs text-gray-300">{selectedStructure}</p>
        </div>
      )}

      {/* HUD: Controls info */}
      <div className="absolute bottom-4 right-4 bg-slate-900 bg-opacity-80 text-white px-4 py-2 rounded text-xs text-gray-300">
        <p>Middle Mouse: Rotate | Scroll: Zoom | Right Drag: Pan</p>
      </div>
    </div>
  );
}

export default AnatomyViewer;
