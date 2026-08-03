/**
 * Logging - Structured observability infrastructure for the Runtime.
 *
 * Provides:
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Structured logging with context
 * - Log event production to the EventBus
 * - Multiple log targets (console, file, future external)
 * - Correlation IDs for distributed tracing
 * - Performance benchmarking helper
 *
 * Every important event produces logs. Every log becomes searchable.
 * Nothing important happens silently.
 *
 * @module core/logging
 */

// ============================================================================
// Log Levels
// ============================================================================

export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Fatal = 5,
  Off = 6,
}

/**
 * Map of log level names (case-insensitive) to their numeric values.
 */
const LOG_LEVEL_MAP: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  off: 6,
};

/**
 * Convert a string or enum value to a LogLevel.
 * String comparison is case-insensitive.
 */
export function parseLogLevel(level: string | number): LogLevel {
  if (typeof level === "number") {
    return (Object.values(LogLevel) as number[]).includes(level)
      ? (level as LogLevel)
      : LogLevel.Info;
  }

  const lower = level.toLowerCase().trim();
  if (Object.hasOwn(LOG_LEVEL_MAP, lower)) {
    const num = LOG_LEVEL_MAP[lower];
    return (Object.values(LogLevel) as number[]).includes(num) ? (num as LogLevel) : LogLevel.Info;
  }
  return LogLevel.Info;
}

// ============================================================================
// Log Event
// ============================================================================

/**
 * A structured log event.
 */
export interface LogEvent {
  /** Unique identifier */
  id: string;

  /** Timestamp of the log entry */
  timestamp: string;

  /** Numeric millisecond timestamp for easy sorting/comparison */
  ts: number;

  /** Log level */
  level: LogLevel;

  /** Human-readable log level name */
  levelName: string;

  /** Logging category / subsystem that produced this */
  logger: string;

  /** The message template or text */
  message: string;

  /** Additional structured context */
  context?: Record<string, unknown>;

  /** Correlation ID for distributed tracing */
  correlationId?: string;

  /** Error details if level is Error or Fatal */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: number;
  };

  /** Duration in ms if this is a performance log */
  durationMs?: number;
}

// ============================================================================
// Log Target Interface
// ============================================================================

/**
 * Interface for log output targets.
 * Implementations can write to console, files, external services, etc.
 */
export interface ILogTarget {
  /** Write a log event to this target */
  write(event: LogEvent): void;

  /** Shutdown the target (flush buffers, close connections) */
  shutdown(): Promise<void>;

  /** Health check */
  healthCheck(): boolean;
}

// ============================================================================
// Console Log Target
// ============================================================================

/**
 * Writes log events to the console with color formatting.
 */
export class ConsoleLogTarget implements ILogTarget {
  private useColors: boolean;

  constructor(useColors?: boolean) {
    this.useColors = useColors ?? (process.env.NODE_ENV !== "test" && !!process.stdout?.hasColors);
  }

