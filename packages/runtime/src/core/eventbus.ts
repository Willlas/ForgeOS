/**
 * Event Bus - Core messaging infrastructure for the Runtime.
 *
 * Implements a typed, hierarchical event system with:
 * - Typed event publishing and subscription
 * - Event filtering and routing
 * - Dead letter queue for failed handlers
 * - Structured logging integration
 * - Performance monitoring
 *
 * All subsystems communicate through the Event Bus.
 * This is the "nervous system" of the Runtime.
 *
 * @module core/eventbus
 */

import { EventEmitter } from "events";

// ============================================================================
// Event Definitions
// ============================================================================

/**
 * Structure of a Runtime event.
 * All events carry structured metadata for querying and filtering.
 */
export interface RuntimeEvent {
  /** Unique event identifier (UUID) */
  id: string;

  /** Event type identifier */
  type: string;

  /** Source subsystem that produced this event */
  source: string;

  /** Timestamp of event creation (ISO 8601) */
  timestamp: string;

  /** Monotonic clock sequence for ordering */
  sequence: number;

  /** Correlation ID for cross-event tracing */
  correlationId?: string;

  /** Causation ID - which event triggered this one */
  causationId?: string;

  /** Event payload data */
  payload: unknown;

  /** Optional metadata for extension */
  metadata: Record<string, unknown>;

  /** Priority level (0-1, 1 = highest) */
  priority: number;
}

/**
 * Handler function type for event listeners.
 */
export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;

/**
 * Filter function for selective event subscription.
 */
export type EventFilter = (event: RuntimeEvent) => boolean;

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Represents a registered event subscription.
 */
export interface EventSubscription {
  /** Unique subscription identifier */
  id: string;

  /** Event type pattern to match */
  pattern: string | RegExp | ((event: RuntimeEvent) => boolean);

  /** Handler function */
  handler: EventHandler;

  /** Optional filter for selective processing */
  filter?: EventFilter;

  /** Priority (lower = processed first) */
  priority: number;

  /** Whether this subscription is active */
  isActive: boolean;

  /** Number of times this handler has been invoked */
  invocationCount: number;

  /** Unsubscribe this handler */
  unsubscribe(): void;
}

/**
 * Statistics about event bus activity.
 */
export interface EventBusStats {
  /** Total events published */
  eventsPublished: number;

  /** Total events received by subscribers */
  eventsDelivered: number;

  /** Total handler invocations */
  handlersInvoked: number;

  /** Total handler errors */
  errors: number;

  /** Average processing time per event (ms) */
  avgProcessingTimeMs: number;

  /** Events in dead letter queue */
  deadLetterCount: number;

  /** Active subscription count */
  subscriptionCount: number;

  /** Events by type */
  eventsByType: Record<string, number>;

  /** Events by source */
  eventsBySource: Record<string, number>;
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

/**
 * Unique event ID generator using nano-ID-like approach.
 */
let eventSequence = 0;

function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const seq = (++eventSequence).toString(36);
  return `${timestamp}${random}${seq}`;
}

/**
 * Core event bus - handles all inter-subsystem communication.
 */
export class EventBus {
  private internal: EventEmitter;
  private subscriptions: Map<string, EventSubscription>;
  private deadLetterQueue: RuntimeEvent[];
  private stats: EventBusStats;
  private maxDeadLetterSize: number;
  private isStarted: boolean;

  constructor(options?: { maxDeadLetterSize?: number }) {
    this.internal = new EventEmitter();
    this.internal.setMaxListeners(100);

    this.subscriptions = new Map();
    this.deadLetterQueue = [];
    this.maxDeadLetterSize = options?.maxDeadLetterSize ?? 1000;

    this.stats = {
      eventsPublished: 0,
      eventsDelivered: 0,
      handlersInvoked: 0,
      errors: 0,
      avgProcessingTimeMs: 0,
      deadLetterCount: 0,
      subscriptionCount: 0,
      eventsByType: {},
      eventsBySource: {},
    };

    this.isStarted = false;

    // Track processing times for performance monitoring
    this._processingTimes = [];
  }

