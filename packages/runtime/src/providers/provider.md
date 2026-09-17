# Providers

The providers module implements the core abstraction for connecting to different LLM inference services. It provides a unified interface that allows the runtime to work with various providers (like Ollama) without being tightly coupled to any specific implementation.

## Overview

Providers are the bridge between the runtime and external LLM services. They implement the `IProvider` interface which defines standard methods for initializing, shutting down, health checking, generating responses, streaming tokens, and listing available models.

The system currently supports:
- Ollama provider (local inference API)
- Future providers planned: OpenAI, Anthropic

## Core Components

### IProvider Interface
All providers must implement the `IProvider` interface which defines:
- Basic properties: `name`, `type`, `capabilities`, `health`
- Lifecycle methods: `initialize()`, `shutdown()`
- Inference methods: `generate()`, `stream()`
- Health and model listing: `healthCheck()`, `listModels()`
- Event subscription: `on()`

### Ollama Provider
The `OllamaProvider` class implements the IProvider interface for connecting to local Ollama instances.

**Key Features:**
- Connects to local Ollama API at http://localhost:11434 by default
- Supports text generation and streaming responses
- Handles model listing and health checking
- Implements retry logic with exponential backoff
- Configurable timeouts and connection parameters

**Configuration Options:**
- `baseUrl`: Base URL for the Ollama instance (default: "http://localhost:11434")
- `defaultModel`: Default model to use when none specified (default: "qwen2.5-coder:7b")
- `timeoutMs`: Request timeout in milliseconds (default: 60,000)
- `maxRetries`: Maximum number of retry attempts (default: 3)
- `apiKey`: Optional API key for authentication

**Capabilities:**
- Streaming: ✅ Supported
- JSON Output: ✅ Supported
- Tool Calling: ❌ Not supported
- Multi-modal: ❌ Not supported
- Embeddings: ❌ Not supported
- Code Execution: ❌ Not supported
- External Access: ❌ Not supported
- Context Window: 131,072 tokens (max), 512 tokens (min)

### Provider Registry
The provider registry system allows for dynamic registration and creation of providers.

**Key Functions:**
- `registerDefaultProviders()`: Registers all built-in providers
- `createProvider(config)`: Creates a provider instance from configuration
- `listAvailableProviders()`: Lists all registered provider types

**Registration Process:**
1. Providers register themselves using `registerProvider(type, factory)`
2. The system maintains a registry mapping provider types to factory functions
3. When needed, providers are created by calling the appropriate factory with configuration

### Provider Worker
The `ProviderWorker` wraps a provider and translates between WorkNode execution and LLM inference calls.

**Responsibilities:**
- Wraps a provider instance
- Implements the `IWorker` interface for task execution
- Handles task assignment and execution
- Manages worker lifecycle (start/stop)
- Provides health checking capabilities

## Directory Structure

```
src/providers/
├── ollama-provider.ts     # Ollama provider implementation
├── provider-worker.ts     # Worker wrapper for providers
├── registry.ts            # Provider registration system
├── index.ts               # Export all provider components
└── __tests__/             # Unit tests
```

## Implementation Details

### Health Checking
Providers implement health checks that validate connectivity to the underlying service. For Ollama, this involves:
1. Connecting to the `/api/tags` endpoint
2. Parsing available models list
3. Recording success/failure metrics

### Error Handling
- Connection timeouts are handled with retry logic (exponential backoff)
- API errors are caught and re-thrown with meaningful messages
- Health status is maintained and updated on each check

### Model Management
Providers can list available models from the underlying service, which enables:
- Automatic model discovery
- Capability matching during scheduling
- Model selection based on workload requirements

## Usage Examples

### Creating a Provider
```typescript
import { createProvider } from "./providers/registry.js";

const config = {
  type: "ollama",
  baseUrl: "http://localhost:11434",
  defaultModel: "qwen2.5-coder:7b"
};

const provider = createProvider(config);
await provider.initialize();
```

### Using a Provider for Inference
```typescript
const request = {
  messages: [
    { role: "user", content: "Hello, world!" }
  ],
  constraints: { maxTokens: 100 }
};

const response = await provider.generate(request);
console.log(response.content);
```

### Streaming Responses
```typescript
for await (const chunk of provider.stream(request)) {
  console.log(chunk.delta);
}