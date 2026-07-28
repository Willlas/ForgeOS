// Simple debugging script to understand the graph structure
import { EngineeringWorkflowBuilder, EngineeringWorkflowType } from "./src/runtime/workflow-engine.js";
import { WorkGraphEngine } from "./src/core/workgraph.js";

console.log("=== Creating workflow graph ===");

const builder = new EngineeringWorkflowBuilder(
  EngineeringWorkflowType.FullEngineeringCycle
);

builder
  .addArchitectTask("arch", [])
  .addWorkerTask("worker", ["arch"])
  .addReviewerTask("reviewer", ["worker"]);

const graphDef = builder.build();
const graph = graphDef.graph;

console.log("Nodes:");
for (const [id, node] of graph.nodes.entries()) {
  console.log(`  ${id}: dependencies=[${node.dependencies.join(', ')}]`);
}

console.log("\nDependents map:");
for (const [nodeId, deps] of graph.dependents.entries()) {
  console.log(`  ${nodeId} -> [${Array.from(deps).join(', ')}]`);
}

console.log("\n=== Testing topological sort ===");
const engine = new WorkGraphEngine({ graph });

try {
  const sorted = engine.topologicalSort();
  console.log("SUCCESS: Topological sort returned nodes:", sorted.map(n => n.id));
} catch (error) {
  console.log("ERROR in topological sort:", error.message);
  
  // Manual check of in-degrees
  console.log("\n=== Manual in-degree calculation ===");
  const nodes = Array.from(graph.nodes.values());
  const inDegree = new Map<string, number>();
  
  // Initialize in-degrees to zero
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  
  console.log("Initial in-degrees:", Array.from(inDegree.entries()).map(([id, deg]) => `${id}: ${deg}`));
  
  // Compute in-degrees by counting incoming edges
  for (const node of nodes) {
    console.log(`Checking node ${node.id} dependencies: [${node.dependencies.join(', ')}]`);
    for (const depId of node.dependencies) {
      console.log(`  Dependency ${depId}`);
      if (inDegree.has(depId)) {
        const current = inDegree.get(depId)!;
        inDegree.set(depId, current + 1);
        console.log(`    Incrementing in-degree for ${depId} from ${current} to ${current + 1}`);
      } else {
        console.log(`    ERROR: Dependency ${depId} not found in graph! This is the bug.`);
      }
    }
  }
  
  console.log("Final in-degrees:", Array.from(inDegree.entries()).map(([id, deg]) => `${id}: ${deg}`));
  
  // Check for zero in-degrees
  const zeroInDegree = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      zeroInDegree.push(id);
    }
  }
  console.log("Nodes with zero in-degree:", zeroInDegree);
}