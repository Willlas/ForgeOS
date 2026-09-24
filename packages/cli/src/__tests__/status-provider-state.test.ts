import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OLLAMA_BASE_URL,
  formatProviderStatus,
  probeOllamaReachability,
} from "../index";

// Sprint 13 Epic 2 (US-03 / US-04): `aer status` reports the Ollama
// provider state. The reachability probe is mocked (no live Ollama, no
// running daemon) so the suite is green on CI and on machines without
// Ollama; the assertions pin the exact operator-facing line.
describe("aer status — Ollama provider line", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prints the reachable line with the default base URL", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const reachable = await probeOllamaReachability();

    expect(reachable).toBe(true);
    // Probe targets the provider's /api/tags endpoint with a bounded
    // timeout (AbortSignal), mirroring OllamaProvider.healthCheck.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/tags");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const line = formatProviderStatus(reachable);
    expect(line).toBe("Ollama provider: reachable (http://localhost:11434)");
    expect(line).toContain("localhost:11434");
  });

  it("prints the unreachable line when the probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );

    const reachable = await probeOllamaReachability();

    expect(reachable).toBe(false);
    const line = formatProviderStatus(reachable);
    expect(line).toBe("Ollama provider: unreachable (http://localhost:11434)");
    expect(line).toContain("localhost:11434");
  });

  it("never rejects and resolves within the bound for a down target", async () => {
    // Loopback port 1 refuses instantly; no live Ollama is involved.
    const started = Date.now();
    const reachable = await probeOllamaReachability("http://127.0.0.1:1", 1_000);
    expect(reachable).toBe(false);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("pins the default base URL used by `aer status`", () => {
    expect(OLLAMA_BASE_URL).toBe("http://localhost:11434");
  });
});