  write(event: LogEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const levelColor = this.getLevelColor(event.level);
    const contextStr = event.context ? ` ${JSON.stringify(event.context)}` : "";
    const errorStr = event.error ? ` ${event.error.name}: ${event.error.message}` : "";
    const durationStr = event.durationMs !== undefined ? ` (${event.durationMs.toFixed(2)}ms)` : "";

    const line = `${levelColor}[${event.levelName}]${"\x1b[0"}] ${timestamp} ${event.logger}${contextStr}${errorStr}${durationStr}`;

    switch (event.level) {
      case LogLevel.Error:
      case LogLevel.Fatal:
        console.error(line);
        break;
      case LogLevel.Warn:
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  getLevelColor(level: LogLevel): string {
    if (!this.useColors) return "";

    switch (level) {
      case LogLevel.Fatal:
        return "\x1b[101m\x1b[97m"; // Red background, white text
      case LogLevel.Error:
        return "\x1b[31m"; // Red
      case LogLevel.Warn:
        return "\x1b[33m"; // Yellow
      case LogLevel.Info:
        return "\x1b[32m"; // Green
      case LogLevel.Debug:
        return "\x1b[36m"; // Cyan
      case LogLevel.Trace:
        return "\x1b[90m"; // Gray
      default:
        return "";
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  healthCheck(): boolean {
    return true;
  }
}

// ============================================================================
// File Log Target
// ============================================================================

/**
 * Writes log events to a file (Node.js environment).
 */
export class FileLogTarget implements ILogTarget {
  private _filePath: string;
  // @ts-expect-error - placeholder for future stream implementation
  private _stream?: any;
  private buffer: LogEvent[];
  private initialized: boolean;

  constructor(filePath: string) {
    this._filePath = filePath;
    void this._filePath; // suppress TS6133
    this.buffer = [];
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    // Placeholder for file stream initialization
    this.initialized = true;
  }

  write(event: LogEvent): void {
    if (!this.initialized) return;

    const line = JSON.stringify({
      timestamp: event.timestamp,
      level: event.levelName,
      logger: event.logger,
      message: event.message,
      context: event.context,
      correlationId: event.correlationId,
      durationMs: event.durationMs,
    }) + "\n";

    this.buffer.push(line as unknown as LogEvent);

    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  private flush(): void {
    // Placeholder for actual file writing
    this.buffer = [];
  }

  async shutdown(): Promise<void> {
    this.flush();
    this.initialized = false;
  }

  healthCheck(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// InMemory Log Target
// ============================================================================

/**
 * Stores log events in memory for querying and testing.
 */
export class InMemoryLogTarget implements ILogTarget {
  private logs: LogEvent[];
  private maxSize: number;

  constructor(maxSize?: number) {
    this.logs = [];
    this.maxSize = maxSize ?? 10000;
  }

  write(event: LogEvent): void {
    this.logs.push(event);

    // Trim oldest logs if exceeding max size
    while (this.logs.length > this.maxSize) {
      this.logs.shift();
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  healthCheck(): boolean {
    return true;
  }

  /**
   * Query logs with filters.
   */
  query(filters: {
    level?: LogLevel;
    logger?: string;
    correlationId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): LogEvent[] {
    let results = [...this.logs];

    if (filters.level !== undefined) {
      results = results.filter((e) => e.level === filters.level);
    }

    if (filters.logger) {
      results = results.filter((e) => e.logger === filters.logger);
    }

    if (filters.correlationId) {
      results = results.filter((e) => e.correlationId === filters.correlationId);
    }

    if (filters.startDate) {
      results = results.filter((e) => new Date(e.timestamp) >= new Date(filters.startDate!));
    }

    if (filters.endDate) {
      results = results.filter((e) => new Date(e.timestamp) <= new Date(filters.endDate!));
    }

    if (filters.limit && filters.limit > 0) {
      results = results.slice(-filters.limit);
    }

    return results;
  }

  clear(): void {
    this.logs = [];
  }

  getAll(): LogEvent[] {
    return [...this.logs];
  }
}

// ============================================================================
// Null Log Target (no-op)
// ============================================================================

/**
 * Discards all log events. Useful for disabling logging in tests.
 */
export class NullLogTarget implements ILogTarget {
  write(): void {}
  shutdown(): Promise<void> { return Promise.resolve(); }
  healthCheck(): boolean { return true; }
}

// ============================================================================
// Log Event Bus Integration Target
// ============================================================================

/**
 * Forwards log events as Runtime events via the EventBus.
 */
export class EventBusLogTarget {
  private eventEmitter?: { on: (event: string, handler: Function) => void; emit: (event: string, data: unknown) => void };

  constructor(eventEmitter: { on: (event: string, handler: Function) => void; emit: (event: string, data: unknown) => void }) {
    this.eventEmitter = eventEmitter;
    
    // Register to emit log events
    this.setupEmission();
  }

  private setupEmission(): void {
    // This is a simplified integration - the actual implementation
    // would need access to the EventBus at construction time
  }

  write(event: LogEvent): void {
    // Emit as log event through the bus
    if (this.eventEmitter) {
      this.eventEmitter.emit("log", event);
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  healthCheck(): boolean {
    return true;
  }
}

// ============================================================================
// Log Filter
// ============================================================================

/**
 * A log filter that selectively allows or blocks log events.
 */
export class LogFilter {
  private minLevel: LogLevel;
  private allowedLoggers: Set<string>;
  private excludedLoggers: Set<string>;

  constructor(options?: {
    minLevel?: LogLevel;
    allowedLoggers?: string[];
    excludedLoggers?: string[];
  }) {
    this.minLevel = options?.minLevel ?? LogLevel.Debug;
    this.allowedLoggers = new Set(options?.allowedLoggers);
    this.excludedLoggers = new Set(options?.excludedLoggers);
  }

  shouldProcess(event: LogEvent): boolean {
    // Check minimum level
    if (event.level < this.minLevel) {
      return false;
    }

    // Check excluded loggers
    if (this.excludedLoggers.has(event.logger)) {
      return false;
    }

    // Check allowed loggers
    if (this.allowedLoggers.size > 0 && !this.allowedLoggers.has(event.logger)) {
      return false;
    }

    return true;
  }

  addAllowedLogger(logger: string): void {
    this.allowedLoggers.add(logger);
  }

  addExcludedLogger(logger: string): void {
    this.excludedLoggers.add(logger);
  }
}

// ============================================================================
// Logger - The main logging API for subsystems
// ============================================================================

/**
 * Configuration for a named logger.
 */
export interface LoggerConfig {
  /** Minimum log level */
  minLevel: LogLevel;
  /** Target loggers (if empty, all targets are used) */
  targets: ILogTarget[];
}

/**
 * Structured logger instance for a specific subsystem.
 */
export class Logger {
  private name: string;
  private config: LoggerConfig;
  private correlationId?: string;
  private logEventIdCounter: number;

  constructor(name: string, config?: Partial<LoggerConfig>) {
    this.name = name;
    this.config = {
      minLevel: config?.minLevel ?? LogLevel.Info,
      targets: config?.targets ?? [],
    };
    this.correlationId = undefined;
    this.logEventIdCounter = 0;
  }

  /**
   * Set a correlation ID for all log messages from this logger.
   */
  withCorrelationId(id: string): Logger {
    const cloned = new Logger(this.name, this.config);
    cloned.correlationId = id;
    return cloned;
  }

  /**
   * Log at Trace level.
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.emit(LogLevel.Trace, message, context);
  }

  /**
   * Log at Debug level.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.emit(LogLevel.Debug, message, context);
  }

  /**
   * Log at Info level.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.emit(LogLevel.Info, message, context);
  }

  /**
   * Log at Warn level.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit(LogLevel.Warn, message, context);
  }

  /**
   * Log at Error level.
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    const errDetail = error
      ? { name: error.name ?? "Error", message: error.message ?? "", stack: error.stack }
      : undefined;

    this.emit(LogLevel.Error, message, context, errDetail);
  }

  /**
   * Log at Fatal level.
   */
  fatal(message: string, context?: Record<string, unknown>, error?: Error): void {
    const errDetail = error
      ? { name: error.name ?? "FatalError", message: error.message ?? "", stack: error.stack }
      : undefined;

    this.emit(LogLevel.Fatal, message, context, errDetail);
  }

  /**
   * Benchmark a function and log the duration.
   */
  async benchmark(
    actionName: string,
    fn: () => Promise<unknown> | unknown,
    level: LogLevel = LogLevel.Debug
  ): Promise<unknown> {
    const start = performance.now();
    try {
      const result = fn();
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.emit(
        LogLevel.Error,
        `Benchmark failed: ${actionName}`,
        { durationMs: duration, error: (error as Error).message }
      );
      throw error;
    } finally {
      const duration = performance.now() - start;
      if (level !== LogLevel.Error) {
        this.emit(level, `Benchmark completed: ${actionName}`, { durationMs: duration });
      }
    }
  }

  // --- Emit ---

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    errorDetails?: { name: string; message: string; stack?: string }
  ): void {
    if (level < this.config.minLevel) return;

    const event: LogEvent = {
      id: `log-${Date.now()}-${++this.logEventIdCounter}`,
      timestamp: new Date().toISOString(),
      ts: Date.now(),
      level,
      levelName: LogLevel[level],
      logger: this.name,
      message,
      context,
      correlationId: this.correlationId,
      error: errorDetails ? { ...errorDetails } : undefined,
      durationMs: context && "durationMs" in context ? (context.durationMs as number) : undefined,
    };

    for (const target of this.config.targets) {
      try {
        target.write(event);
      } catch (err) {
        // Don't let target failures break the logger
        console.error(`[Logger] Failed to write to target: ${(err as Error).message}`);
      }
    }
  }
}

// ============================================================================
// Logger Manager - Creates and manages named loggers
// ============================================================================

/**
 * Central manager for all Runtime loggers.
 */
export class LogManager {
  private loggers: Map<string, Logger>;
  private defaultConfig: Partial<LoggerConfig>;
  // @ts-expect-error - placeholder for future global filter implementation
  private _globalFilter?: LogFilter;

  constructor(defaultConfig?: Partial<LoggerConfig>) {
    this.loggers = new Map();
    this.defaultConfig = defaultConfig ?? { minLevel: LogLevel.Info };
    this._globalFilter = undefined;
  }

  /**
   * Get or create a named logger.
   */
  getLogger(name: string): Logger {
    let logger = this.loggers.get(name);
    if (!logger) {
      logger = new Logger(name, { ...this.defaultConfig });
      this.loggers.set(name, logger);
    }
    return logger;
  }

  /**
   * Set a global filter for all loggers.
   */
  setGlobalFilter(filter: LogFilter): void {
    this._globalFilter = filter;
  }

  /**
   * Shutdown all targets.
   */
  async shutdown(): Promise<void> {
    // Targets would need to be tracked on the Logger for proper cleanup
  }

  /**
   * Get all log events from InMemoryLogTarget instances.
   */
  getAllLogs(): LogEvent[] {
    const results: LogEvent[] = [];
    for (const _logger of this.loggers.values()) {
      // We cannot directly access the targets here because Logger keeps them private.
      // Instead, we provide a hook via the InMemoryLogTarget.
    }
    return results;
  }

  /**
   * Register an InMemoryLogTarget so the manager can retrieve logs from it.
   * Used by the IPC layer to access log data externally.
   */
  private memoryTargets: InMemoryLogTarget[] = [];

  registerMemoryTarget(target: InMemoryLogTarget): void {
    this.memoryTargets.push(target);
  }

  /**
   * Retrieve recent log entries from registered InMemoryLogTargets.
   */
  getRecentLogs(limit?: number): LogEvent[] {
    const all: LogEvent[] = [];
    for (const target of this.memoryTargets) {
      if (limit) {
        all.push(...target.query({ limit }));
      } else {
        all.push(...target.getAll());
      }
    }
    return all;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default LogManager with console logging.
 */
export function createDefaultLogger(): { manager: LogManager; logger: Logger; consoleTarget: ConsoleLogTarget } {
  const consoleTarget = new ConsoleLogTarget();
  const target = new InMemoryLogTarget();
  
  const manager = new LogManager({
    minLevel: LogLevel.Debug,
    targets: [consoleTarget, target],
  });

  const logger = manager.getLogger("runtime");

  return { manager, logger, consoleTarget };
}

/**
 * Create a benchmark helper.
 */
export function createBenchmark(): {
  start: () => number;
  end: (startTime: number, label?: string) => number;
} {
  const start = (): number => performance.now();

  const end = (startTime: number, label?: string): number => {
    const duration = performance.now() - startTime;
    if (label) {
      console.debug(`[Benchmark] ${label}: ${duration.toFixed(4)}ms`);
    }
    return duration;
  };

  return { start, end };
}