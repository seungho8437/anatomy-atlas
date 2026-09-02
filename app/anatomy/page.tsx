/**
 * 3D Anatomy Atlas - Main Page
 * 
 * Phase 1 MVP: Interactive 3D visualization of anatomical structures
 */

import { AnatomyViewer } from "@/components/anatomy/viewer/AnatomyViewer";

export default function AnatomyPage() {
  return (
    <main className="w-full h-screen">
      <AnatomyViewer
        structureIds={["bone.femur", "bone.tibia", "muscle.sartorius"]}
        showGrid={true}
        showEnvironment={true}
      />
    </main>
  );
}
