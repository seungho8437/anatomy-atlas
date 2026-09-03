import * as fs from 'fs';
import * as path from 'path';
import type { AnatomyStructure, Asset } from '../../lib/anatomy/types';

export interface ClassificationResult {
  system: string;
  tissueType: string;
}

/**
 * Deterministic, conservative classification rules for BodyParts3D anatomical concepts.
 * Keeps system and tissueType independent.
 * Falls back to "other" / "other" if ambiguous.
 */
export function classifyAnatomicalTerm(englishName: string): ClassificationResult {
  const lower = englishName.toLowerCase();

  // 1. Skeletal System & Bone/Cartilage Tissue
  if (
    /\b(bone|skeleton|vertebra|vertebrae|rib|skull|femur|tibia|fibula|patella|clavicle|scapula|humerus|radius|ulna|pelvis|ilium|ischium|pubis|sacrum|coccyx|calcaneus|talus|phalanx|phalanges|metatarsal|metatarsals|metacarpal|metacarpals|carpal|carpals|tarsal|tarsals|mandible|maxilla|cranium|sternum|hyoid|sphenoid|ethmoid|lacrimal bone|zygomatic|nasal bone|vomer|palatine|parietal|temporal|frontal bone|occipital|costal cartilage|articular cartilage|intervertebral disc|suture|joint|epiphysis|diaphysis)\b/i.test(
      lower
    )
  ) {
    return { system: 'skeletal', tissueType: 'bone' };
  }

  // 2. Muscular System & Muscle Tissue
  if (
    /\b(muscle|muscles|musculus|musculi|sartorius|gluteus|quadriceps|biceps|triceps|deltoid|pectoralis|gastrocnemius|soleus|trapezius|latissimus|rectus|vastus|gracilis|tibialis|peroneus|fibularis|pronator|supinator|flexor|extensor|abductor|adductor|levator|depressor|sphincter|masseter|temporalis|pterygoid|diaphragm|tendon|aponeurosis|fascia)\b/i.test(
      lower
    )
  ) {
    return { system: 'muscular', tissueType: 'muscle' };
  }

  // 3. Nervous System & Nerve/Brain Tissue
  if (
    /\b(nerve|nerves|nervus|nervi|brain|cerebrum|cerebellum|spinal cord|medulla|pons|thalamus|hypothalamus|hippocampus|ganglion|ganglia|plexus|optic chiasm|retina|tract|tractus|cortex|gyrus|sulcus|ventricle of brain|corpus callosum|dura mater|pia mater|arachnoid mater|meninx|meninges)\b/i.test(
      lower
    )
  ) {
    return { system: 'nervous', tissueType: 'nerve' };
  }

  // 4. Vascular / Cardiovascular System & Vessel Tissue
  if (
    /\b(artery|arteries|arteria|arteriae|vein|veins|vena|venae|aorta|arteriole|arterioles|venule|venules|vascular|sinus|atrium|ventricle of heart|valve of heart|pericardium|endocardium|myocardium|capillary|capillaries|trunk|anastomosis)\b/i.test(
      lower
    )
  ) {
    return { system: 'vascular', tissueType: 'vessel' };
  }

  // 5. Organ / Visceral System (Digestive, Respiratory, Urinary, Reproductive, Endocrine)
  if (
    /\b(kidney|liver|lung|lungs|heart|stomach|pancreas|spleen|bladder|gallbladder|thyroid|thymus|prostate|uterus|ovary|ovaries|testis|testes|intestine|colon|duodenum|jejunum|ileum|cecum|appendix|rectum|esophagus|trachea|bronchus|bronchi|larynx|pharynx|tonsil|parotid|submandibular|sublingual|ureter|urethra|suprarenal|adrenal|pituitary)\b/i.test(
      lower
    )
  ) {
    return { system: 'organ', tissueType: 'organ' };
  }

  // 6. Conservative Fallback
  return { system: 'other', tissueType: 'other' };
}

export interface BP3DConcept {
  conceptId: string; // e.g. "FMA24474"
  numericFmaId: string; // e.g. "24474"
  bp3dId: string; // e.g. "BP8920"
  englishName: string;
  elementFileIds: string[];
}

export interface CandidateRegistryOutput {
  source: string;
  sourceVersion: string;
  license: string;
  attribution: string;
  generatedAt: string;
  testMode: boolean;
  totalConcepts: number;
  totalAssets: number;
  structures: AnatomyStructure[];
  assets: Asset[];
}

