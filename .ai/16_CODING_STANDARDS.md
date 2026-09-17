# Coding Standards

Version: 1.0

Status: Draft

---

# Purpose

This document defines coding standards, interface contracts, naming conventions, error handling patterns, and code organization rules for all implementation in the Autonomous Engineering Runtime.

Standards reduce cognitive load.
Standards make code predictable.
Standards enable autonomous verification.

These standards apply to ALL source code in the repository.

---

# Philosophy

## Code Is A Contract

Every function, class, and module IS a contract between caller and implementation.

Contracts must be:
- Explicit (types define the boundary)
- Verifiable (pre/post conditions checked)
- Complete (all error cases identified)
- Documented (purpose stated clearly)

Unclear code is not a style issue.
It is a contract violation.

---

## Documentation In Code, Not Outside It

Inline documentation explains WHY.
Interface documentation explains WHAT.

If the WHY matters to future engineers, it belongs in code comments.
If the WHAT matters to consumers, it belongs in interface documentation.

Both are part of the contract. Neither is optional.

---

# Language Standards

## TypeScript Is Required

All source code SHALL be written in TypeScript.

### Type Strictness

```typescript
// ALL files MUST have strict mode enabled
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Type Rules

| Rule | Requirement |
|---|---|
| No `any` type | Use `unknown` when type is truly unknown |
| No implicit any | All parameters must have explicit types |
| Null safety | Strict null checks required |
| Unreachable code | Must be proven unreachable |
| Public interfaces | Must be fully typed |

---

## Naming Conventions

### Files

```typescript
// Module files: kebab-case
task-scheduler.ts
provider-manager.ts
error-recovery.ts

// Type definition files: PascalCase with .d.ts
TaskScheduler.d.ts
ProviderManager.d.ts

// Test files: match source with .test.ts prefix
TaskScheduler.test.ts
ProviderManager.test.ts
```

### Classes and Types

```typescript
// Classes: PascalCase
class TaskScheduler { }
class WorkerPool { }

// Interfaces: PascalCase
interface SchedulerConfig { }
interface WorkerOptions { }

// Types: PascalCase
type TaskId = string;
type ProviderName = string;

// Enums: PascalCase, members PascalCase
enum TaskState {
  Pending,
  Running,
  Completed,
  Failed,
  Cancelled
}
```

### Variables and Functions

```typescript
// Variables: camelCase
const taskId = "abc123";
let taskCount = 0;

// Functions: camelCase (action verb first)
function scheduleTask(config) { }
function resolveWorker(task) { }

// Boolean variables: is/has/can prefix
isEnabled = true;
hasPermission = false;
canExecute = true;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 60_000;
const PROVIDER_CAPABILITIES = ["chat", "embed"];
```

### Private Members

```typescript
class Example {
  // Private: underscore prefix (TypeScript native # also acceptable)
  private cache: Map<string, Result>;
  #internalState: State;

  // Private methods: camelCase
  private computeResult(input): Result { }
  private validateConfig(cfg): boolean { }
}
```

---

# Interface Contracts

## Every Public Interface SHALL Define

### Input Contract

```typescript
/**
 * Schedule a task into the scheduler.
 * 
 * @param config - Task configuration
 * @param config.priority - Priority level (1-10, 10 = highest)
 * @param config.capability - Required capability name
 * @param config.payload - Serializable task payload
 * @param options - Optional configuration
 * @param options.timeoutMs - Maximum execution time in milliseconds
 * @returns Task execution result
 * 
 * @throws {SchedulerFullError} When scheduler queue is at capacity
 * @throws {InvalidConfigError} When config validation fails
 * @throws {ProviderUnavailableError} When no provider with required capability exists
 */
scheduleTask(config: TaskConfig, options?: ScheduleOptions): Promise<Result>;
```

### Output Contract

- Return type (never `any`)
- Result guarantees (what is always true about the return value)
- Side effects (if any)

### Error Contract

- All error types that may be thrown
- Conditions under which each error is thrown
- Error recovery options (if applicable)

### Invariants

What is always true before and after the call:

```typescript
/**
 * @invariant queue.size < MAX_QUEUE_SIZE (before and after call)
 * @invariant all scheduled tasks have unique IDs
 */
```

---

## Interface Documentation Template

```typescript
/**
 * [One-line purpose statement]
 * 
 * [Extended description if purpose not obvious from name]
 * 
 * @param [argName] - [Parameter description]
 * @returns [Return description]
 * @throws {ErrorType} - [When condition]
 * 
 * @example
 * ```typescript
 * const result = await functionName(arg);
 * ```
 */
