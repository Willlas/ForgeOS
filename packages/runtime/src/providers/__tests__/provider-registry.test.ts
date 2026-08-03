/**
 * Provider Registry Unit Tests
 * @module providers/__tests__/provider-registry
 */

import { describe, it, expect } from "vitest";
import { ProviderConfig, createProvider, listAvailableProviders } from "../../core/types/provider.js";
import { OllamaProvider } from "../ollama-provider.js";

// Import registry to ensure ollama is registered
import "../registry.js";

describe("Provider Registry", () => {
  describe("createProvider", () => {
    it("should create an OllamaProvider from config", () => {
      const config: ProviderConfig = {
        name: "local-ollama",
        type: "ollama",
        baseUrl: "http://localhost:11434",
        defaultModel: "llama3",
      };

      const provider = createProvider(config);

      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe("ollama");
      expect(provider.type).toBe("ollama");
    });

    it("should use default baseUrl when not provided", () => {
      const config: ProviderConfig = {
        name: "default-ollama",
        type: "ollama",
        defaultModel: "llama3",
      };

      const provider = createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.config.baseUrl).toBe("http://localhost:11434");
    });

    it("should throw for unknown provider type", () => {
      const config: ProviderConfig = {
        name: "unknown-provider",
        type: "unknown" as any,
        baseUrl: "http://localhost:11434",
        defaultModel: "llama3",
      };

      expect(() => createProvider(config)).toThrow();
    });
  });

  describe("listAvailableProviders", () => {
    it("should have ollama registered by default", () => {
      const providers = listAvailableProviders();
      expect(providers).toContain("ollama");
    });

    it("should return a non-empty array", () => {
      const providers = listAvailableProviders();
      expect(providers.length).toBeGreaterThan(0);
    });

    it("should return an array with unique values", () => {
      const providers = listAvailableProviders();
      const uniqueProviders = [...new Set(providers)];
      expect(providers.length).toBe(uniqueProviders.length);
    });
  });
});

describe("createProvider with various configurations", () => {
  it("should create provider with custom configuration", () => {
    const config: ProviderConfig = {
      name: "custom-ollama",
      type: "ollama",
      baseUrl: "http://custom-host:8080",
      defaultModel: "mistral",
      headers: { Authorization: "Bearer token" },
    };

    const provider = createProvider(config);

    expect(provider.type).toBe("ollama");
    expect(provider.config.baseUrl).toBe("http://custom-host:8080");
    expect(provider.config.defaultModel).toBe("mistral");
  });

  it("should handle embeddings-only configuration", () => {
    const config: ProviderConfig = {
      name: "embed-ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
      defaultModel: "nomic-embed-text",
    };

    const provider = createProvider(config);

    // Ollama provider base capabilities have embeddings=false; models like nomic-embed-text
    // would need a model-specific capability override (not implemented yet)
    expect(provider.capabilities.embeddings).toBe(false);
  });

  it("should handle streaming configuration", () => {
    const config: ProviderConfig = {
      name: "streaming-ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3",
    };

    const provider = createProvider(config);

    expect(provider.capabilities.streaming).toBe(true);
  });

  it("should handle tool calling configuration", () => {
    const config: ProviderConfig = {
      name: "tool-ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3-tool",
    };

    const provider = createProvider(config);

    // Ollama provider base capabilities have toolCalling=false; tool calling support
    // would require model-specific capability overrides (not implemented yet)
    expect(provider.capabilities.toolCalling).toBe(false);
  });

  it("should handle JSON output configuration", () => {
    const config: ProviderConfig = {
      name: "json-ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3-json",
    };

    const provider = createProvider(config);

    expect(provider.capabilities.jsonOutput).toBe(true);
  });
});