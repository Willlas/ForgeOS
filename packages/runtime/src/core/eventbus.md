# EventBus

Core messaging infrastructure for the Runtime implementing a typed, hierarchical event system with publishing, subscription, filtering, dead letter queue, and performance monitoring.

## Overview

The EventBus is the "nervous system" of the Runtime, enabling all subsystems to communicate through a typed, hierarchical event system. It provides:

- Typed event publishing and subscription
- Event filtering and routing
- Dead letter queue for failed handlers
- Structured logging integration
- Performance monitoring
- Wildcard subscription patterns

## Public API

### Exported interfaces

- **RuntimeEvent**: Structure of a Runtime event with metadata for querying and filtering.
  - `id`: Unique event identifier (UUID)
  - `type`: Event type identifier
  - `source`: Source subsystem that produced this event
  - `timestamp`: Timestamp of event creation (ISO 8601)
  - `sequence`: Monotonic clock sequence for ordering
  - `correlationId`: Correlation ID for cross-event tracing
  - `causationId`: Which event triggered this one
  - `payload`: Event payload data
  - `metadata`: Optional metadata for extension
  - `priority`: Priority level (0-1, 1 = highest)

- **EventSubscription**: Represents a registered event subscription with handler, pattern, filter, and invocation tracking.
  - `id`: Unique subscription identifier
  - `pattern`: Event type pattern to match
  - `handler`: Handler function
  - `filter`: Optional filter for selective processing
  - `priority`: Priority (lower = processed first)
  - `isActive`: Whether this subscription is active
  - `invocationCount`: Number of times this handler has been invoked
  - `unsubscribe()`: Unsubscribe this handler

- **EventBusStats**: Statistics about event bus activity including published events, deliveries, errors, and processing times.
  - `eventsPublished`: Total events published
  - `eventsDelivered`: Total events received by subscribers
  - `handlersInvoked`: Total handler invocations
  - `errors`: Total handler errors
  - `avgProcessingTimeMs`: Average processing time per event (ms)
  - `deadLetterCount`: Events in dead letter queue
  - `subscriptionCount`: Active subscription count
  - `eventsByType`: Events by type
  - `eventsBySource`: Events by source

### Exported types

- **EventHandler**: Handler function type for event listeners.
- **EventFilter**: Filter function for selective event subscription.

### Exported classes

#### EventBus

**Responsibility**: Core event bus handling all inter-subsystem communication with support for typed events, filtering, routing, dead letter queue, and performance monitoring.

**Public methods**:
- `start()`: Starts the event bus.
- `shutdown()`: Stops the event bus and cleans up.
- `publish(type, payload, options)`: Publishes an event to matching subscribers.
- `publishAsync(type, payload, options)`: Publishes an event asynchronously.
- `on(type, handler)`: Subscribes to events by exact type match.
- `subscribe(pattern, handler, options)`: Subscribes to events by pattern match.
- `once(type, handler)`: Subscribes once to a specific event type.
- `off(type)`: Unsubscribes all handlers for a specific type.
- `onWildcard(pattern, handler)`: Subscribes to events matching a wildcard pattern.
- `getDeadLetterQueue()`: Gets events from the dead letter queue.
- `clearDeadLetterQueue()`: Clears the dead letter queue.
- `getStats()`: Gets current event bus statistics.
- `resetStats()`: Resets event bus statistics.
- `isRunning()`: Checks if the event bus is running.
- `getSubscriptions()`: Gets all active subscriptions.

**Constructor**: `EventBus(options?: { maxDeadLetterSize?: number })`

### Exported functions

- `getEventBus()`: Gets the global event bus instance.
- `initializeEventBus()`: Initializes and returns a new event bus instance.
- `shutdownEventBus()`: Shuts down the global event bus instance.

## External dependencies

- "events" (Node.js built-in module)

## Internal dependencies

None

## Notes

- Implements a hierarchical event system with typed events and structured metadata.
- Supports wildcard subscription patterns using glob-style matching (e.g., "worker.*", "scheduler.*").
- Includes dead letter queue for failed event handlers.
- Provides performance monitoring with statistics tracking.
- All subsystems communicate through the EventBus, making it the core messaging infrastructure.

## Implementation Details

### Event ID Generation
Events use a unique ID generator that combines timestamp, random string, and sequence number to ensure uniqueness across the system.

### Pattern Matching
Supports three pattern matching types:
1. Exact string matching
2. Regular expression matching  
3. Function-based filtering

### Priority System
Events and subscriptions support priority levels (0-1) for controlling processing order.

### Dead Letter Queue
Failed event handlers automatically move events to a dead letter queue with configurable size limits.

### Performance Monitoring
Tracks processing times, event counts, error rates, and delivery statistics for monitoring system health.