```

---

# Code Organization

## Module Structure

Each module SHALL have:

- Single responsibility (one clear purpose)
- Maximum 300 lines of source code (excluding tests)
- Clear public interface (exported symbols)
- Inline documentation for all public symbols

### Directory Layout

```
src/
├── index.ts              // Public API entry point
├── agents/               // Agent implementations
│   ├── dispatcher/
│   │   ├── dispatcher.ts
│   │   ├── dispatcher-config.ts
│   │   └── dispatcher.test.ts
│   └── scheduler/
│       ├── scheduler.ts
│       ├── scheduler-config.ts
│       └── scheduler.test.ts
├── runtime/              // Runtime core
│   ├── engine.ts
│   ├── provider.ts
│   └── event-bus.ts
├── workflows/            // Workflow definitions
│   └── ...
└── shared/               // Shared utilities
    └── ...
```

---

## Import Organization

```typescript
// 1. Node.js built-ins
import { readdir } from "fs";

// 2. External dependencies
import { z } from "zod";

// 3. Internal modules (grouped by module)
import { TaskScheduler } from "../runtime/scheduler";
import { WorkerPool } from "../runtime/worker-pool";

// 4. Relative imports (current module)
import { TaskConfig } from "./task-config";
import { validateTask } from "./validation";
```

---

# Error Handling

## Error Classes

Every module SHALL define explicit error classes:

```typescript
class SchedulerError extends Error {
  readonly name = "SchedulerError";
  constructor(message: string) {
    super(message);
  }
}

class SchedulerFullError extends SchedulerError {
  readonly name = "SchedulerFullError";
  readonly queueSize: number;
  constructor(queueSize: number) {
    super(`Queue full: ${queueSize} tasks`);
    this.queueSize = queueSize;
  }
}

class ProviderError extends Error {
  readonly name = "ProviderError";
  readonly providerName: string;
  readonly errorCode?: string;
  constructor(providerName: string, message: string, errorCode?: string) {
    super(`Provider ${providerName}: ${message}`);
    this.providerName = providerName;
    this.errorCode = errorCode;
  }
}
```

---

## Error Handling Rules

### Rule 1: Never Silently Swallow Errors

```typescript
// WRONG
try {
  await execute();
} catch {
  // silent - error lost
}

// CORRECT
try {
  await execute();
} catch (error) {
  logger.error("Execution failed", { error });
  throw new TaskExecutionError("Operation failed", { cause: error });
}
```

---

### Rule 2: Always Distinguish Error Types

```typescript
// WRONG
try {
  await execute();
} catch (error) {
  // Handle all errors the same way
}

// CORRECT
try {
  await execute();
} catch (error) {
  if (error instanceof NetworkError) {
    await retry();
  } else if (error instanceof ValidationError) {
    await reportInvalidInput();
  } else {
    throw error; // Re-throw unknown errors
  }
}
```

---

### Rule 3: Use Result Pattern For Expected Outcomes

```typescript
// For expected, handleable outcomes use Result type
type Result<T> = { success: true; value: T } | { success: false; error: Error };

async function process(input: string): Promise<Result<Data>> {
  try {
    const data = await fetch(input);
    return { success: true, value: data };
  } catch (error) {
    return { success: false, error };
  }
}

// Caller explicitly handles both branches
const result = await process(input);
if (result.success) {
  use(result.value);
} else {
  handle(result.error);
}
```

---

### Rule 4: Use Throws For Unexpected Failures

```typescript
// When failure indicates a bug or invariant violation, throw
function validate(data: Schema): void {
  if (!isValid(data)) {
    throw new ValidationError("Data does not match schema", { invalidField: data.field });
  }
}
```

---

# Async Patterns

## Promise Handling

```typescript
// Always await promises in async functions
async function execute(): Promise<Result> {
  const data = await fetchData(); // awaited
  return process(data); // returned directly (already a promise resolution)
}

// Use Promise.all for independent parallel operations
const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()]);

// Use Promise.allSettled when partial failure is acceptable
const results = await Promise.allSettled(tasks.map(t => executeTask(t)));
```

---

## Cancellation Support

```typescript
class CancelledError extends Error {
  readonly name = "CancelledError";
  constructor() {
    super("Operation was cancelled");
  }
}

async function cancellableExecute(
  signal: AbortSignal,
  work: () => Promise<Result>
): Promise<Result> {
  if (signal.aborted) {
    throw new CancelledError();
  }

  signal.addEventListener("abort", () => {
    // Clean up resources
  });

  return work();
}
```

---

# Documentation In Code

## Module-Level Documentation

Every module file SHALL begin with:

```typescript
/**
 * Task Scheduler - Manages task scheduling and dispatch.
 * 
 * Responsibilities:
 * - Schedule tasks by priority and capability requirements
 * - Maintain scheduler queue with bounded capacity
 * - Emit scheduling events to the event bus
 * 
 * Invariants:
 * - Tasks are always scheduled in priority order
 * - Queue never exceeds MAX_QUEUE_SIZE
 * - Every scheduled task produces a scheduling event
 * 
 * @module task-scheduler
 */
