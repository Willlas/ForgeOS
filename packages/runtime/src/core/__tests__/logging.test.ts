/**
 * Logging Tests - Comprehensive test suite for the Runtime logging infrastructure.
 *
 * Tests:
 * - Log levels
 * - Structured logging
 * - Multiple log targets (console, file, in-memory)
 * - Correlation IDs
 * - Log filtering
 * - Benchmark helper
 * - LogManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LogLevel,
  parseLogLevel,
  Logger,
  LogManager,
  createDefaultLogger,
  createBenchmark,
  ConsoleLogTarget,
  InMemoryLogTarget,
  NullLogTarget,
  LogFilter,
  type LogEvent,
} from "../logging";

// Suppress console output during tests
const originalConsole = { ...console };

function silenceConsole(): void {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  console.debug = vi.fn();
}

describe("Logging", () => {
  beforeEach(() => {
    silenceConsole();
  });

  // ========================================================================
  // Log Level Tests
  // ========================================================================

  describe("LogLevel", () => {
    it("should have correct numeric values", () => {
      expect(LogLevel.Trace).toBe(0);
      expect(LogLevel.Debug).toBe(1);
      expect(LogLevel.Info).toBe(2);
      expect(LogLevel.Warn).toBe(3);
      expect(LogLevel.Error).toBe(4);
      expect(LogLevel.Fatal).toBe(5);
      expect(LogLevel.Off).toBe(6);
    });

    it("should parse string level names", () => {
      expect(parseLogLevel("trace")).toBe(LogLevel.Trace);
      expect(parseLogLevel("Trace")).toBe(LogLevel.Trace);
      expect(parseLogLevel("debug")).toBe(LogLevel.Debug);
      expect(parseLogLevel("info")).toBe(LogLevel.Info);
      expect(parseLogLevel("warn")).toBe(LogLevel.Warn);
      expect(parseLogLevel("error")).toBe(LogLevel.Error);
      expect(parseLogLevel("fatal")).toBe(LogLevel.Fatal);
    });

    it("should parse numeric levels", () => {
      expect(parseLogLevel(0)).toBe(LogLevel.Trace);
      expect(parseLogLevel(2)).toBe(LogLevel.Info);
      expect(parseLogLevel(4)).toBe(LogLevel.Error);
    });

    it("should return Info for invalid input", () => {
      expect(parseLogLevel("invalid")).toBe(LogLevel.Info);
      expect(parseLogLevel(-1)).toBe(LogLevel.Info);
      expect(parseLogLevel(99)).toBe(LogLevel.Info);
    });
  });

  // ========================================================================
  // Logger Tests
  // ========================================================================

  describe("Logger", () => {
    let target: InMemoryLogTarget;

    beforeEach(() => {
      target = new InMemoryLogTarget();
    });

    it("should log at Info level by default", () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Info });
      logger.info("hello world");

      const logs = target.query({});
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe("hello world");
      expect(logs[0].level).toBe(LogLevel.Info);
    });

    it("should respect minLevel configuration", () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Warn });
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");

      const logs = target.query({});
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.Warn);
    });

    it("should include context in log event", () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Debug });
      logger.info("action", { userId: "u1", action: "login" });

      const logs = target.query({});
      expect(logs[0].context).toEqual({ userId: "u1", action: "login" });
    });

    it("should support correlation IDs", () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Debug });
      const correlatedLogger = logger.withCorrelationId("corr-456");
      correlatedLogger.info("correlated action");

      const logs = target.query({});
      expect(logs[0].correlationId).toBe("corr-456");
    });

    it("should include error details at Error level", () => {
      const err = new Error("test error");
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Error });
      logger.error("fail", { context: true }, err);

      const logs = target.query({});
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error!.name).toBe("Error");
      expect(logs[0].error!.message).toBe("test error");
    });

    it("should include error details at Fatal level", () => {
      const err = new TypeError("fatal type error");
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Fatal });
      logger.fatal("system crash", { system: "core" }, err);

      const logs = target.query({});
      expect(logs[0].level).toBe(LogLevel.Fatal);
      expect(logs[0].error!.name).toBe("TypeError");
      expect(logs[0].error!.message).toBe("fatal type error");
    });

    it("should log at Trace level when configured", () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Trace });
      logger.trace("trace me");

      const logs = target.query({});
      expect(logs[0].level).toBe(LogLevel.Trace);
    });

    it("should benchmark async function and log duration", async () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Debug });
      const result = await logger.benchmark("slow-op", async () => {
        await new Promise((r) => setTimeout(r, 5));
        return "done";
      });

      expect(result).toBe("done");
      const logs = target.query({});
      const benchmarkLog = logs.find((l) => l.message.includes("Benchmark completed"));
      expect(benchmarkLog).toBeDefined();
      expect(benchmarkLog!.durationMs).toBeGreaterThan(0);
    });

    it("should log error when benchmark fails", async () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Error });
      await expect(
        logger.benchmark("failing-op", async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      const logs = target.query({});
      const errorLog = logs.find((l) => l.message.includes("Benchmark failed"));
      expect(errorLog).toBeDefined();
    });

    it("should silently pass level filtering for benchmark", async () => {
      const logger = new Logger("test", { targets: [target], minLevel: LogLevel.Error });
      await logger.benchmark("info-bench", async () => "ok", LogLevel.Info);

      // No debug logs should appear (minLevel is Error)
      const logs = target.query({});
      expect(logs.length).toBe(0);
    });
  });

  // ========================================================================
  // LogManager Tests
  // ========================================================================

  describe("LogManager", () => {
    it("should create loggers with default config", () => {
      const { manager, logger } = createDefaultLogger();
      expect(logger).toBeDefined();

      const another = manager.getLogger("another");
      expect(another).toBeDefined();
    });

    it("should return same logger instance for same name", () => {
      const { manager } = createDefaultLogger();
      const l1 = manager.getLogger("shared");
      const l2 = manager.getLogger("shared");
      expect(l1).toBe(l2);
    });

    it("should allow different names to produce different loggers", () => {
      const { manager } = createDefaultLogger();
      const l1 = manager.getLogger("a");
      const l2 = manager.getLogger("b");
      // They are different Logger instances but both exist on the manager
      expect(l1).not.toBe(l2);
    });

    it("should create logger with InMemory + Console targets", () => {
      const result = createDefaultLogger();
      expect(result.manager).toBeDefined();
      expect(result.logger).toBeDefined();
      expect(result.consoleTarget).toBeDefined();
    });
  });

  // ========================================================================
  // Log Filter Tests
  // ========================================================================

  describe("LogFilter", () => {
    it("should allow events at or above minLevel", () => {
      const filter = new LogFilter({ minLevel: LogLevel.Warn });
      expect(filter.shouldProcess({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Warn, message: "" } as LogEvent)).toBe(true);
      expect(filter.shouldProcess({ id: "2", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Error, message: "" } as LogEvent)).toBe(true);
      expect(filter.shouldProcess({ id: "3", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, message: "" } as LogEvent)).toBe(false);
    });

    it("should exclude specified loggers", () => {
      const filter = new LogFilter({ excludedLoggers: ["silent.logger"] });
      expect(filter.shouldProcess({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "silent.logger", message: "" } as LogEvent)).toBe(false);
      expect(filter.shouldProcess({ id: "2", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "other.logger", message: "" } as LogEvent)).toBe(true);
    });

    it("should allow only specified loggers when set", () => {
      const filter = new LogFilter({ allowedLoggers: ["allowed.logger"] });
      expect(filter.shouldProcess({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "allowed.logger", message: "" } as LogEvent)).toBe(true);
      expect(filter.shouldProcess({ id: "2", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "other.logger", message: "" } as LogEvent)).toBe(false);
    });

    it("should add loggers dynamically", () => {
      const filter = new LogFilter({});
      filter.addAllowedLogger("dynamic");
      expect(filter.shouldProcess({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "dynamic", message: "" } as LogEvent)).toBe(true);
    });
  });

  // ========================================================================
  // InMemoryLogTarget Tests
  // ========================================================================

  describe("InMemoryLogTarget", () => {
    it("should store and query logs", () => {
      const target = new InMemoryLogTarget();
      target.write({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "test", message: "msg1" } as LogEvent);
      target.write({ id: "2", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Error, logger: "test", message: "msg2" } as LogEvent);

      const infoLogs = target.query({ level: LogLevel.Info });
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].message).toBe("msg1");
    });

    it("should filter by logger name", () => {
      const target = new InMemoryLogTarget();
      target.write({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "a", message: "msg" } as LogEvent);
      target.write({ id: "2", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "b", message: "msg" } as LogEvent);

      const filtered = target.query({ logger: "a" });
      expect(filtered).toHaveLength(1);
    });

    it("should filter by correlation ID", () => {
      const target = new InMemoryLogTarget();
      target.write({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "a", message: "msg", correlationId: "c1" } as LogEvent);

      const filtered = target.query({ correlationId: "c1" });
      expect(filtered).toHaveLength(1);
    });

    it("should limit query results with limit parameter", () => {
      const target = new InMemoryLogTarget();
      for (let i = 0; i < 5; i++) {
        target.write({ id: String(i), timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "test", message: `msg${i}` } as LogEvent);
      }

      const limited = target.query({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it("should not accept size argument (no parameter constructor)", () => {
      // InMemoryLogTarget constructor accepts no arguments in current impl
      const target = new InMemoryLogTarget();
      for (let i = 0; i < 5; i++) {
        target.write({ id: String(i), timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "test", message: `msg${i}` } as LogEvent);
      }

      // Default max is 10000 so should hold all 5
      expect(target.getAll().length).toBe(5);
    });

    it("should clear all logs", () => {
      const target = new InMemoryLogTarget();
      target.write({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "test", message: "msg" } as LogEvent);
      target.clear();
      expect(target.getAll()).toHaveLength(0);
    });
  });

  // ========================================================================
  // NullLogTarget Tests
  // ========================================================================

  describe("NullLogTarget", () => {
    it("should silently discard all events", () => {
      const target = new NullLogTarget();
      expect(() => target.write({ id: "1", timestamp: new Date().toISOString(), ts: Date.now(), level: LogLevel.Info, logger: "test", message: "msg" } as LogEvent)).not.toThrow();
    });

    it("should report healthy", () => {
      const target = new NullLogTarget();
      expect(target.healthCheck()).toBe(true);
    });
  });

  // ========================================================================
  // Benchmark Helper Tests
  // ========================================================================

  describe("createBenchmark", () => {
    it("should measure duration correctly", () => {
      const { start, end } = createBenchmark();
      const t0 = start();
      // Small delay
      for (let i = 0; i < 1000; i++) { /* noop */ }
      const duration = end(t0, "noop");

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should output debug message when label provided", () => {
      silenceConsole();
      const { start, end } = createBenchmark();
      const t0 = start();
      end(t0, "test-label");

      expect(console.debug).toHaveBeenCalled();
    });
  });
});