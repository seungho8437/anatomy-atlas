import { AnatomyRelationship } from "./types";

/**
 * Minimal verified anatomical relationships foundation dataset
 * Connecting confirmed relationships between registered structures
 */
export const anatomyRelationships: AnatomyRelationship[] = [
  {
    sourceId: "bone.hip.right",
    targetId: "bone.femur",
    type: "articulates_with",
    description: "The acetabulum of the right hip bone articulates with the head of the right femur to form the hip joint.",
  },
  {
    sourceId: "bone.femur",
    targetId: "bone.tibia",
    type: "articulates_with",
    description: "The distal condyles of the right femur articulate with the proximal condyles of the right tibia to form the tibiofemoral joint of the knee.",
  },
  {
    sourceId: "bone.femur",
    targetId: "bone.patella.right",
    type: "articulates_with",
    description: "The patellar surface of the right femur articulates with the posterior facets of the right patella to form the patellofemoral joint.",
  },
];
