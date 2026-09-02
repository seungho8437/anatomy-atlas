/**
 * Smoke Test - Basic Project Verification
 * 
 * Verifies that the Anatomy Atlas project is properly initialized:
 * - Required directories exist
 * - Domain types are valid
 * - Registry can be loaded
 * - No critical runtime errors
 * 
 * Run: npm run test:smoke
 */

import * as fs from "fs/promises";
import * as path from "path";
import type {
  AnatomyStructure,
  Asset,
  RegistryEntry,
} from "../../lib/anatomy/types";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify directory structure
 */
async function testDirectoryStructure() {
  const requiredDirs = [
    "data/raw/bodyparts3d",
    "data/processed/glb",
    "data/processed/metadata",
    "data/registry",
    "scripts/anatomy",
    "lib/anatomy",
    "components/anatomy/viewer",
    "docs/anatomy",
    "licensing",
    "tests/anatomy",
  ];

  for (const dir of requiredDirs) {
    try {
      await fs.access(path.join(process.cwd(), dir));
      results.push({
        name: `Directory exists: ${dir}`,
        passed: true,
        message: "✓",
      });
    } catch {
      results.push({
        name: `Directory exists: ${dir}`,
        passed: false,
        message: `✗ Directory not found`,
      });
    }
  }
}

/**
 * Test 2: Verify required files exist
 */
async function testRequiredFiles() {
  const requiredFiles = [
    "lib/anatomy/types.ts",
    "data/registry/structures.json",
    "licensing/PROVENANCE.md",
    "licensing/SOURCES.md",
    "licensing/ATTRIBUTION.md",
    "scripts/anatomy/process-asset.ts",
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(process.cwd(), file));
      results.push({
        name: `File exists: ${file}`,
        passed: true,
        message: "✓",
      });
    } catch {
      results.push({
        name: `File exists: ${file}`,
        passed: false,
        message: `✗ File not found`,
      });
    }
  }
}

/**
 * Test 3: Load and validate registry structure
 */
async function testRegistryStructure() {
  try {
    const registryPath = path.join(process.cwd(), "data/registry/structures.json");
    const data = await fs.readFile(registryPath, "utf-8");
    const registry: RegistryEntry = JSON.parse(data);

    const isValid =
      registry.structures &&
      Array.isArray(registry.structures) &&
      registry.metadata &&
      typeof registry.metadata === "object";

    if (isValid) {
      results.push({
        name: "Registry structure is valid",
        passed: true,
        message: `✓ Loaded ${registry.structures.length} structures`,
      });
    } else {
      throw new Error("Invalid registry structure");
    }
  } catch (error) {
    results.push({
      name: "Registry structure is valid",
      passed: false,
      message: `✗ ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Test 4: Verify anatomy structures have required fields
 */
async function testAnatomyStructures() {
  try {
    const registryPath = path.join(process.cwd(), "data/registry/structures.json");
    const data = await fs.readFile(registryPath, "utf-8");
    const registry: RegistryEntry = JSON.parse(data);

    let allValid = true;
    for (const structure of registry.structures) {
      const hasRequiredFields = structure.id && structure.names;
      if (!hasRequiredFields) {
        allValid = false;
        break;
      }
    }

    if (allValid && registry.structures.length > 0) {
      results.push({
        name: "Anatomy structures have required fields",
        passed: true,
        message: `✓ All ${registry.structures.length} structures valid`,
      });
    } else {
      throw new Error("Some structures missing required fields");
    }
  } catch (error) {
    results.push({
      name: "Anatomy structures have required fields",
      passed: false,
      message: `✗ ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Test 5: Verify domain types are exported correctly
 */
async function testDomainTypes() {
  try {
    // In a real test, we would import and verify types
    // For now, verify the file exists and is readable
    const typesPath = path.join(process.cwd(), "lib/anatomy/types.ts");
    const content = await fs.readFile(typesPath, "utf-8");

    const hasRequiredInterfaces =
      content.includes("export interface AnatomyStructure") &&
      content.includes("export interface Asset") &&
      content.includes("export interface Provenance");

    if (hasRequiredInterfaces) {
      results.push({
        name: "Domain types are properly exported",
        passed: true,
        message: "✓ All required interfaces present",
      });
    } else {
      throw new Error("Missing required interfaces");
    }
  } catch (error) {
    results.push({
      name: "Domain types are properly exported",
      passed: false,
      message: `✗ ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Test 6: Verify .gitignore is properly configured
 */
async function testGitignore() {
  try {
    const gitignorePath = path.join(process.cwd(), ".gitignore");
    const content = await fs.readFile(gitignorePath, "utf-8");

    const hasAssetRules =
      content.includes("*.glb") &&
      content.includes("data/raw") &&
      content.includes("data/processed/glb");

    if (hasAssetRules) {
      results.push({
        name: ".gitignore excludes large assets",
        passed: true,
        message: "✓ Asset exclusion rules configured",
      });
    } else {
      throw new Error("Missing asset exclusion rules");
    }
  } catch (error) {
    results.push({
      name: ".gitignore excludes large assets",
      passed: false,
      message: `✗ ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n🧪 Anatomy Atlas Smoke Tests\n");
  console.log("Running validation checks...\n");

  await testDirectoryStructure();
  await testRequiredFiles();
  await testRegistryStructure();
  await testAnatomyStructures();
  await testDomainTypes();
  await testGitignore();

  // Print results
  console.log("Test Results:");
  console.log("─".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    console.log(`${icon} ${result.name}`);
    if (!result.passed || result.message !== "✓") {
      console.log(`  ${result.message}`);
    }
    if (result.passed) passed++;
    else failed++;
  }

  console.log("─".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
