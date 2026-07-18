/**
 * Metrics - Observability infrastructure for the Runtime.
 *
 * Provides:
 * - Counter, Gauge, Histogram, Timer metrics
 * - Structured metric collection and aggregation
 * - Export to multiple backends (console, JSON, future Prometheus)
 * - Built-in runtime statistics
 *
 * @module core/metrics
 */

// ============================================================================
// Metric Types
// ============================================================================

export enum MetricType {
  Counter = "counter",
  Gauge = "gauge",
  Histogram = "histogram",
  Timer = "timer",
  Summary = "summary",
}

// ============================================================================
// Metric Definitions
// ============================================================================

/**
 * A counter metric - monotonically increasing value.
 */
export interface CounterOptions {
  name: string;
  description: string;
  labels?: Record<string, string>;
  initialCount?: number;
}

/**
 * A gauge metric - value that can go up and down.
 */
export interface GaugeOptions {
  name: string;
  description: string;
  labels?: Record<string, string>;
  initialValue?: number;
}

/**
 * A histogram metric - observes distribution of values.
 */
export interface HistogramOptions {
  name: string;
  description: string;
  labels?: Record<string, string>;
  buckets?: number[];
}

/**
 * A timer metric - measures duration of operations.
 */
export interface TimerOptions {
  name: string;
  description: string;
  labels?: Record<string, string>;
}

// ============================================================================
// Metric Values
// ============================================================================