export interface ParseResult {
  concepts: BP3DConcept[];
  mappingRecordCount: number;
  uniqueElementIds: Set<string>;
  duplicateFmaIdsInSource: string[];
  duplicateBp3dIdsInSource: string[];
  emptyNameConcepts: string[];
  parseErrors: string[];
}

/**
 * Parses isa_parts_list_e.txt and isa_element_parts.txt
 */
export function parseFullBP3DMetadata(
  partsListPath: string,
  elementPartsPath: string
): ParseResult {
  const parseErrors: string[] = [];
  const duplicateFmaIdsInSource: string[] = [];
  const duplicateBp3dIdsInSource: string[] = [];
  const emptyNameConcepts: string[] = [];

  if (!fs.existsSync(partsListPath)) {
    throw new Error(`File not found: ${partsListPath}`);
  }
  if (!fs.existsSync(elementPartsPath)) {
    throw new Error(`File not found: ${elementPartsPath}`);
  }

  const partsListContent = fs.readFileSync(partsListPath, 'utf8');
  const elementPartsContent = fs.readFileSync(elementPartsPath, 'utf8');

  // 1. Parse Element Parts Mapping (FMA -> Elements[])
  let mappingRecordCount = 0;
  const elemMap = new Map<string, string[]>();
  const uniqueElementIds = new Set<string>();

  const elementLines = elementPartsContent.split(/\r?\n/);
  for (let i = 1; i < elementLines.length; i++) {
    const line = elementLines[i].trim();
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 3) {
      parseErrors.push(`Malformed row in element parts (line ${i + 1}): "${line}"`);
      continue;
    }
    mappingRecordCount++;
    const [fmaId, , elementId] = cols;
    const cleanFma = fmaId.trim();
    const cleanElem = elementId.trim();
    uniqueElementIds.add(cleanElem);

    if (!elemMap.has(cleanFma)) {
      elemMap.set(cleanFma, []);
    }
    elemMap.get(cleanFma)!.push(cleanElem);
  }

  // 2. Parse Concepts from Parts List
  const concepts: BP3DConcept[] = [];
  const fmaSeen = new Set<string>();
  const bpSeen = new Set<string>();

  const partsLines = partsListContent.split(/\r?\n/);
  for (let i = 1; i < partsLines.length; i++) {
    const line = partsLines[i].trim();
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 3) {
      parseErrors.push(`Malformed row in parts list (line ${i + 1}): "${line}"`);
      continue;
    }
    const [fmaId, bpId, englishName] = cols;
    const cleanFma = fmaId.trim();
    const cleanBp = bpId ? bpId.trim() : '';
    const cleanName = englishName ? englishName.trim() : '';

    if (!cleanName) {
      emptyNameConcepts.push(cleanFma);
    }

    if (fmaSeen.has(cleanFma)) {
      duplicateFmaIdsInSource.push(cleanFma);
    }
    fmaSeen.add(cleanFma);

    if (cleanBp) {
      if (bpSeen.has(cleanBp)) {
        duplicateBp3dIdsInSource.push(cleanBp);
      }
      bpSeen.add(cleanBp);
    }

    const numericMatch = cleanFma.match(/\d+/);
    const numericFmaId = numericMatch ? numericMatch[0] : cleanFma;

    const rawElements = elemMap.get(cleanFma) || [];
    const uniqueElements = Array.from(new Set(rawElements));

    concepts.push({
      conceptId: cleanFma,
      numericFmaId,
      bp3dId: cleanBp,
      englishName: cleanName,
      elementFileIds: uniqueElements,
    });
  }

  return {
    concepts,
    mappingRecordCount,
    uniqueElementIds,
    duplicateFmaIdsInSource,
    duplicateBp3dIdsInSource,
    emptyNameConcepts,
    parseErrors,
  };
}

/**
 * Builds candidate AnatomyStructure and Asset records for all concepts
 */
