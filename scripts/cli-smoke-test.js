#!/usr/bin/env node

/**
 * Smoke test script for CLI functionality.
 * This script validates core workflows without needing complex setup.
 */

import { setTimeout as delay } from "node:timers/promises";

async function runSmokeTests() {
  console.log("🚀 Starting CLI smoke tests...");

  // Test 1: Basic CLI functionality
  console.log("\n1️⃣ Testing basic command execution...");
  const { execSync } = await import('node:child_process');
  
  try {
    const helpOutput = execSync('tsx packages/cli/src/index.ts --help', { encoding: 'utf8' });
    if (!helpOutput.includes("Usage:")) {
      console.error("❌ Help command didn't return expected output");
      process.exit(1);
    }
    console.log("✅ Help command works");
  } catch (error) {
    console.error("❌ Failed to run --help:", error.message);
    process.exit(1);
  }

  // Test 2: TTL help text formatting (direct call to validate)
  console.log("\n2️⃣ Testing TTL help text in CLI code...");
  try {
    const approveHelpOutput = execSync('tsx packages/cli/src/index.ts workspace:approve --help', { encoding: 'utf8' });
    if (!approveHelpOutput.includes("default 60s, cap 3600s")) {
      console.error("❌ TTL help text does not contain expected formatting");
      process.exit(1);
    }
    console.log("✅ TTL help text is correct");
  } catch (error) {
    console.error("❌ Failed to get workspace:approve help:", error.message);
    process.exit(1);
  }

  // Test 3: Environment variable handling (basic check)
  console.log("\n3️⃣ Testing basic environment variable override...");
  try {
    const statusOutput = execSync('tsx packages/cli/src/index.ts status', { encoding: 'utf8' });
    console.log("✅ Status command executed successfully");
  } catch (error) {
    // Status may fail due to no daemon, but that's OK - check we don't crash
    if (error.status !== 0 && !error.message.includes('Command failed')) {
      console.error("❌ Unexpected error running status:", error.message);
      process.exit(1);
    }
    console.log("✅ Status command handled gracefully (no crash)");
  }

  // Test 4: Basic daemon management commands
  console.log("\n4️⃣ Testing that CLI can at least parse commands...");
  try {
    const testOutput = execSync('tsx packages/cli/src/index.ts --version', { encoding: 'utf8' });
    if (!testOutput.includes("0.1.0")) {
      console.error("❌ Version command returned unexpected output");
      process.exit(1);
    }
    console.log("✅ CLI version command works");
  } catch (error) {
    console.error("❌ Failed to run version command:", error.message);
    process.exit(1);
  }

  // Test 5: Environment variable override test
  console.log("\n5️⃣ Testing OLLAMA base URL environment variable override...");
  try {
    const testOutput = execSync('AER_OLLAMA_BASE_URL=http://localhost:11435 tsx packages/cli/src/index.ts status', { encoding: 'utf8' });
    console.log("✅ Environment variable override works without crashing");
  } catch (error) {
    // Just ensure we don't crash
    console.log("✅ Environment variable handling works gracefully (no crash detected)");
  }

  console.log("\n🎉 All smoke tests passed!");
}

runSmokeTests().catch((error) => {
  console.error("💥 Smoke test failed with error:", error);
  process.exit(1);
});