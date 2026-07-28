import { EngineeringWorkflowBuilder, EngineeringWorkflowType } from "./src/runtime/workflow-engine.js";
import { WorkGraphEngine } from "./src/core/workgraph.js";

// Reproduce the exact test scenario that's failing
const builder = new EngineeringWorkflowBuilder(
  EngineeringWorkflowType.FullEngineeringCycle
);

builder
  .addArchitectTask("arch", [])
  .addWorkerTask("worker", ["arch"])
  .addReviewerTask("reviewer", ["worker"]);

const graph = builder.build().graph;
const engine = new WorkGraphEngine({ graph });

console.log("=== Graph Nodes ===");
for (const [id, node] of graph.nodes.entries()) {
  console.log(`Node ${id}:`);
  console.log(`  Type: ${node.type}`);
  console.log(`  Dependencies: [${node.dependencies.join(', ')}]`);
  console.log(`  State: ${node.state}`);
}

console.log("\n=== Graph Dependents ===");
for (const [id, deps] of graph.dependents.entries()) {
  console.log(`Node ${id} depends on: [${Array.from(deps).join(', ')}]`);
}

console.log("\n=== Testing topological sort ===");
try {
  const sorted = engine.topologicalSort();
  console.log("SUCCESS: Topological sort completed");
  console.log("Sorted nodes:", sorted.map(n => n.id));
} catch (error: any) {
  console.log("ERROR:", error.message);
  
  // Let's also check if there's a cycle
  console.log("\n=== Checking for cycles ===");
  const cycle = engine.detectCycle();
  if (cycle) {
    console.log("CYCLE DETECTED:", cycle);
  } else {
    console.log("No cycle detected by detectCycle()");
  }
}

console.log("\n=== Manual dependency check ===");
// Check the dependencies manually
const archNode = graph.nodes.get("arch")!;
const workerNode = graph.nodes.get("worker")!;
const reviewerNode = graph.nodes.get("reviewer")!;

console.log(`arch.dependencies: [${archNode.dependencies.join(', ')}]`);
console.log(`worker.dependencies: [${workerNode.dependencies.join(', ')}]`);
console.log(`reviewer.dependencies: [${reviewerNode.dependencies.join(', ')}]`);

// What should the dependents be?
console.log("\nExpected dependents mapping:");
console.log("arch dependents (nodes that depend on arch): [worker]");
console.log("worker dependents (nodes that depend on worker): [reviewer]");
console.log("reviewer dependents (nodes that depend on reviewer): []");