export function buildCandidateRegistry(concepts: BP3DConcept[]): {
  structures: AnatomyStructure[];
  assets: Asset[];
  duplicateGeneratedFmaIds: string[];
  duplicateGeneratedAssetIds: string[];
} {
  const structures: AnatomyStructure[] = [];
  const assets: Asset[] = [];
  const fmaSeen = new Set<string>();
  const duplicateGeneratedFmaIds: string[] = [];
  const assetSeen = new Set<string>();
  const duplicateGeneratedAssetIds: string[] = [];

  const timestamp = new Date().toISOString();

  for (const concept of concepts) {
    const structureId = `fma.${concept.numericFmaId}`;

    if (fmaSeen.has(structureId)) {
      duplicateGeneratedFmaIds.push(structureId);
    }
    fmaSeen.add(structureId);

    const assetRefs: string[] = [];

    for (const elemId of concept.elementFileIds) {
      const lowerElem = elemId.toLowerCase();
      const assetId = `asset.fma${concept.numericFmaId}.${lowerElem}.bp3d.v1`;
      assetRefs.push(assetId);

      if (assetSeen.has(assetId)) {
        duplicateGeneratedAssetIds.push(assetId);
      }
      assetSeen.add(assetId);

      const assetRecord: Asset = {
        assetId,
        structureIds: [structureId],
        source: 'BodyParts3D',
        sourceVersion: '4.0',
        originalFilename: `${elemId}.obj`,
        processedFilename: `fma${concept.numericFmaId}_${lowerElem}.glb`,
        format: 'glb',
        storagePath: `public/assets/bodyparts3d/fma${concept.numericFmaId}_${lowerElem}.glb`,
        license: 'CC-BY-SA-2.1-JP',
        notes: `Asset derived from BodyParts3D element ${elemId} for ${concept.englishName} (${concept.conceptId}).`,
        createdAt: timestamp,
      };

      assets.push(assetRecord);
    }

    const { system, tissueType } = classifyAnatomicalTerm(concept.englishName);

    const structureRecord: AnatomyStructure = {
      id: structureId,
      externalIds: {
        fmaId: `FMA:${concept.numericFmaId}`,
        bp3dId: concept.bp3dId,
      },
      names: {
        en: concept.englishName,
      },
      system,
      tissueType,
      assetRefs,
      createdAt: timestamp,
    };

    structures.push(structureRecord);
  }

  return {
    structures,
    assets,
    duplicateGeneratedFmaIds,
    duplicateGeneratedAssetIds,
  };
}

/**
 * Main execution logic
 */
