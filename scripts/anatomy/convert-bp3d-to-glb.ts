import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Locate obj2gltf module dynamically from npm-cache or require
function loadObj2gltf(): (inputPath: string, options: { binary: boolean }) => Promise<Buffer> {
  const localAppData = process.env.LOCALAPPDATA || '';
  const npmCacheDir = path.join(localAppData, 'npm-cache', '_npx');

  if (fs.existsSync(npmCacheDir)) {
    for (const sub of fs.readdirSync(npmCacheDir)) {
      const candidate = path.join(npmCacheDir, sub, 'node_modules', 'obj2gltf');
      if (fs.existsSync(candidate)) {
        return require(candidate);
      }
    }
  }

  // Fallback to direct require
  return require('obj2gltf');
}

export interface ConversionStats {
  timestamp: string;
  sourceVersion: string;
  totalReferenced: number;
  totalUnique: number;
  objFound: number;
  objMissing: number;
  glbCreated: number;
  glbSkipped: number;
  glbFailed: number;
  failedDetails: { elementId: string; inputPath: string; outputPath: string; error: string }[];
  totalDiskSizeBytes: number;
  largestGlb: { filename: string; sizeBytes: number };
}

export async function convertBulkBP3D(): Promise<ConversionStats> {
  const rootDir = process.cwd();
  const candidateRegistryPath = path.join(rootDir, 'tmp_bp3d', 'bp3d-registry-full-generated.json');
  const inputObjDir = path.join(rootDir, 'tmp_bp3d', 'isa_BP3D_4.0_obj_99');
  const outputGlbDir = path.join(rootDir, 'public', 'assets', 'bodyparts3d', 'bp3d');
  const reportPath = path.join(rootDir, 'tmp_bp3d', 'bp3d-glb-conversion-report.json');

  console.log('================================================================');
  console.log('       BodyParts3D Bulk OBJ → GLB Converter (Phase 16)         ');
  console.log('================================================================\n');

  if (!fs.existsSync(candidateRegistryPath)) {
    throw new Error(`Candidate registry not found: ${candidateRegistryPath}`);
  }

  if (!fs.existsSync(outputGlbDir)) {
    fs.mkdirSync(outputGlbDir, { recursive: true });
  }

  // 1. Read all unique ELEMENT IDs from generated candidate registry
  const registryData = JSON.parse(fs.readFileSync(candidateRegistryPath, 'utf8'));
  const uniqueElementsSet = new Set<string>();

  for (const s of registryData.structures) {
    for (const aId of s.assetRefs) {
      const match = aId.match(/fj[0-9a-z]+/i);
      if (match) {
        uniqueElementsSet.add(match[0].toUpperCase());
      }
    }
  }

  const sortedElements = Array.from(uniqueElementsSet).sort();

  console.log('----------------------------------------------------------------');
  console.log('                    PRE-FLIGHT AUDIT                            ');
  console.log('----------------------------------------------------------------');
  console.log(`Total Concepts in registry      : ${registryData.structures.length}`);
  console.log(`Total Unique ELEMENTs referenced: ${sortedElements.length} (Expected: 2,234)`);

  if (sortedElements.length !== 2234) {
    console.warn(`WARNING: Unique ELEMENT count is ${sortedElements.length}, expected 2,234.`);
  }

  // Check OBJ existence
  let objFoundCount = 0;
  let objMissingCount = 0;
  const missingObjList: string[] = [];
  let existingGlbCount = 0;
  let toConvertCount = 0;

  for (const elem of sortedElements) {
    const objPath = path.join(inputObjDir, `${elem}.obj`);
    const glbPath = path.join(outputGlbDir, `${elem}.glb`);

    if (fs.existsSync(objPath)) {
      objFoundCount++;
    } else {
      objMissingCount++;
      missingObjList.push(elem);
    }

    if (fs.existsSync(glbPath)) {
      existingGlbCount++;
    } else {
      toConvertCount++;
    }
  }

  console.log(`OBJ files found in archive/dir  : ${objFoundCount}`);
  console.log(`OBJ files missing               : ${objMissingCount}`);
  console.log(`Existing GLBs in target dir     : ${existingGlbCount}`);
  console.log(`GLBs requiring conversion       : ${toConvertCount}`);
  console.log('----------------------------------------------------------------\n');

  if (objMissingCount > 0) {
    console.error(`ERROR: ${objMissingCount} OBJ files are missing! Samples:`, missingObjList.slice(0, 5));
  }

  // 2. Load obj2gltf engine
  console.log('[*] Initializing high-speed obj2gltf pipeline...');
  const obj2gltf = loadObj2gltf();

  // 3. Perform idempotent conversion
  let glbCreated = 0;
  let glbSkipped = 0;
  let glbFailed = 0;
  const failedDetails: { elementId: string; inputPath: string; outputPath: string; error: string }[] = [];

  const startTime = Date.now();
  const total = sortedElements.length;

  console.log(`[*] Starting conversion of ${total} ELEMENT files...\n`);

  // Process in small parallel chunks for optimal I/O and CPU throughput
  const CONCURRENCY = 8;
  for (let i = 0; i < sortedElements.length; i += CONCURRENCY) {
    const chunk = sortedElements.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map(async (elem, chunkIdx) => {
        const index = i + chunkIdx + 1;
        const objPath = path.join(inputObjDir, `${elem}.obj`);
        const glbPath = path.join(outputGlbDir, `${elem}.glb`);

        // If GLB already exists and is non-empty, skip
        if (fs.existsSync(glbPath) && fs.statSync(glbPath).size > 0) {
          glbSkipped++;
          return;
        }

        if (!fs.existsSync(objPath)) {
          glbFailed++;
          failedDetails.push({
            elementId: elem,
            inputPath: objPath,
            outputPath: glbPath,
            error: 'Input OBJ file does not exist',
          });
          return;
        }

        try {
          // Convert using binary glb mode without coordinate transformation
          const glbBuffer = await obj2gltf(objPath, { binary: true });
          fs.writeFileSync(glbPath, glbBuffer);
          glbCreated++;
        } catch (err: unknown) {
          glbFailed++;
          const errMsg = err instanceof Error ? err.message : String(err);
          failedDetails.push({
            elementId: elem,
            inputPath: objPath,
            outputPath: glbPath,
            error: errMsg,
          });
        }
      })
    );

    // Progress report every 200 items or at completion
    const currentProgress = Math.min(i + CONCURRENCY, total);
    if (currentProgress % 200 === 0 || currentProgress === total) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((currentProgress / total) * 100).toFixed(1);
      console.log(
        `[PROGRESS] ${currentProgress.toString().padStart(4)}/${total} (${pct}%) | Created: ${glbCreated} | Skipped: ${glbSkipped} | Failed: ${glbFailed} | Elapsed: ${elapsedSec}s`
      );
    }
  }

  // 4. Post-Conversion Disk & File Inspection
  let totalDiskSizeBytes = 0;
  let largestGlb = { filename: '', sizeBytes: 0 };

  for (const elem of sortedElements) {
    const glbPath = path.join(outputGlbDir, `${elem}.glb`);
    if (fs.existsSync(glbPath)) {
      const size = fs.statSync(glbPath).size;
      totalDiskSizeBytes += size;
      if (size > largestGlb.sizeBytes) {
        largestGlb = { filename: `${elem}.glb`, sizeBytes: size };
      }
    }
  }

  const stats: ConversionStats = {
    timestamp: new Date().toISOString(),
    sourceVersion: '4.0',
    totalReferenced: registryData.assets.length,
    totalUnique: sortedElements.length,
    objFound: objFoundCount,
    objMissing: objMissingCount,
    glbCreated,
    glbSkipped,
    glbFailed,
    failedDetails,
    totalDiskSizeBytes,
    largestGlb,
  };

  // Write machine-readable report
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`\n[+] Machine-readable conversion report saved to:\n    ${reportPath}\n`);

  console.log('----------------------------------------------------------------');
  console.log('                POST-CONVERSION SUMMARY                         ');
  console.log('----------------------------------------------------------------');
  console.log(`Total Unique Elements Target : ${stats.totalUnique}`);
  console.log(`OBJ Files Found              : ${stats.objFound}`);
  console.log(`GLBs Created                 : ${stats.glbCreated}`);
  console.log(`GLBs Skipped (Already existed): ${stats.glbSkipped}`);
  console.log(`GLBs Failed                  : ${stats.glbFailed}`);
  console.log(`Total Generated GLBs on Disk : ${sortedElements.filter(e => fs.existsSync(path.join(outputGlbDir, `${e}.glb`))).length}`);
  console.log(`Total GLB Disk Size          : ${(totalDiskSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Largest GLB File             : ${largestGlb.filename} (${(largestGlb.sizeBytes / 1024).toFixed(1)} KB)`);
  console.log('================================================================\n');

  return stats;
}

// Direct execution
if (process.argv[1]?.endsWith('convert-bp3d-to-glb.ts') || process.argv[1]?.endsWith('convert-bp3d-to-glb.js')) {
  convertBulkBP3D().catch((err) => {
    console.error('Fatal conversion error:', err);
    process.exit(1);
  });
}
