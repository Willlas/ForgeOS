/**
 * Metrics - Comprehensive tests for the metrics system.
 *
 * Tests:
 * - Counter (increment, get, value)
 * - Gauge (inc, dec, set, get, value)
 * - Histogram (observe, statistics, percentiles)
 * - Timer (observe, time wrapper, statistics)
 * - MetricsCollector (lifecycle, get/set, collectAll, reset)
 * - RuntimeMetrics (event tracking, uptime, error counting)
 * - ConsoleMetricExporter (export format, shutdown)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MetricType,
  Counter,
  Gauge,
  Histogram,
  Timer,
  MetricsCollector,
  RuntimeMetrics,
  ConsoleMetricExporter,
} from "../metrics";

// ============================================================================
// Counter Tests
// ============================================================================

describe("Counter", () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter({ name: "test_counter", description: "A test counter" });
  });

  it("should start at 0 by default", () => {
    expect(counter.get()).toBe(0);
  });

  it("should start at initialCount when provided", () => {
    const c = new Counter({ name: "initial", description: "test", initialCount: 10 });
    expect(c.get()).toBe(10);
  });

  it("should increment by 1 by default", () => {
    counter.inc();
    expect(counter.get()).toBe(1);
  });

  it("should increment by amount", () => {
    counter.inc(5);
    expect(counter.get()).toBe(5);
  });

  it("should increment multiple times", () => {
    counter.inc(3);
    counter.inc(4);
    counter.inc();
    expect(counter.get()).toBe(8);
  });

  it("should return correct CounterValue", () => {
    counter.inc(7);
    const value = counter.getValue();

    expect(value.type).toBe(MetricType.Counter);
    expect(value.value).toBe(7);
    expect(typeof value.timestamp).toBe("string");
  });
});

// ============================================================================
// Gauge Tests
// ============================================================================

describe("Gauge", () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge({ name: "test_gauge", description: "A test gauge" });
  });

  it("should start at 0 by default", () => {
    expect(gauge.get()).toBe(0);
  });

  it("should start at initialValue when provided", () => {
    const g = new Gauge({ name: "initial", description: "test", initialValue: 42 });
    expect(g.get()).toBe(42);
  });

  it("should increment by 1", () => {
    gauge.inc();
    expect(gauge.get()).toBe(1);
  });

  it("should increment by amount", () => {
    gauge.inc(10);
    expect(gauge.get()).toBe(10);
  });

  it("should decrement by 1", () => {
    gauge.inc(5);
    gauge.dec();
    expect(gauge.get()).toBe(4);
  });

  it("should decrement by amount", () => {
    gauge.inc(20);
    gauge.dec(8);
    expect(gauge.get()).toBe(12);
  });

  it("should set to specific value", () => {
    gauge.set(100);
    gauge.inc(5);
    expect(gauge.get()).toBe(105);
  });

  it("should go negative", () => {
    gauge.dec(5);
    expect(gauge.get()).toBe(-5);
  });

  it("should return correct GaugeValue", () => {
    gauge.set(42);
    const value = gauge.getValue();

    expect(value.type).toBe(MetricType.Gauge);
    expect(value.value).toBe(42);
    expect(typeof value.timestamp).toBe("string");
  });
});

// ============================================================================
// Histogram Tests
// ============================================================================

describe("Histogram", () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram({ name: "test_histogram", description: "A test histogram" });
  });

  it("should start empty", () => {
    const v = histogram.getValue();
    expect(v.count).toBe(0);
    expect(v.min).toBe(0);
    expect(v.max).toBe(0);
    expect(v.mean).toBe(0);
  });

  it("should observe values", () => {
    histogram.observe(10);
    histogram.observe(20);
    histogram.observe(30);

    const v = histogram.getValue();
    expect(v.count).toBe(3);
    expect(v.sum).toBe(60);
    expect(v.min).toBe(10);
    expect(v.max).toBe(30);
    expect(v.mean).toBe(20);
  });

  it("should calculate percentiles correctly", () => {
    // Insert sorted values for predictable percentiles
    for (let i = 1; i <= 100; i++) {
      histogram.observe(i);
    }

    const v = histogram.getValue();
    // p50 uses Math.floor(100 * 0.5) = 50 -> sorted[50] = 51
    expect(v.p50).toBe(51);
    // p95: Math.floor(100 * 0.95) = 95 -> sorted[95] = 96
    expect(v.p95).toBe(96);
    // p99: Math.floor(100 * 0.99) = 99 -> sorted[99] = 100
    expect(v.p99).toBe(100);
  });

  it("should handle single value", () => {
    histogram.observe(42);
    const v = histogram.getValue();

    expect(v.count).toBe(1);
    expect(v.min).toBe(42);
    expect(v.max).toBe(42);
    expect(v.mean).toBe(42);
    expect(v.p50).toBe(42);
  });

  it("should return copy of values", () => {
    histogram.observe(1);
    histogram.observe(2);

    const vals = histogram.getValues();
    expect(vals).toEqual([1, 2]);

    // Mutating returned array should not affect internal state
    vals.push(999);
    expect(histogram.getValues()).toEqual([1, 2]);
  });

  it("should handle unsorted input", () => {
    histogram.observe(50);
    histogram.observe(10);
    histogram.observe(30);
    histogram.observe(20);

    const v = histogram.getValue();
    expect(v.count).toBe(4);
    expect(v.min).toBe(10);
    expect(v.max).toBe(50);
    // mean of [10, 20, 30, 50] = 110/4 = 27.5
    expect(v.mean).toBeCloseTo(27.5, 1);
  });
});

// ============================================================================
// Timer Tests
// ============================================================================

describe("Timer", () => {
  let timer: Timer;

  beforeEach(() => {
    timer = new Timer({ name: "test_timer", description: "A test timer" });
  });

  it("should observe durations manually", () => {
    timer.observe(10.5);
    timer.observe(20.3);

    const v = timer.getValue();
    expect(v.count).toBe(2);
    expect(v.sum).toBeCloseTo(30.8, 1);
    expect(v.min).toBeCloseTo(10.5, 1);
    expect(v.max).toBeCloseTo(20.3, 1);
  });

  it("should time an async function", async () => {
    const result = await timer.time(async () => {
      return "done";
    });

    expect(result).toBe("done");

    const v = timer.getValue();
    expect(v.count).toBe(1);
    expect(v.sum).toBeGreaterThan(0);
  });

  it("should time a synchronous function", async () => {
    const result = await timer.time(() => {
      return "sync done";
    });

    expect(result).toBe("sync done");
    expect(timer.getValue().count).toBe(1);
  });

  it("should accumulate multiple timings", async () => {
    await timer.time(() => {});
    await timer.time(() => {});
    await timer.time(() => {});

    const v = timer.getValue();
    expect(v.count).toBe(3);
    expect(v.sum).toBeGreaterThan(0);
  });

  it("should return correct TimerValue", () => {
    timer.observe(100);
    const v = timer.getValue();

    expect(v.type).toBe(MetricType.Timer);
    expect(typeof v.timestamp).toBe("string");
    expect(Array.isArray(v.values)).toBe(true);
  });
});

// ============================================================================
// MetricsCollector Tests
// ============================================================================

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    collector.start();
  });

  afterEach(() => {
    collector.reset();
    collector.stop();
  });

  it("should be running after start", () => {
    expect(collector.isRunningFlag()).toBe(true);
  });

  it("should stop when stopped", () => {
    collector.stop();
    expect(collector.isRunningFlag()).toBe(false);
  });

  // --- Counter ---

  it("should create and retrieve counters", () => {
    const c = collector.counter({ name: "requests_total", description: "Total requests" });
    c.inc(5);

    const v = collector.getCounterValue("requests_total");
    expect(v).not.toBeNull();
    expect(v!.value).toBe(5);
  });

  it("should reuse counter with same name", () => {
    const c1 = collector.counter({ name: "counter_a", description: "test" });
    const c2 = collector.counter({ name: "counter_a", description: "test" });

    c1.inc(3);
    expect(c2.get()).toBe(3);
  });

  // --- Gauge ---

  it("should create and retrieve gauges", () => {
    const g = collector.gauge({ name: "memory_usage", description: "Memory in MB", initialValue: 256 });
    g.inc(10);

    const v = collector.getGaugeValue("memory_usage");
    expect(v).not.toBeNull();
    expect(v!.value).toBe(266);
  });

  it("should reuse gauge with same name", () => {
    const g1 = collector.gauge({ name: "gauge_a", description: "test" });
    const g2 = collector.gauge({ name: "gauge_a", description: "test" });

    g1.set(50);
    expect(g2.get()).toBe(50);
  });

  // --- Histogram ---

  it("should create histograms", () => {
    const h = collector.histogram({ name: "response_size", description: "Response size in bytes" });
    h.observe(1024);
    h.observe(2048);

    const v = h.getValue();
    expect(v.count).toBe(2);
  });

  // --- Timer ---

  it("should create timers", async () => {
    const t = collector.timer({ name: "request_duration", description: "Request duration in ms" });
    await t.time(() => {});

    const v = t.getValue();
    expect(v.count).toBe(1);
    expect(v.sum).toBeGreaterThan(0);
  });

  // --- collectAll ---

  it("should collect all metric values", () => {
    collector.counter({ name: "count_a", description: "test" }).inc(5);
    collector.gauge({ name: "gauge_a", description: "test" }).set(42);
    collector.histogram({ name: "hist_a", description: "test" }).observe(100);
    collector.timer({ name: "timer_a", description: "test" }).observe(50);

    const all = collector.collectAll();
    expect(all).toHaveLength(4);

    // Verify types
    const types = all.map((v: any) => v.type);
    expect(types).toContain(MetricType.Counter);
    expect(types).toContain(MetricType.Gauge);
    expect(types).toContain(MetricType.Histogram);
    expect(types).toContain(MetricType.Timer);
  });

  // --- getSummary ---

  it("should return summary with all metric types", () => {
    collector.counter({ name: "c1", description: "test" }).inc(3);
    collector.gauge({ name: "g1", description: "test" }).set(10);
    collector.histogram({ name: "h1", description: "test" }).observe(5);
    collector.timer({ name: "t1", description: "test" }).observe(2.5);

    const summary = collector.getSummary();

    expect(summary.counters.c1).toBe(3);
    expect(summary.gauges.g1).toBe(10);
    expect(summary.histograms.h1).toBeDefined();
    expect(summary.timers.t1).toBeDefined();
  });

  // --- reset ---

  it("should clear all metrics", () => {
    collector.counter({ name: "x", description: "test" }).inc(5);
    collector.gauge({ name: "y", description: "test" }).set(10);
    collector.histogram({ name: "z", description: "test" }).observe(99);

    collector.reset();

    const all = collector.collectAll();
    expect(all).toHaveLength(0);

    const summary = collector.getSummary();
    expect(Object.keys(summary.counters)).toHaveLength(0);
    expect(Object.keys(summary.gauges)).toHaveLength(0);
  });
});

// ============================================================================
// RuntimeMetrics Tests
// ============================================================================

describe("RuntimeMetrics", () => {
  let collector: MetricsCollector;
  let runtimeMetrics: RuntimeMetrics;

  beforeEach(() => {
    collector = new MetricsCollector();
    collector.start();
    runtimeMetrics = new RuntimeMetrics(collector);
  });

  afterEach(() => {
    collector.reset();
    collector.stop();
  });

  it("should record events", () => {
    runtimeMetrics.recordEvent();
    runtimeMetrics.recordEvent();
    runtimeMetrics.recordEvent();

    const v = collector.getGaugeValue("runtime.events_total");
    expect(v).not.toBeNull();
    expect(v!.value).toBe(3);
  });

  it("should record errors", () => {
    runtimeMetrics.recordError();
    runtimeMetrics.recordError();

    const v = collector.getGaugeValue("runtime.errors_total");
    expect(v).not.toBeNull();
    expect(v!.value).toBe(2);
  });

  it("should track uptime", () => {
    const uptime1 = runtimeMetrics.getUptimeSeconds();

    // Simulate time passing
    const uptime2 = runtimeMetrics.getUptimeSeconds();
    expect(uptime2).toBeGreaterThanOrEqual(uptime1);
  });

  it("should get all metrics including runtime gauges", () => {
    runtimeMetrics.recordEvent();
    runtimeMetrics.recordError();

    const all = runtimeMetrics.getAllMetrics();
    // Should include events_total, errors_total, uptime_seconds plus any external metrics
    expect(all.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// ConsoleMetricExporter Tests
// ============================================================================

describe("ConsoleMetricExporter", () => {
  let exporter: ConsoleMetricExporter;

  beforeEach(() => {
    exporter = new ConsoleMetricExporter();
  });

  it("should export without errors", async () => {
    const values: any[] = [
      { type: MetricType.Counter, value: 42, timestamp: new Date().toISOString() },
      { type: MetricType.Gauge, value: 3.14, timestamp: new Date().toISOString() },
    ];

    await expect(exporter.export(values)).resolves.toBeUndefined();
  });

  it("should shutdown cleanly", async () => {
    await expect(exporter.shutdown()).resolves.toBeUndefined();
  });
});