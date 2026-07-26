# ForgeOS Runtime Documentation

The ForgeOS runtime provides the core orchestration capabilities for autonomous engineering workflows. It manages the execution lifecycle of tasks through a sophisticated system of dispatchers, workers, and workflow engines that work together to implement complex engineering processes.

## Core Components

### 1. Dispatcher System

The `Dispatcher` is the central component responsible for task routing and execution management. It works with:

- **Worker Registry**: Tracks available workers
- **Task Router**: Manages task routing decisions
- **Retry Engine**: Implements retry policies for failed tasks
- **Metrics Collector**: Monitors system performance
- **Health Monitoring**: Tracks worker health status

#### Key Features:
- Load balancing across workers using configurable strategies (RoundRobin, LeastLoaded)
- Automatic task retry with exponential backoff
- Failure propagation between dependent tasks
- Task timeout management
- Worker health monitoring and auto-recovery

### 2. Execution Engine

The `ExecutionEngine` serves as the top-level orchestrator that manages workflow execution state:

#### Key Features:
- Workflow submission and execution
- Checkpoint persistence for recovery
- State management (initializing, running, pausing, etc.)
- Event-driven architecture with lifecycle notifications
- Integration with Dispatcher and WorkerPool systems

### 3. Worker Runtime System

The `WorkerRuntime` provides lifecycle management for individual workers:

#### Key Features:
- Heartbeat monitoring and watchdog detection
- Capacity tracking and load distribution
- State transitions (online, degraded, offline)
- Task execution metrics collection
- Automatic recovery mechanisms

### 4. Workflow Engine

The `WorkflowEngine` orchestrates engineering workflows using WorkGraphs:

#### Key Features:
- DAG-based workflow execution with topological sorting
- Engineering workflow definitions (Architect->Worker, Worker->Reviewer)
- Task decomposition and assignment to agents by role
- Automatic retries and failure recovery
- Checkpoint and resume support
- Workflow metrics collection

## Architecture Overview

```
[Application] → [ExecutionEngine] → [Dispatcher] → [WorkerPool] → [WorkerRuntime]
                             ↓
                        [WorkflowEngine] → [WorkGraph]
                             ↓
                        [AgentTeam] → [Agents]
```

## Usage Patterns

### Basic Setup

```javascript
// Create dispatcher with default configuration
const dispatcher = createDispatcher();

// Start the dispatcher
await dispatcher.start();

// Register workers
dispatcher.registerWorker(workerId, workerInstance);

// Submit a task
const taskId = dispatcher.submitTask({
  type: "code_generation",
  payload: { prompt: "Implement a sorting algorithm" }
});

// Monitor task completion
dispatcher.on("task_completed", (data) => {
  console.log(`Task ${data.taskId} completed`);
});
```

### Workflow Execution

```javascript
// Create workflow engine
const workflowEngine = new WorkflowEngine();

// Create standard workflow
const workflowId = workflowEngine.submitStandardWorkflow(
  EngineeringWorkflowType.ArchitectToWorker
);

// Execute the workflow
await workflowEngine.executeWorkflow(workflowId);
```

### Worker Management

```javascript
// Create worker pool
const workerPool = new WorkerPool({ name: "default-pool" });

// Add workers to pool
workerPool.add("worker-1", workerRuntime1);
workerPool.add("worker-2", workerRuntime2);

// Start all workers
await workerPool.startAll();
```

## Configuration Options

### Dispatcher Configuration

```typescript
interface DispatcherConfig {
  name?: string;
  metricsEnabled?: boolean;
  logLevel?: LogLevel;
  loadBalancingStrategy?: LoadBalancingStrategy;
  taskTimeoutMs?: number;
  workerHealthCheckIntervalMs?: number;
  failurePropagation?: FailurePropagationMode;
  cancellationPropagation?: boolean;
}
```

### Execution Engine Configuration

```typescript
interface ExecutionEngineConfig {
  name?: string;
  checkpointEnabled?: boolean;
  checkpointIntervalMs?: number;
  maxRetries?: number;
  taskTimeoutMs?: number;
  autoRecovery?: boolean;
}
```

## Event System

The runtime emits various events to enable monitoring and integration:

### Dispatcher Events
- `task_completed`: Task finished successfully
- `task_failed`: Task failed with error
- `task_cancelled`: Task was cancelled
- `worker_health_changed`: Worker health status changed
- `retry_policy_applied`: Retry policy updated

### Engine Events
- `engine:starting`: Engine initialization begins
- `engine:started`: Engine successfully started
- `engine:stopping`: Engine shutdown begins
- `engine:stopped`: Engine stopped
- `workflow_submitted`: New workflow submitted
- `workflow_completed`: Workflow finished execution

## Health Monitoring

The system provides comprehensive health status through:

```typescript
interface DispatcherHealth {
  healthy: boolean;
  state: string;
  uptimeMs: number;
  startedAt: string;
  components: Record<string, boolean>;
  workers: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  tasks: {
    dispatched: number;
    completed: number;
    failed: number;
    pending: number;
  };
  errors: string[];
}
```

## Metrics Collection

Built-in metrics include:
- Task execution counters (dispatched, completed, failed, cancelled)
- Worker health status
- Task duration statistics
- Retry counts
- System uptime and performance indicators

## Error Handling and Recovery

### Automatic Retry Mechanisms
The system implements configurable retry policies with exponential backoff to handle transient failures.

### Checkpointing
Workflows can be checkpointed for recovery after interruptions.

### Health Checks
Workers are monitored via periodic heartbeats with automatic detection of dead workers.

### Failure Propagation
Failed tasks can propagate their failure to dependent tasks based on configuration.

## Best Practices

1. **Configuration Management**: Always configure timeouts, retry policies, and health check intervals appropriately for your workload
2. **Monitoring**: Implement event listeners for critical events like task failures or worker health changes
3. **Checkpointing**: Enable checkpointing for long-running workflows to support recovery
4. **Resource Management**: Monitor worker capacity and handle scaling appropriately
5. **Error Logging**: Use the built-in logging system to track execution issues

## Integration Points

### With Agent Teams
The runtime integrates with agent teams through:
- Shared context management
- Task assignment based on agent capabilities
- Communication through the event bus

### With WorkGraph System
Workflow execution is orchestrated using WorkGraphs which provide:
- DAG structure for task dependencies
- Topological sorting for execution order
- Node metadata and attributes
- Execution state tracking

This runtime system enables the creation of autonomous engineering systems capable of complex multi-agent workflows while maintaining robustness through comprehensive error handling, monitoring, and recovery mechanisms.