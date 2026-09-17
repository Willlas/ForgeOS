/**
 * Provider Registry - Registers all available providers.
 *
 * This module is the single point where new providers are wired in.
 * Importing this file ensures the default provider is available via createProvider().
 *
 * @module providers/registry
 */

import { registerProvider } from "../core/types/provider.js";
import type { ProviderConfig, IProvider } from "../core/types/provider.js";
import { OllamaProvider } from "./ollama-provider.js";

/** Register all built-in providers and return a list of their types. */
export function registerDefaultProviders(): string[] {
  const types: string[] = [];

  // ---- Ollama -----------------------------------------------------------
  types.push("ollama");

  registerProvider("ollama", (config: ProviderConfig): IProvider => {
    return new OllamaProvider(config);
  });

  // Future providers go here:
  // types.push("openai");
  // registerProvider("openai", (config) => new OpenAIProvider(config));

  return types;
}

// Auto-register built-ins when this module is loaded.
registerDefaultProviders();