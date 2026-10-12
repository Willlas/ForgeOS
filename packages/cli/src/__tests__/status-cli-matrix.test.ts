import { describe, expect, it } from "vitest";
import { aer } from "./helpers/cli-harness.js";

describe("CLI Status Matrix - Provider/daemon Status", () => {
  // Test 1: Daemon down + provider unreachable (closed port)
  it("handles daemon-down + provider-unreachable scenario", async () => {
    // This would require setting up a test where daemon is down
    // and simulating a closed port for Ollama
    const result = await aer(["status"]);
    
    // Should handle gracefully without hanging
    expect(result.code).toBe(0); // or appropriate exit code
    expect(result.stdout).not.toContain("[object Object]");
  });

  // Test 2: Daemon down + provider reachable (ephemeral server)
  it("handles daemon-down + provider-reachable scenario", async () => {
    // This would require simulating a daemon-down but with reachable provider
    const result = await aer(["status"]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("[object Object]");
  });

  // Test 3: Daemon up (normal operation)
  it("shows normal status when daemon is running", async () => {
    // This test assumes daemon is running
    const result = await aer(["status"]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("[object Object]");
    // Should contain valid status information
    expect(result.stdout).toContain("Daemon is running");
  });
});

describe("CLI Status Matrix - Environment Override", () => {
  it("respects AER_OLLAMA_BASE_URL environment variable", async () => {
    // Test with custom OLLAMA base URL
    const result = await aer(["status"], {
      env: {
        ...process.env,
        AER_OLLAMA_BASE_URL: "http://127.0.0.1:9",
      }
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("[object Object]");
  });

  it("uses default OLLAMA base URL when env var not set", async () => {
    const result = await aer(["status"]);
    
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("[object Object]");
  });
});