import { EngineeringWorkflowBuilder, WorkGraphEngine } from "./src/runtime/workflow-engine.js";

// Reproduce the failing test case exactly as written
const builder = new EngineeringWorkflowBuilder(
  "FullEngineeringCycle"
);

builder
  .addArchitectTask("arch", [])
  .addWorkerTask("worker", ["arch"])
  .addReviewerTask("reviewer", ["worker"]);

const graph = builder.build().graph;
console.log("Graph nodes:", Array.from(graph.nodes.keys()));
console.log("Graph dependencies:");
for (const [id, node] of graph.nodes.entries()) {
  console.log(`  ${id}: dependencies=[${node.dependencies.join(', ')}]`);
}

const engine = new WorkGraphEngine({ graph });

try {
  const sorted = engine.topologicalSort();
  console.log("Topological sort result:", sorted.map(n => n.id));
} catch (error) {
  console.error("Error in topological sort:", error.message);
}