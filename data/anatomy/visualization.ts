import { AnatomyStructure } from "@/lib/anatomy/types";

export interface AnatomyMaterialStyle {
  color: string;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  opacity?: number;
  transparent?: boolean;
}

/**
 * Visual Material Presets by anatomical tissue type and organ system.
 * Designed for realistic, clean, and distinct medical atlas aesthetics.
 */
export const ANATOMY_MATERIAL_PRESETS: Record<string, AnatomyMaterialStyle> = {
  // Skeletal: Light ivory / bone appearance with slight roughness
  bone: {
    color: "#E8DFC8", // Warm ivory bone color
    roughness: 0.65,
    metalness: 0.05,
  },
  skeletal: {
    color: "#E8DFC8",
    roughness: 0.65,
    metalness: 0.05,
  },

  // Muscular: Deep red/crimson muscle appearance with subtle gloss
  muscle: {
    color: "#992224", // Deep anatomical muscle red
    roughness: 0.35,
    metalness: 0.1,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  },
  muscular: {
    color: "#992224",
    roughness: 0.35,
    metalness: 0.1,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  },

  // Nervous: Characteristic yellow/golden nerve tissue appearance
  nerve: {
    color: "#F5C542", // Warm golden nerve yellow
    roughness: 0.45,
    metalness: 0.05,
  },
  nervous: {
    color: "#F5C542",
    roughness: 0.45,
    metalness: 0.05,
  },

  // Vascular / Cardiovascular: Distinct arterial/vascular crimson-red
  vessel: {
    color: "#D9383A", // Vibrant arterial red
    roughness: 0.3,
    metalness: 0.15,
  },
  vascular: {
    color: "#D9383A",
    roughness: 0.3,
    metalness: 0.15,
  },
  cardiovascular: {
    color: "#D9383A",
    roughness: 0.3,
    metalness: 0.15,
  },

  // Visceral / Organs: Natural anatomical organ tones
  organ: {
    color: "#A8534C", // Natural viscera brown-red
    roughness: 0.4,
    metalness: 0.05,
  },
  urinary: {
    color: "#8C4A3E", // Kidney/urinary dark red-brown
    roughness: 0.4,
    metalness: 0.05,
  },

  // Fallback for unclassified / other structures
  other: {
    color: "#8FA3AD", // Neutral anatomical steel blue-gray
    roughness: 0.5,
    metalness: 0.1,
  },
};

/**
 * Derives the visual 3D material style for any given AnatomyStructure.
 * Prioritizes specific `tissueType` over broader `system`, with safe fallback to `other`.
 */
export function getAnatomyMaterialStyle(
  structure: AnatomyStructure | null | undefined
): AnatomyMaterialStyle {
  if (!structure) {
    return ANATOMY_MATERIAL_PRESETS.other;
  }

  // 1. Check tissueType
  if (structure.tissueType && ANATOMY_MATERIAL_PRESETS[structure.tissueType.toLowerCase()]) {
    return ANATOMY_MATERIAL_PRESETS[structure.tissueType.toLowerCase()];
  }

  // 2. Check system
  if (structure.system && ANATOMY_MATERIAL_PRESETS[structure.system.toLowerCase()]) {
    return ANATOMY_MATERIAL_PRESETS[structure.system.toLowerCase()];
  }

  // 3. Fallback
  return ANATOMY_MATERIAL_PRESETS.other;
}
