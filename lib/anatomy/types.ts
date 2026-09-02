/**
 * Core domain types for the 3D Anatomy Atlas
 * 
 * Critical principle: AnatomyStructure (knowledge) ≠ Asset (3D representation)
 * One anatomical structure may have multiple assets.
 */

/**
 * Provenance metadata for tracking source, citation, and evidence
 */
export interface Provenance {
  sourceId?: string;
  sourceType?: string; // e.g., "BodyParts3D", "HRA", "user-input"
  sourceUrl?: string;

  citation?: string;

  evidenceLevel?: string;
  confidence?: number; // 0-1 scale

  retrievedAt?: string; // ISO timestamp
  processedAt?: string; // ISO timestamp

  notes?: string;
}

/**
 * Movement/animation metadata for future skeletal animation support
 */
export interface MovementMetadata {
  animationCapable: boolean;
  animationStatus: "planned" | "partial" | "implemented";
  rigId?: string;
  
  // Muscle-specific fields
  origin?: string;
  insertion?: string;
  action?: string;
}

/**
 * AnatomyStructure: Knowledge entity representing an anatomical structure
 * 
 * This is DISTINCT from Asset.
 * One AnatomyStructure may reference multiple Assets.
 */
export interface AnatomyStructure {
  // Internal unique identifier
  id: string;

  // External identifiers for cross-reference
  externalIds?: {
    fmaId?: string; // Foundational Model of Anatomy ID
    [key: string]: string | undefined;
  };

  // Multilingual names
  names: {
    ko?: string; // Korean
    en?: string; // English
    la?: string; // Latin
  };

  // Classification
  system?: string; // e.g., "skeletal", "muscular", "nervous"
  region?: string; // e.g., "lower_limb", "upper_limb"
  tissueType?: string; // e.g., "bone", "muscle", "nerve"

  // Hierarchical relationships
  parentIds?: string[];
  childIds?: string[];

  // Asset references
  assetRefs?: string[]; // Asset IDs

  // Animation support
  movement?: MovementMetadata;

  // Provenance
  provenance?: Provenance[];

  // Timestamps
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

/**
 * Detailed clinical and functional anatomy data schema
 * Keyed by structure ID
 */
export interface AnatomyDetail {
  description?: string;
  function?: string;
  location?: string;
  clinical?: string;
}

/**
 * Anatomical relationship between structures
 */
export interface AnatomyRelationship {
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
}

/**
 * Asset: 3D representation or resource for an AnatomyStructure
 * 
 * One Asset may represent one or more AnatomyStructures.
 * Assets are distinct from the knowledge they represent.
 */
export interface Asset {
  // Asset identifier
  assetId: string;

  // References to AnatomyStructure IDs this asset represents
  structureIds: string[];

  // File information
  originalFilename?: string;
  processedFilename?: string;

  // Source information
  source: string; // e.g., "BodyParts3D"
  sourceVersion?: string;
  sourceUrl?: string;

  // Licensing
  license?: string; // e.g., "CC-BY-NC"
  attribution?: string;

  // Processing metadata
  downloadedAt?: string; // ISO timestamp
  licenseCheckedAt?: string; // ISO timestamp
  derivativeStatus?: string; // e.g., "original", "simplified", "compressed"

  // Technical specifications
  format?: string; // e.g., "glb", "gltf", "obj"
  fileSize?: number; // bytes
  triangleCount?: number;
  
  // Storage location (relative to processed directory)
  storagePath?: string;

  // Notes
  notes?: string;

  // Provenance
  provenance?: Provenance[];

  // Timestamps
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

/**
 * Registry entry for tracking all anatomy structures and assets
 */
export interface RegistryEntry {
  structures: AnatomyStructure[];
  assets: Asset[];
  relationships?: AnatomyRelationship[];
  metadata: {
    version: string;
    lastUpdated: string; // ISO timestamp
    source: string;
    notes?: string;
  };
}

/**
 * Validation errors for processing pipeline
 */
export interface ProcessingError {
  type: "validation" | "conversion" | "metadata" | "asset";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result of processing operation
 */
export interface ProcessingResult {
  success: boolean;
  assetPath?: string;
  metadata?: Asset;
  errors: ProcessingError[];
  warnings: string[];
}