export interface CounterValue {
  type: MetricType.Counter;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface GaugeValue {
  type: MetricType.Gauge;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface HistogramValue {
  type: MetricType.Histogram;
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface TimerValue {
  type: MetricType.Timer;
  values: number[]; // durations in ms
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export type MetricValue = CounterValue | GaugeValue | HistogramValue | TimerValue;

// ============================================================================
// Metric Collection
// ============================================================================

/**
 * In-memory counter implementation.
 */
export class Counter {
  private options: CounterOptions;
  private value: number;

  constructor(options: CounterOptions) {
    this.options = options;
    this.value = options.initialCount ?? 0;
  }

  inc(amount?: number): void {
    this.value += amount ?? 1;
  }

  get(): number {
    return this.value;
  }

  getValue(): CounterValue {
    return {
      type: MetricType.Counter,
      value: this.value,
      labels: this.options.labels,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * In-memory gauge implementation.
 */
export class Gauge {
  private options: GaugeOptions;
  private value: number;

  constructor(options: GaugeOptions) {
    this.options = options;
    this.value = options.initialValue ?? 0;
  }

  inc(amount?: number): void {
    this.value += amount ?? 1;
  }

  dec(amount?: number): void {
    this.value -= amount ?? 1;
  }

  set(value: number): void {
    this.value = value;
  }

  get(): number {
    return this.value;
  }

  getValue(): GaugeValue {
    return {
      type: MetricType.Gauge,
      value: this.value,
      labels: this.options.labels,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * In-memory histogram implementation.
 */
export class Histogram {
  private options: HistogramOptions;
  private values: number[];

  constructor(options: HistogramOptions) {
    this.options = options;
    this.values = [];
  }

  observe(value: number): void {
    this.values.push(value);
  }

  getValues(): number[] {
    return [...this.values];
  }

  getValue(): HistogramValue {
    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      type: MetricType.Histogram,
      values: sorted,
      count,
      sum,
      min: count > 0 ? sorted[0] : 0,
      max: count > 0 ? sorted[count - 1] : 0,
      mean: count > 0 ? sum / count : 0,
      p50: count > 0 ? sorted[Math.floor(count * 0.5)] : 0,
      p95: count > 0 ? sorted[Math.floor(count * 0.95)] : 0,
      p99: count > 0 ? sorted[Math.floor(count * 0.99)] : 0,
      labels: this.options.labels,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * In-memory timer implementation (wraps histogram with ms).
 */
export class Timer {
  private options: TimerOptions;
  private histogram: Histogram;

  constructor(options: TimerOptions) {
    this.options = options;
    this.histogram = new Histogram({
      name: options.name,
      description: options.description,
      labels: options.labels,
    });
  }

  observe(value: number): void {
    this.histogram.observe(value);
  }

  /**
   * Time a function execution.
   */
  async time<T>(fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (result instanceof Promise) {
      await result;
    }

    this.observe(duration);
    return result as T;
  }

  getValue(): TimerValue {
    const histValue = this.histogram.getValue();
    return {
      type: MetricType.Timer,
      values: histValue.values,
      count: histValue.count,
      sum: histValue.sum,
      min: histValue.min,
      max: histValue.max,
      mean: histValue.mean,
      p50: histValue.p50,
      p95: histValue.p95,
      p99: histValue.p99,
      labels: this.options.labels,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Metrics Collector
// ============================================================================

/**
 * Collects and aggregates all metrics.
 */
export class MetricsCollector {
  private counters: Map<string, Counter>;
  private gauges: Map<string, Gauge>;
  private histograms: Map<string, Histogram>;
  private timers: Map<string, Timer>;
  private isRunning: boolean;

  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
    this.isRunning = false;
  }

  /**
   * Start the metrics collector.
   */
  start(): void {
    this.isRunning = true;
  }

  /**
   * Stop the metrics collector.
   */
  stop(): void {
    this.isRunning = false;
  }

  // --- Counter API ---

  counter(options: CounterOptions): Counter {
    let c = this.counters.get(options.name);
    if (!c) {
      c = new Counter(options);
      this.counters.set(options.name, c);
    }
    return c;
  }

  getCounterValue(name: string): CounterValue | null {
    const c = this.counters.get(name);
    return c ? c.getValue() : null;
  }

  // --- Gauge API ---

  gauge(options: GaugeOptions): Gauge {
    let g = this.gauges.get(options.name);
    if (!g) {
      g = new Gauge(options);
      this.gauges.set(options.name, g);
    }
    return g;
  }

  getGaugeValue(name: string): GaugeValue | null {
    const g = this.gauges.get(name);
    return g ? g.getValue() : null;
  }

  // --- Histogram API ---

  histogram(options: HistogramOptions): Histogram {
    let h = this.histograms.get(options.name);
    if (!h) {
      h = new Histogram(options);
      this.histograms.set(options.name, h);
    }
    return h;
  }

  // --- Timer API ---

  timer(options: TimerOptions): Timer {
    let t = this.timers.get(options.name);
    if (!t) {
      t = new Timer(options);
      this.timers.set(options.name, t);
    }
    return t;
  }

  // --- Collect All ---

  collectAll(): MetricValue[] {
    const values: MetricValue[] = [];

    for (const c of this.counters.values()) {
      values.push(c.getValue());
    }
    for (const g of this.gauges.values()) {
      values.push(g.getValue());
    }
    for (const h of this.histograms.values()) {
      values.push(h.getValue());
    }
    for (const t of this.timers.values()) {
      values.push(t.getValue());
    }

    return values;
  }

  // --- Summary ---

  getSummary(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; mean: number; p95: number; p99: number }>;
    timers: Record<string, { count: number; mean: number; p95: number; p99: number }>;
  } {
    const counters: Record<string, number> = {};
    for (const [name, c] of this.counters) {
      counters[name] = c.get();
    }

    const gauges: Record<string, number> = {};
    for (const [name, g] of this.gauges) {
      gauges[name] = g.get();
    }

    const histograms: Record<string, { count: number; mean: number; p95: number; p99: number }> = {};
    for (const [name, h] of this.histograms) {
      const v = h.getValue();
      histograms[name] = { count: v.count, mean: v.mean, p95: v.p95, p99: v.p99 };
    }

    const timers: Record<string, { count: number; mean: number; p95: number; p99: number }> = {};
    for (const [name, t] of this.timers) {
      const v = t.getValue();
      timers[name] = { count: v.count, mean: v.mean, p95: v.p95, p99: v.p99 };
    }

    return { counters, gauges, histograms, timers };
  }

  // --- Reset ---

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }

  isRunningFlag(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Runtime Metrics (Built-in)
// ============================================================================

/**
 * Built-in runtime metrics.
 */
export class RuntimeMetrics {
  private collector: MetricsCollector;
  private eventCount: number;
  private errorCount: number;
  private startTime: string;

  constructor(collector: MetricsCollector) {
    this.collector = collector;
    this.eventCount = 0;
    this.errorCount = 0;
    this.startTime = new Date().toISOString();

    this.registerBuiltInGauges();
  }

  private registerBuiltInGauges(): void {
    this.collector.gauge({
      name: "runtime.events_total",
      description: "Total events processed",
      initialValue: 0,
    });

    this.collector.gauge({
      name: "runtime.errors_total",
      description: "Total errors occurred",
      initialValue: 0,
    });

    this.collector.gauge({
      name: "runtime.uptime_seconds",
      description: "Runtime uptime in seconds",
      initialValue: 0,
    });
  }

  recordEvent(): void {
    this.eventCount++;
    const gauge = this.collector.gauge({
      name: "runtime.events_total",
      description: "Total events processed",
    });
    gauge.set(this.eventCount);
  }

  recordError(): void {
    this.errorCount++;
    const gauge = this.collector.gauge({
      name: "runtime.errors_total",
      description: "Total errors occurred",
    });
    gauge.set(this.errorCount);
  }

  getUptimeSeconds(): number {
    return (Date.now() - new Date(this.startTime).getTime()) / 1000;
  }

  getAllMetrics(): MetricValue[] {
    // Update uptime gauge
    const uptimeGauge = this.collector.gauge({
      name: "runtime.uptime_seconds",
      description: "Runtime uptime in seconds",
    });
    uptimeGauge.set(this.getUptimeSeconds());

    return this.collector.collectAll();
  }
}

// ============================================================================
// Metric Exporter Interface
// ============================================================================

/**
 * Interface for metric export backends.
 */
export interface IMetricExporter {
  export(values: MetricValue[]): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Console metric exporter - writes to console/log file.
 */
export class ConsoleMetricExporter implements IMetricExporter {
  async export(values: MetricValue[]): Promise<void> {
    const summary = values.map((v) => ({
      type: v.type,
      value: (v as any).value ?? (v as any).mean ?? JSON.stringify({ count: (v as any).count }),
      timestamp: v.timestamp,
    }));
    console.debug("[Metrics]", JSON.stringify(summary, null, 2));
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}