```

---

## Function Documentation

Every public function SHALL have:

```typescript
/**
 * Resolve the best available worker for a task.
 * 
 * Selects workers by: capability match > availability > recent failure rate.
 * 
 * @param task - The task requiring a worker
 * @param candidates - Available worker pool
 * @returns The selected worker, or undefined if no suitable worker exists
 * @throws {WorkerPoolError} If candidate list is empty
 */
function resolveWorker(task: Task, candidates: Worker[]): Worker | undefined;
```

---

## Inline Comments

Inline comments explain WHY, not WHAT:

```typescript
// WRONG - comment explains what code obviously does
const retries = 3; // Set retries to 3

// CORRECT - comment explains why this value was chosen
// Ollama rate limit is 100 req/min; backoff at 80% threshold
const retryThreshold = Math.floor(maxRequests * 0.8);
```

---

# Testing Standards

## Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { TaskScheduler } from "./task-scheduler";

describe("TaskScheduler", () => {
  describe("scheduleTask", () => {
    it("should schedule a task with default priority", () => {
      // Arrange
      const scheduler = new TaskScheduler();
      const config: TaskConfig = { /* ... */ };

      // Act
      await scheduler.scheduleTask(config);

      // Assert
      expect(scheduler.queue.size).toBe(1);
    });

    it("should throw SchedulerFullError when queue is at capacity", () => {
      // Arrange
      const scheduler = new TaskScheduler({ maxQueueSize: 2 });
      await scheduler.scheduleTask(taskAtPriority(1));
      await scheduler.scheduleTask(taskAtPriority(2));

      // Act + Assert
      expect(async () => {
        await scheduler.scheduleTask(taskAtPriority(3));
      }).toThrow(SchedulerFullError);
    });
  });
});
```

---

## Test Rules

| Rule | Requirement |
|---|---|
| Every public function has tests | Required |
| Tests are deterministic | No timing dependencies |
| Edge cases tested | Boundary values, empty inputs, errors |
| Error paths tested | All throw conditions verified |
| Test naming | Describes scenario, not implementation |

---

# Performance Standards

## Efficiency Rules

- Avoid O(n²) algorithms where O(n) possible
- Use streaming for large data sets (> 1MB)
- Cache computed results when recomputation is expensive
- Never block the event loop for > 50ms
- Use async I/O (never sync file operations in runtime path)

## Memory Rules

- Release references when no longer needed
- Use WeakMap/WeakSet for caching where appropriate
- Prevent memory leaks in event listeners
- Document memory ownership semantics

---

# Security Standards

## Input Validation

```typescript
// ALL external input MUST be validated
import { z } from "zod";

const TaskConfigSchema = z.object({
  priority: z.number().int().min(1).max(10),
  capability: z.string().min(1),
  payload: z.unknown(),
});

type TaskConfig = z.infer<typeof TaskConfigSchema>;

function validateTaskConfig(raw: unknown): TaskConfig {
  return TaskConfigSchema.parse(raw);
}
```

---

## Data Handling

- Never log sensitive data (tokens, keys, user data)
- Sanitize all external input
- Validate all external output
- Use environment variables for configuration (never commit secrets)

---

# Anti-Patterns

## Type Any

```typescript
// WRONG
function process(data: any): any { }

// CORRECT
function process(data: unknown): Result {
  if (!isValidResult(data)) {
    throw new ValidationError("Invalid result format");
  }
  return transform(data);
}
```

---

## Silent Catches

```typescript
// WRONG
try { await execute(); } catch { /* empty */ }

// CORRECT
try { await execute(); } catch (error) {
  logger.error("Operation failed", { error });
  throw;
}
```

---

## Deep Nesting

```typescript
// WRONG
if (a) {
  if (b) {
    if (c) {
      doSomething();
    }
  }
}

// CORRECT - early return
if (!a || !b || !c) return;
doSomething();
```

---

## God Objects

Objects that manage too many responsibilities:

```typescript
// WRONG - class with 15 responsibilities
class Manager {
  schedule() { }
  dispatch() { }
  provide() { }
  recover() { }
  monitor() { }
  // ... 10 more methods
}

// CORRECT - single responsibility
class Scheduler {
  schedule(config): Task { }
}
```

---

# Related Documents

- `02_ENGINEERING_PRINCIPLES.md` - Principles 13, 14, 15 (Code quality)
- `04_ARCHITECTURE_PHILOSOPHY.md` - Interface contracts
- `06_SYSTEM_ARCHITECTURE.md` - Component structure
- `11_DOCUMENTATION.md` - Documentation standards
- `12_SUCCESS_CRITERIA.md` - Code completeness criteria
- `15_DECISION_RULES.md` - Implementation decision authority

---

# Final Rule

Code that cannot be verified by another autonomous agent is incomplete.

Standards exist to make code:
- Predictable (naming, structure)
- Verifiable (types, contracts)
- Maintainable (documentation, organization)
- Testable (explicit interfaces, clear errors)

Write code as if another agent must read it, understand it, and extend it without asking you questions.

Because they will.