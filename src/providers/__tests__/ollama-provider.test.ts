/**
 * Unit tests for the Ollama provider.
 * Tests construction, lifecycle (initialize/shutdown), configuration
 * passthrough and healthCheck behaviour without requiring a live
 * Ollama endpoint by mocking fetch.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ProviderConfig } from "../../core/types/provider.js";
import { OllamaProvider } from "../ollama-provider.js";

/** Create a mock fetch that always reports healthy with an empty model list. */
function healthyFetch(_url: string, _init?: RequestInit): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ models: [] }),
    text: () => Promise.resolve('{"ok":true}'),
    body: null,
  } as unknown as Response);
}

/** Create a mock fetch that always reports unhealthy. */
function unhealthyFetch(_url: string, _init?: RequestInit): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("unhealthy"),
    body: null,
  } as unknown as Response);
}

function baseConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    name: "test-ollama",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    ...overrides,
  };
}

describe("OllamaProvider", () => {
  let provider: OllamaProvider;
  let originalFetch: typeof fetch;
  let mockHealthyFetch: ReturnType<typeof vi.fn>;
  let mockUnhealthyFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockHealthyFetch = vi.fn(healthyFetch);
    mockUnhealthyFetch = vi.fn(unhealthyFetch);
    (global as Record<string, unknown>).fetch = mockHealthyFetch;
  });

  afterEach(() => {
    (global as Record<string, unknown>).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("construction", () => {
    it("creates a provider with default config values", () => {
      provider = new OllamaProvider(baseConfig());
      expect(provider.name).toBe("ollama");
      expect(provider.type).toBe("ollama");
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.toolCalling).toBe(false);
      expect(provider.health.status).toBe("unhealthy");
    });

    it("respects custom baseUrl", () => {
      provider = new OllamaProvider(baseConfig({ baseUrl: "http://custom:8080" }));
      expect((provider as any).baseUrl).toBe("http://custom:8080");
    });

    it("respects custom defaultModel", () => {
      provider = new OllamaProvider(baseConfig({ defaultModel: "llama3.2:1b" }));
      expect((provider as any).defaultModel).toBe("llama3.2:1b");
    });

    it("uses sensible defaults when no config overrides", () => {
      provider = new OllamaProvider(baseConfig());
      expect((provider as any).baseUrl).toBe("http://localhost:11434");
    });

    it("exposes the config getter", () => {
      provider = new OllamaProvider(baseConfig());
      expect(provider.config).toBeDefined();
      expect(provider.config.type).toBe("ollama");
    });
  });

  describe("lifecycle", () => {
    it("initializes successfully when health check passes", async () => {
      provider = new OllamaProvider(baseConfig());
      await expect(provider.initialize()).resolves.toBeUndefined();
      expect(provider.health.status).toBe("healthy");
      expect(mockHealthyFetch).toHaveBeenCalled();
    });

    it("throws on initialization when health check fails", async () => {
      (global as Record<string, unknown>).fetch = function (_url: string, _init?: RequestInit): Promise<Response> {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("unhealthy"),
          body: null,
        } as unknown as Response);
      };
      provider = new OllamaProvider(baseConfig());
      await expect(provider.initialize()).rejects.toThrow("Ollama provider initialization failed");
      expect(provider.health.status).toBe("unhealthy");
    });

    it("shuts down the provider gracefully", async () => {
      provider = new OllamaProvider(baseConfig());
      await provider.initialize();
      await provider.shutdown();
      expect(provider.health.status).toBe("unhealthy");
    });
  });

  describe("healthCheck", () => {
    beforeEach(() => {
      provider = new OllamaProvider(baseConfig());
    });

    it("returns healthy status when fetch succeeds", async () => {
      const status = await provider.healthCheck();
      expect(status.status).toBe("healthy");
    });

    it("returns unhealthy status when fetch fails", async () => {
      (global as Record<string, unknown>).fetch = mockUnhealthyFetch;
      const status = await provider.healthCheck();
      expect(status.status).toBe("unhealthy");
      expect(status.error).toBeDefined();
    });
  });

  describe("listModels", () => {
    it("returns empty array before initialization", async () => {
      provider = new OllamaProvider(baseConfig());
      const models = await provider.listModels();
      expect(models).toEqual([]);
    });

    it("performs a health check internally if not initialized", async () => {
      provider = new OllamaProvider(baseConfig());
      await provider.listModels();
      expect(mockHealthyFetch).toHaveBeenCalled();
    });
  });

  describe("on", () => {
    it("returns an unsubscribe no-op function", () => {
      provider = new OllamaProvider(baseConfig());
      const unsub = provider.on("test", () => {});
      expect(typeof unsub).toBe("function");
      expect(() => unsub()).not.toThrow();
    });
  });
});