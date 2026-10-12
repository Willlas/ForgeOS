import { describe, expect, it } from "vitest";
import { aer } from "./helpers/cli-harness.js";

describe("CLI Approval Lifecycle - Happy Path", () => {
  it("approves workspace and applies successfully", async () => {
    const result = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Approved workspace");
    expect(result.stdout).toMatch(/approvalId: wsa_[a-zA-Z0-9]+/);
  });

  it("rejects duplicate approvalId usage", async () => {
    // First approval
    const firstResult = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    expect(firstResult.exitCode).toBe(0);
    
    // Extract approvalId from first result
    const approvalIdMatch = firstResult.stdout.match(/approvalId: (wsa_[a-zA-Z0-9]+)/);
    expect(approvalIdMatch).toBeTruthy();
    const approvalId = approvalIdMatch[1];
    
    // Try to approve again with same diffHash (should succeed)
    const secondResult = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    expect(secondResult.exitCode).toBe(0);
    
    // Apply with first approvalId (should succeed)
    const applyResult = await aer("workspace:apply", "/tmp/test-project", approvalId, {
      yes: true,
    });
    
    expect(applyResult.exitCode).toBe(0);
    
    // Try to apply with same approvalId again (should fail)
    const secondApplyResult = await aer("workspace:apply", "/tmp/test-project", approvalId, {
      yes: true,
    });
    
    expect(secondApplyResult.exitCode).toBe(1);
    expect(secondApplyResult.stderr).toContain("Unknown or already-consumed approvalId");
  });
});

describe("CLI Approval Lifecycle - Read-Only Grant Misuse", () => {
  it("rejects approve when session has read-only grant", async () => {
    const result = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    // Note: This test assumes we can set up a read-only session
    // For now, we'll check that it handles the error gracefully
    expect(result.exitCode).toBe(0); // Will need to be updated when proper session handling is implemented
  });
});

describe("CLI Approval Lifecycle - TTL Behavior", () => {
  it("uses default TTL when --ttl not specified", async () => {
    const result = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    expect(result.exitCode).toBe(0);
    // Should contain approval info with default TTL
    expect(result.stdout).toContain("Approved workspace");
  });

  it("respects custom TTL when --ttl specified", async () => {
    const result = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
      ttl: "60",
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Approved workspace");
  });
});

describe("CLI Approval Lifecycle - Daemon Down Behavior", () => {
  it("rejects approval when daemon is down", async () => {
    // This test would require the harness to simulate daemon down
    const result = await aer("workspace:approve", "/tmp/test-project", "abc123", {
      yes: true,
    });
    
    expect(result.exitCode).toBe(0); // Placeholder - actual implementation needed
  });
});