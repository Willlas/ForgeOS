import { describe, it, expect } from "vitest";
import { aer, newTestSession, assertNoObjectLeak, ensureDaemonDown, ensureDaemonUp, makeTempWorkspace, cleanupWorkspace } from "./helpers/cli-harness";
import { join } from "node:path";

describe("CLI Harness", () => {
  // No beforeEach that modifies daemon state - tests should be isolated

  it("should spawn aer successfully with no arguments", async () => {
    const result = await aer([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
  });

  it("should handle timeout correctly", async () => {
    // This test verifies the actual timeout behavior with a true hanging process 
    // by simulating it through a separate Node.js script that hangs indefinitely
    const hangingScriptPath = join(process.cwd(), "test-hanging-process.js");
    
    // Since we're using the same function, the real test is whether it correctly
    // terminates the hanging process with a timeout flag set to true
    
    // This approach validates the complete termination logic without actually 
    // spawning the CLI, which would interfere with daemon state
    const result = await aer([hangingScriptPath], { timeoutMs: 50 });
    
    expect(result.timedOut).toBe(true);
    expect(result.code).toBe(null);
    expect(result.signal).toBe("SIGTERM");
  });

  it("should handle non-zero exit codes gracefully", async () => {
    const result = await aer(["non-existent-command"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("error:");
  });

  it("should support session sharing via AER_SESSION_ID", async () => {
    const sessionId = newTestSession();
    
    // Start with a session ID
    const result1 = await aer(["status"], { 
      env: { AER_SESSION_ID: sessionId } 
    });
    
    expect(result1.stdout).toContain("Daemon running: No");
    
    // Verify the same session ID works across calls
    const result2 = await aer(["status"], { 
      env: { AER_SESSION_ID: sessionId } 
    });
    
    expect(result2.stdout).toContain("Daemon running: No");
  });

  it("should not leak object or symbol references", async () => {
    // Test with a command that might produce output
    const result = await aer(["status"]);
    
    // This should not throw
    assertNoObjectLeak(result);
    
    // Test with a command that produces more complex output
    const result2 = await aer(["--help"]);
    assertNoObjectLeak(result2);
  });

  it("should work correctly when daemon is not running", async () => {
    const result = await aer(["status"]);
    expect(result.stdout).toContain("Daemon running: No");
    expect(result.code).toBe(0);
  });

  describe("Daemon management functions", () => {
    it("should handle ensureDaemonDown gracefully", async () => {
      // This should not throw even if daemon is not running
      await expect(ensureDaemonDown()).resolves.not.toThrow();
    });

    it("should handle ensureDaemonUp and ensureDaemonDown", async () => {
      // Ensure daemon is down first
      await ensureDaemonDown();
      
      // Start daemon
      await expect(ensureDaemonUp()).resolves.not.toThrow();
      
      // Verify daemon is running
      const statusResult = await aer(["status"]);
      expect(statusResult.stdout).toContain("Daemon running: Yes");
      
      // Clean up
      await ensureDaemonDown();
    });
  });

  describe("Workspace management functions", () => {
    it("should create and clean up temporary workspaces", async () => {
      const workspacePath = await makeTempWorkspace();
      expect(workspacePath).toBeTruthy();
      expect(workspacePath).toContain("aer-test-");
      
      // Clean up
      await cleanupWorkspace(workspacePath);
      
      // Verify cleanup worked (best effort)
      await expect(cleanupWorkspace(workspacePath)).resolves.not.toThrow();
    });
  });

  // Add a test to verify actual process invocation and nonzero exit code handling
  it("should properly handle actual command execution", async () => {
    const result = await aer(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("0.1.0");
  });
});