  private _processingTimes: number[];

  /**
   * Start the event bus.
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.internal.on("error", (err) => {
      console.error("[EventBus] Internal error:", err);
    });

    this.isStarted = true;
    console.log("[EventBus] Started");
  }

  /**
   * Stop the event bus and clean up.
   */
  async shutdown(): Promise<void> {
    this.isStarted = false;
    this.internal.removeAllListeners();

    // Flush dead letter queue
    if (this.deadLetterQueue.length > 0) {
      console.warn(
        `[EventBus] ${this.deadLetterQueue.length} events in dead letter queue at shutdown`
      );
    }

    console.log("[EventBus] Shutdown complete");
  }

  // --- Publishing ---

  /**
   * Publish an event to all matching subscribers.
   */
  publish(type: string, payload: unknown, options?: {
    source?: string;
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
    priority?: number;
  }): RuntimeEvent {
    const event = this.createEvent(type, payload, options);

    this.stats.eventsPublished++;
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] ?? 0) + 1;

    const source = options?.source ?? "unknown";
    this.stats.eventsBySource[source] = (this.stats.eventsBySource[source] ?? 0) + 1;

    // Emit to internal listeners
    this.internal.emit(type, event);

    // Deliver to matching subscriptions
    let delivered = 0;

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive) continue;

      if (!this.matchesPattern(subscription.pattern, event)) continue;
      if (subscription.filter && !subscription.filter(event)) continue;

      const handlerStartTime = performance.now();
      try {
        const result = subscription.handler(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            this.handleHandlerError(event, err);
          });
        }
        subscription.invocationCount++;
        this.stats.handlersInvoked++;
        delivered++;
      } catch (err) {
        this.handleHandlerError(event, err);
      }

      const handlerTime = performance.now() - handlerStartTime;
      this._processingTimes.push(handlerTime);

      // Keep processing times manageable
      if (this._processingTimes.length > 1000) {
        this._processingTimes = this._processingTimes.slice(-500);
      }
    }

    this.stats.eventsDelivered += delivered;

    // Calculate average processing time
    const times = this._processingTimes;
    if (times.length > 0) {
      this.stats.avgProcessingTimeMs =
        times.reduce((a, b) => a + b, 0) / times.length;
    }

    // Log the event
    this.logEvent(event);

    return event;
  }

  /**
   * Publish an event asynchronously (fire and forget).
   */
  publishAsync(type: string, payload: unknown, options?: {
    source?: string;
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
    priority?: number;
  }): Promise<RuntimeEvent> {
    return Promise.resolve(this.publish(type, payload, options));
  }

  // --- Subscriptions ---

  /**
   * Subscribe to events by exact type match.
   */
  on(type: string, handler: EventHandler): () => void {
    return this.subscribe(type, handler);
  }

  /**
   * Subscribe to events by pattern match.
   */
  subscribe(
    pattern: string | RegExp | ((event: RuntimeEvent) => boolean),
    handler: EventHandler,
    options?: { priority?: number; filter?: EventFilter }
  ): () => void {
    const id = `sub-${generateEventId()}`;

    const subscription: EventSubscription = {
      id,
      pattern,
      handler,
      filter: options?.filter,
      priority: options?.priority ?? 0,
      isActive: true,
      invocationCount: 0,
      unsubscribe: () => {
        subscription.isActive = false;
        this.subscriptions.delete(id);
        this.stats.subscriptionCount = this.subscriptions.size;
      },
    };

    this.subscriptions.set(id, subscription);
    this.stats.subscriptionCount = this.subscriptions.size;

    return subscription.unsubscribe;
  }

  /**
   * Subscribe once to a specific event type.
   */
  once(type: string, handler: EventHandler): () => void {
    const unsubscribe = this.on(type, async (event) => {
      handler(event);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe all handlers for a specific type.
   */
  off(type: string): void {
    for (const subscription of this.subscriptions.values()) {
      if (
        typeof subscription.pattern === "string" &&
        subscription.pattern === type
      ) {
        subscription.isActive = false;
      }
    }
  }

  // --- Wildcard Subscription Patterns ---

  /**
   * Subscribe to events matching a wildcard pattern.
   * Examples: "worker.*", "scheduler.*", "workspace.*"
   */
  onWildcard(pattern: string, handler: EventHandler): () => void {
    const regexPattern = new RegExp(
      "^" + pattern.replace(/\*/g, ".*") + "$"
    );

    return this.subscribe(regexPattern, handler);
  }

  // --- Dead Letter Queue ---

  /**
   * Handle a failed event handler.
   */
  private handleHandlerError(event: RuntimeEvent, error: unknown): void {
    this.stats.errors++;

    console.error(
      `[EventBus] Handler error for event "${event.type}":`,
      error
    );

    // Add to dead letter queue
    const deadEvent = { ...event };
    this.deadLetterQueue.push(deadEvent);

    // Evict oldest if over capacity
    while (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue.shift();
    }

    this.stats.deadLetterCount = this.deadLetterQueue.length;

    // Emit error event
    this.publish("event_bus.handler_error", {
      originalEvent: event,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Get events from the dead letter queue.
   */
  getDeadLetterQueue(): RuntimeEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear the dead letter queue.
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
    this.stats.deadLetterCount = 0;
  }

  // --- Statistics ---

  /**
   * Get current event bus statistics.
   */
  getStats(): EventBusStats {
    return { ...this.stats };
  }

  /**
   * Reset event bus statistics.
   */
  resetStats(): void {
    this.stats = {
      eventsPublished: 0,
      eventsDelivered: 0,
      handlersInvoked: 0,
      errors: 0,
      avgProcessingTimeMs: 0,
      deadLetterCount: 0,
      subscriptionCount: this.subscriptions.size,
      eventsByType: {},
      eventsBySource: {},
    };
    this._processingTimes = [];
  }

  // --- Utilities ---

  /**
   * Check if the event bus is running.
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * Get all active subscriptions.
   */
  getSubscriptions(): EventSubscription[] {
    return [...this.subscriptions.values()].filter((s) => s.isActive);
  }

  // --- Private Methods ---

  private createEvent(
    type: string,
    payload: unknown,
    options?: {
      source?: string;
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, unknown>;
      priority?: number;
    }
  ): RuntimeEvent {
    return {
      id: generateEventId(),
      type,
      source: options?.source ?? "unknown",
      timestamp: new Date().toISOString(),
      sequence: ++eventSequence,
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      payload,
      metadata: options?.metadata ?? {},
      priority: options?.priority ?? 0.5,
    };
  }

  private matchesPattern(
    pattern: string | RegExp | ((event: RuntimeEvent) => boolean),
    event: RuntimeEvent
  ): boolean {
    if (typeof pattern === "function") {
      return pattern(event);
    }

    if (pattern instanceof RegExp) {
      return pattern.test(event.type);
    }

    return event.type === pattern;
  }

  private logEvent(event: RuntimeEvent): void {
    const level = event.priority > 0.7 ? "info" : "debug";

    console[level](
      `[${event.timestamp}] ${event.type} (source=${event.source}, correlation=${event.correlationId ?? "none"})`
    );
  }
}

// ============================================================================
// Singleton Event Bus
// ============================================================================

/**
 * Global event bus instance.
 * All subsystems should use this singleton.
 */
let _eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_eventBus) {
    _eventBus = new EventBus();
  }
  return _eventBus;
}

export function initializeEventBus(): EventBus {
  _eventBus = new EventBus();
  return _eventBus;
}

export function shutdownEventBus(): void {
  if (_eventBus) {
    _eventBus.shutdown();
    _eventBus = null;
  }
}