export function run(): void {
  const isExecute = process.argv.includes('--execute');
  const mode = isExecute ? 'EXECUTE' : 'DRY-RUN';

  const rootDir = process.cwd();
  const partsListPath = path.join(rootDir, 'tmp_bp3d', 'isa_parts_list_e.txt');
  const elementPartsPath = path.join(rootDir, 'tmp_bp3d', 'isa_element_parts.txt');
  const outputPath = path.join(rootDir, 'tmp_bp3d', 'bp3d-registry-full-generated.json');
  const existingRegistryPath = path.join(rootDir, 'data', 'registry', 'structures.json');

  console.log('================================================================');
  console.log(`  BodyParts3D Production Bulk Registry Builder [${mode}]        `);
  console.log('================================================================\n');

  // 1. Full Metadata Parsing
  const {
    concepts,
    mappingRecordCount,
    uniqueElementIds,
    duplicateFmaIdsInSource,
    duplicateBp3dIdsInSource,
    emptyNameConcepts,
    parseErrors,
  } = parseFullBP3DMetadata(partsListPath, elementPartsPath);

  // 2. Build Full Candidate Records
  const {
    structures,
    assets,
    duplicateGeneratedFmaIds,
    duplicateGeneratedAssetIds,
  } = buildCandidateRegistry(concepts);

  // 3. Write Candidate Registry JSON
  const outputData: CandidateRegistryOutput = {
    source: 'BodyParts3D',
    sourceVersion: '4.0',
    license: 'CC-BY-SA-2.1-JP',
    attribution: 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
    generatedAt: new Date().toISOString(),
    testMode: false,
    totalConcepts: structures.length,
    totalAssets: assets.length,
    structures,
    assets,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`[1] Full candidate registry written to:\n    ${outputPath}\n`);

  // 4. Statistics Breakdown
  let count1 = 0;
  let countN = 0;
  let count0 = 0;
  let totalElementRefs = 0;

  const systemCounts: Record<string, number> = {
    skeletal: 0,
    muscular: 0,
    nervous: 0,
    vascular: 0,
    organ: 0,
    other: 0,
  };

  for (const c of concepts) {
    totalElementRefs += c.elementFileIds.length;
    if (c.elementFileIds.length === 1) count1++;
    else if (c.elementFileIds.length > 1) countN++;
    else count0++;
  }

  for (const s of structures) {
    const sys = s.system || 'other';
    systemCounts[sys] = (systemCounts[sys] || 0) + 1;
  }

  console.log('----------------------------------------------------------------');
  console.log('                 DATASET SCALE VALIDATION                       ');
  console.log('----------------------------------------------------------------');
  console.log(`Total Concepts parsed           : ${concepts.length} (Expected: 2,905)`);
  console.log(`  - 1:1 Concepts (Single elem)  : ${count1} (Expected: 1,464)`);
  console.log(`  - 1:N Concepts (Multi elem)   : ${countN} (Expected: 1,441)`);
  console.log(`  - 0 ELEMENT Concepts          : ${count0} (Expected: 0)`);
  console.log(`Concept-ELEMENT mapping records : ${mappingRecordCount} (Expected: 29,549)`);
  console.log(`Unique ELEMENT OBJ IDs in map   : ${uniqueElementIds.size} (Expected: 2,234)`);
  console.log(`Total Asset records generated   : ${assets.length}`);

  const scaleMatches =
    concepts.length === 2905 &&
    count1 === 1464 &&
    countN === 1441 &&
    count0 === 0 &&
    mappingRecordCount === 29549;

  console.log(`Dataset scale audit status      : ${scaleMatches ? 'MATCH (PASS)' : 'DISCREPANCY (FAIL)'}`);

  console.log('\n----------------------------------------------------------------');
  console.log('                 CLASSIFICATION BREAKDOWN                       ');
  console.log('----------------------------------------------------------------');
  console.log(`  - Skeletal : ${systemCounts.skeletal.toString().padStart(5)} (${((systemCounts.skeletal / concepts.length) * 100).toFixed(1)}%)`);
  console.log(`  - Muscular : ${systemCounts.muscular.toString().padStart(5)} (${((systemCounts.muscular / concepts.length) * 100).toFixed(1)}%)`);
  console.log(`  - Nervous  : ${systemCounts.nervous.toString().padStart(5)} (${((systemCounts.nervous / concepts.length) * 100).toFixed(1)}%)`);
  console.log(`  - Vascular : ${systemCounts.vascular.toString().padStart(5)} (${((systemCounts.vascular / concepts.length) * 100).toFixed(1)}%)`);
  console.log(`  - Organ    : ${systemCounts.organ.toString().padStart(5)} (${((systemCounts.organ / concepts.length) * 100).toFixed(1)}%)`);
  console.log(`  - Other    : ${systemCounts.other.toString().padStart(5)} (${((systemCounts.other / concepts.length) * 100).toFixed(1)}%)`);

  console.log('\n----------------------------------------------------------------');
  console.log('                 DATA INTEGRITY REPORT                          ');
  console.log('----------------------------------------------------------------');
  console.log(`  - Parse/Join Errors           : ${parseErrors.length}`);
  console.log(`  - Duplicate Source FMA IDs    : ${duplicateFmaIdsInSource.length}`);
  console.log(`  - Duplicate Source BP3D IDs   : ${duplicateBp3dIdsInSource.length}`);
  console.log(`  - Duplicate Generated FMA IDs : ${duplicateGeneratedFmaIds.length}`);
  console.log(`  - Duplicate Generated AssetIDs: ${duplicateGeneratedAssetIds.length}`);
  console.log(`  - Empty English Names         : ${emptyNameConcepts.length}`);
  console.log(`  - Concepts with no AssetRefs  : ${count0}`);

  // 5. Cross-check Existing 8 Production Structures
  console.log('\n----------------------------------------------------------------');
  console.log('          CROSS-CHECK: EXISTING 8 PRODUCTION STRUCTURES          ');
  console.log('----------------------------------------------------------------');
  const existingRegistry = JSON.parse(fs.readFileSync(existingRegistryPath, 'utf8'));

  for (const existing of existingRegistry.structures) {
    const rawFma = existing.externalIds?.fmaId;
    const cleanFma = rawFma ? rawFma.replace(/[^0-9]/g, '') : '';
    const generatedConcept = concepts.find((c) => c.numericFmaId === cleanFma);

    const existingAsset = existingRegistry.assets.find((a: any) =>
      existing.assetRefs?.includes(a.assetId)
    );
    const existingObj = existingAsset?.originalFilename?.replace('.obj', '');

    const fmaMatch = generatedConcept !== undefined;
    const elemMatch =
      generatedConcept !== undefined &&
      (existingObj ? generatedConcept.elementFileIds.includes(existingObj) : true);

    const status = fmaMatch && elemMatch ? 'PASS' : 'FAIL';

    console.log(`[${status}] ID: ${existing.id}`);
    console.log(`       Existing FMA: ${rawFma} | Generated FMA: FMA:${generatedConcept?.numericFmaId}`);
    console.log(`       Existing Obj: ${existingObj || 'none'} | Generated Elements: [${generatedConcept?.elementFileIds.join(', ')}]`);
    console.log(`       Existing Korean: "${existing.names?.ko || ''}" | Generated Korean: (Curated in prod)`);
  }

  console.log('================================================================\n');
}

// Direct execution
run();

