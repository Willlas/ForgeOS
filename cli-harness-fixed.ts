import { spawn } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";

/** 
 * Spawn aer CLI with given arguments and timeout handling.
 * Uses stdio: ["pipe", "pipe", "pipe"] for reliable interactive prompt behavior.
 * Process tree is killed on timeout (not just the main process).
 * Never throws on non-zero exit codes - exit codes are data.
 */
export async function aer(
  args: string[],
  { timeoutMs = 20_000, env = {} }: { timeoutMs?: number; env?: Record<string, string> } = {}
): Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}> {
  // Use a clean direct node approach without external tool dependencies
  const cliPath = join(process.cwd(), "packages", "cli", "src", "index.ts");
  
  // For test environments, directly spawn node with the TypeScript file
  // This avoids needing additional installation of tsx or other tools in testing context
  const child = spawn("node", [cliPath, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
    detached: true, // Important for process tree killing
  });

  let stdout = "";
  let stderr = "";
  
  child.stdout?.on("data", (data) => {
    stdout += data.toString();
  });
  
  child.stderr?.on("data", (data) => {
    stderr += data.toString();
  });

  // Create a promise that will resolve with the result when either:
  // 1. The command completes normally
  // 2. The timeout occurs (in which case we return timedOut: true)
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    // Handle normal completion
    child.on("close", (code, signal) => {
      if (!resolved) {
        resolved = true;
        resolve({
          stdout,
          stderr,
          code,
          signal,
          timedOut: false
        });
      }
    });
    
    // Handle spawn errors
    child.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });
    
    // Set up timeout handling
    const timeoutId = setTimeout(() => {
      // Kill entire process tree (including child and all descendants)
      try {
        if (child.pid) {
          // On Windows, we need to use a different approach for proper process termination
          if (process.platform === "win32") {
            // For Windows, we use taskkill to terminate the process tree
            const childProcess = require('child_process');
            childProcess.exec(`taskkill /F /T /PID ${child.pid}`, () => {
              // We don't wait for this - it's best effort
            });
          } else {
            // For Unix-like systems, we can use -pid to kill process group
            process.kill(-child.pid, "SIGTERM");
          }
        }
      } catch (e) {
        // Ignore errors from kill
      }
      
      // Resolve with timeout information rather than reject
      if (!resolved) {
        resolved = true;
        resolve({
          stdout,
          stderr,
          code: null,
          signal: "SIGTERM",
          timedOut: true
        });
      }
    }, timeoutMs);
    
    // Clear the timeout if the process finishes normally (in case of race conditions)
    child.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

/** 
 * Generate a unique session ID for test isolation.
 */
export function newTestSession(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** 
 * Assert that the result does not contain object leaks (e.g., [object Object] or [Symbol(...)])
 */
export function assertNoObjectLeak(result: { stdout: string; stderr: string }): void {
  const combined = `${result.stdout}${result.stderr}`;
  
  if (combined.includes("[object Object]")) {
    throw new Error(`Object leak detected in output: ${combined}`);
  }
  
  if (combined.includes("[Symbol(")) {
    throw new Error(`Symbol leak detected in output: ${combined}`);
  }
}

/** 
 * Ensure daemon is down by running aer stop (tolerating "not running")
 */
export async function ensureDaemonDown(): Promise<void> {
  try {
    const result = await aer(["stop"]);
    // Only consider it an error if there was a non-zero exit code and it's not about daemon not running
    if (result.code !== 0) {
      // Check if the error is about daemon not being running
      const isNotRunningError = result.stderr.toLowerCase().includes("not running") || 
                              result.stderr.toLowerCase().includes("daemon not found") ||
                              result.stdout.toLowerCase().includes("not running");
      
      if (!isNotRunningError) {
        throw new Error(`Failed to stop daemon: ${result.stderr || result.stdout}`);
      }
    }
  } catch (error) {
    // Only re-throw if it's a timeout or unexpected error, not just "daemon not running"
    const errorMessage = (error as Error).message?.toLowerCase() || '';
    if (!errorMessage.includes("not running") && !errorMessage.includes("daemon not found")) {
      throw error;
    }
    // Otherwise, it's expected that daemon might not be running
  }
}

/** 
 * Ensure daemon is up by running aer start and polling status until it's running
 */
export async function ensureDaemonUp(): Promise<void> {
  // Start the daemon
  const startResult = await aer(["start"]);
  
  if (startResult.code !== 0) {
    throw new Error(`Failed to start daemon: ${startResult.stderr || startResult.stdout}`);
  }
  
  // Poll status until daemon is running
  const maxWaitTime = 10_000;
  const startTime = Date.now();
  
  let statusResult;
  
  while (Date.now() - startTime < maxWaitTime) {
    statusResult = await aer(["status"]);
    
    if (statusResult.code === 0 && statusResult.stdout.includes("Daemon running: Yes")) {
      return;
    }
    
    // Wait a bit before polling again
    await delay(500);
  }
  
  throw new Error(`Daemon did not start within ${maxWaitTime}ms. Output: ${JSON.stringify({ stdout: statusResult!.stdout, stderr: statusResult!.stderr })}`);
}

/** 
 * Create a temporary workspace directory
 */
export async function makeTempWorkspace(): Promise<string> {
  const tempDir = tmpdir();
  const workspaceDir = await mkdtemp(`${tempDir}${__filename.includes('\\') ? '\\' : '/'}aer-test-`);
  return workspaceDir;
}

/** 
 * Clean up a temporary workspace directory
 */
export async function cleanupWorkspace(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch (error) {
    // Best effort cleanup - don't throw if it fails
    console.warn(`Failed to clean up workspace ${path}:`, error);
  }
}