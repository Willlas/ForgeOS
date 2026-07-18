/**
 * Knowledge System - Persistent memory and learning for the Runtime.
 *
 * The Knowledge system provides:
 * - Structured knowledge storage with categories
 * - Query and retrieval engine
 * - Inference and pattern detection
 * - Lessons learned tracking
 * - Architecture decision records (ADRs)
 * - Context-aware recommendations
 *
 * Every completed task should update the Knowledge system.
 * The repository becomes more intelligent over time.
 *
 * @module core/knowledge
 */

// ============================================================================
// Knowledge Types
// ============================================================================

/**
 * A single knowledge item stored in the Runtime.
 */
export interface KnowledgeItem {
  /** Unique identifier */
  id: string;

  /** Type of knowledge */
  type: KnowledgeType;

  /** Title / summary */
  title: string;

  /** Full content */
  content: string;

  /** Metadata tags for filtering */
  tags: string[];

  /** Source subsystem that created this */
  source: string;

  /** Related task or work node ID */
  taskId?: string;

  /** Confidence level (0.0 - 1.0) */
  confidence: number;

  /** Creation timestamp */
  createdAt: string;

  /** Last modified timestamp */
  modifiedAt: string;

  /** How many times this has been accessed */
  accessCount: number;

  /** Whether this knowledge is verified */
  verified: boolean;

  /** Related knowledge item IDs */
  relatedIds: string[];
}

/**
 * Types of knowledge the Runtime supports.
 */
export enum KnowledgeType {
  // Pattern knowledge
  Pattern = "pattern",
  AntiPattern = "anti_pattern",
  
  // Lesson types
  LessonLearned = "lesson_learned",
  BugFix = "bug_fix",
  
  // Architectural knowledge
  ArchitectureDecision = "architecture_decision",
  
  // Domain knowledge
  DomainKnowledge = "domain_knowledge",
  
  // Operational knowledge
  OperationalKnowledge = "operational_knowledge",
  
  // Testing knowledge
  TestPattern = "test_pattern",
  
  // Code knowledge
  CodeSnippet = "code_snippet",
  
  // Configuration knowledge
  ConfigKnowledge = "config_knowledge",
}

/**
 * Knowledge query request.
 */
export interface KnowledgeQuery {
  /** Search term (fuzzy match against content) */
  searchTerm?: string;

  /** Exact type filter */
  type?: KnowledgeType;

  /** Type filters (OR logic) */
  types?: KnowledgeType[];

  /** Tag filters (AND logic - must have ALL tags) */
  tagFilters: string[];

  /** Tag filters (OR logic - must have ANY tag) */
  tagAnyFilters?: string[];

  /** Only verified items */
  verifiedOnly: boolean;

  /** Minimum confidence threshold */
  minConfidence: number;

  /** Sort by field */
  sortBy: "createdAt" | "modifiedAt" | "accessCount" | "confidence";

  /** Sort direction */
  sortOrder: "asc" | "desc";

  /** Maximum results */
  limit: number;

  /** Offset for pagination */
  offset: number;
}

/**
 * Knowledge query result.
 */
export interface KnowledgeQueryResult {
  /** Matching items */
  items: KnowledgeItem[];

  /** Total count of matches (before limit) */
  totalCount: number;

  /** Time taken to execute the query (ms) */
  queryTimeMs: number;

  /** Suggested refinements */
  suggestions: string[];
}

// ============================================================================
// Knowledge Graph
// ============================================================================

/**
 * A node in the knowledge graph.
 */
export interface KnowledgeGraphNode {
  /** Node identifier (references a KnowledgeItem.id) */
  itemId: string;

  /** Display label */
  label: string;

  /** Visual type for rendering */
  visualType: "pattern" | "lesson" | "decision" | "bug" | "code";

  /** Group / cluster ID */
  groupId: string;
}

/**
 * An edge in the knowledge graph.
 */
export interface KnowledgeGraphEdge {
  /** Source node ID */
  sourceId: string;

  /** Target node ID */
  targetId: string;

  /** Edge type / relationship */
  relationType: "depends_on" | "related_to" | "contradicts" | "extends" | "fixes";

  /** Edge weight (strength of relationship) */
  weight: number;
}

/**
 * The knowledge graph structure.
 */
export interface KnowledgeGraph {
  version: number;
  lastUpdated: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/**
 * Current knowledge graph version.
 */
const KNOWLEDGE_GRAPH_VERSION = 1;

// ============================================================================
// Lessons Learned
// ============================================================================

/**
 * A captured lesson from completed work.
 */
export interface LessonLearned {
  /** Associated knowledge item ID */
  knowledgeId: string;

  /** What happened */
  description: string;

  /** What was learned */
  insight: string;

  /** How to apply this in the future */
  application: string;

  /** When should this lesson be checked */
  triggerConditions: string[];

  /** Category of the lesson */
  category: "architecture" | "code" | "process" | "testing" | "operations";

  /** Severity / importance (1-5) */
  importance: number;

  /** Status */
  status: "active" | "archived" | "superseded";

  /** Created timestamp */
  createdAt: string;
}

// ============================================================================
// Knowledge Storage Backend
// ============================================================================

/**
 * Interface for persistent knowledge storage backends.
 */
export interface IKnowledgeStore {
  /** Store a knowledge item */
  save(item: KnowledgeItem): Promise<void>;

  /** Retrieve a knowledge item by ID */
  get(id: string): Promise<KnowledgeItem | null>;

  /** Update a knowledge item */
  update(id: string, updates: Partial<KnowledgeItem>): Promise<boolean>;

  /** Delete a knowledge item */
  delete(id: string): Promise<boolean>;

  /** List all items matching criteria */
  list(query: KnowledgeQuery): Promise<KnowledgeQueryResult>;

  /** Search across all content */
  search(term: string): Promise<KnowledgeItem[]>;

  /** Get the knowledge graph */
  getGraph(): Promise<KnowledgeGraph>;

  /** Health check */
  healthCheck(): Promise<boolean>;

  /** Initialize the store */
  initialize(): Promise<void>;

  /** Shutdown the store */
  shutdown(): Promise<void>;

  /** Save a lesson learned */
  saveLesson(lesson: LessonLearned): Promise<void>;

  /** List lessons optionally filtered by category */
  listLessons(category?: LessonLearned["category"]): Promise<LessonLearned[]>;

  /** Get statistics (only available on InMemoryKnowledgeStore) */
  getStatistics?(): unknown;
}

// ============================================================================
// In-Memory Knowledge Store
// ============================================================================

/**
 * Default in-memory knowledge store implementation.
 * For production, implement a persistent backend (SQLite, IndexedDB).
 */
export class InMemoryKnowledgeStore implements IKnowledgeStore {
  private items: Map<string, KnowledgeItem>;
  private lessons: Map<string, LessonLearned>;
  private graph: KnowledgeGraph;
  private isInitialized: boolean;

  constructor() {
    this.items = new Map();
    this.lessons = new Map();
    this.graph = {
      version: KNOWLEDGE_GRAPH_VERSION,
      lastUpdated: new Date().toISOString(),
      nodes: [],
      edges: [],
    };
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
  }

  async save(item: KnowledgeItem): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Knowledge store not initialized");
    }

    const now = new Date().toISOString();
    
    const existing = this.items.get(item.id);
    if (existing) {
      item.modifiedAt = now;
      item.accessCount = existing.accessCount;
      this.items.set(item.id, item);
    } else {
      item.createdAt = now;
      item.modifiedAt = now;
      this.items.set(item.id, item);
    }

    // Update graph
    this.updateGraph();
  }

  async get(id: string): Promise<KnowledgeItem | null> {
    const item = this.items.get(id);
    if (item) {
      item.accessCount++;
    }
    return item ?? null;
  }

  async update(id: string, updates: Partial<KnowledgeItem>): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    Object.assign(item, updates, { modifiedAt: new Date().toISOString() });
    this.updateGraph();
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.items.delete(id);
    if (deleted) this.updateGraph();
    return deleted;
  }

  async list(query: KnowledgeQuery): Promise<KnowledgeQueryResult> {
    const startTime = performance.now();
    
    let results = [...this.items.values()];

    // Filter by type(s)
    if (query.type) {
      results = results.filter((i) => i.type === query.type);
    }
    if (query.types && query.types.length > 0) {
      results = results.filter((i) => query.types!.includes(i.type));
    }

    // Filter by tags (AND logic)
    if (query.tagFilters.length > 0) {
      results = results.filter((i) =>
        query.tagFilters.every((tag) => i.tags.includes(tag))
      );
    }

    // Filter by tags (OR logic)
    if (query.tagAnyFilters && query.tagAnyFilters.length > 0) {
      results = results.filter((i) =>
        query.tagAnyFilters!.some((tag) => i.tags.includes(tag))
      );
    }

    // Verified only filter
    if (query.verifiedOnly) {
      results = results.filter((i) => i.verified);
    }

    // Confidence filter
    if (query.minConfidence > 0) {
      results = results.filter((i) => i.confidence >= query.minConfidence);
    }

    // Search term filter
    if (query.searchTerm) {
      const lower = query.searchTerm.toLowerCase();
      results = results.filter(
        (i) =>
          i.title.toLowerCase().includes(lower) ||
          i.content.toLowerCase().includes(lower) ||
          i.tags.some((t) => t.toLowerCase().includes(lower))
      );
    }

    // Sort
    const sortByField = query.sortBy ?? "modifiedAt";
    const sortOrder = query.sortOrder ?? "desc";
    results.sort((a, b) => {
      const aVal = (a as any)[sortByField];
      const bVal = (b as any)[sortByField];
      return sortOrder === "desc" ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });

    // Total count before limit
    const totalCount = results.length;

    // Apply pagination
    results = results.slice(query.offset, query.offset + query.limit);

    const queryTime = performance.now() - startTime;

    return {
      items: results,
      totalCount,
      queryTimeMs: Math.round(queryTime * 100) / 100,
      suggestions: this.generateSuggestions(query, results),
    };
  }

  async search(term: string): Promise<KnowledgeItem[]> {
    const lower = term.toLowerCase();
    return [...this.items.values()].filter(
      (i) =>
        i.title.toLowerCase().includes(lower) ||
        i.content.toLowerCase().includes(lower) ||
        i.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  async getGraph(): Promise<KnowledgeGraph> {
    return this.graph;
  }

  async healthCheck(): Promise<boolean> {
    return this.isInitialized && this.items.size > 0;
  }

  // --- Graph Management ---

  private updateGraph(): void {
    this.graph.nodes = [...this.items.values()].map((item) => ({
      itemId: item.id,
      label: item.title.substring(0, 50),
      visualType: this.itemToVisualType(item.type),
      groupId: item.type,
    }));

    this.graph.edges = [];
    for (const item of this.items.values()) {
      for (const relatedId of item.relatedIds) {
        const target = this.items.get(relatedId);
        if (target) {
          this.graph.edges.push({
            sourceId: item.id,
            targetId: relatedId,
            relationType: "related_to",
            weight: 1.0,
          });
        }
      }
    }

    this.graph.lastUpdated = new Date().toISOString();
  }

  private itemToVisualType(type: KnowledgeType): KnowledgeGraphNode["visualType"] {
    switch (type) {
      case KnowledgeType.Pattern:
        return "pattern";
      case KnowledgeType.AntiPattern:
        return "pattern";
      case KnowledgeType.LessonLearned:
      case KnowledgeType.BugFix:
        return "lesson";
      case KnowledgeType.ArchitectureDecision:
        return "decision";
      case KnowledgeType.CodeSnippet:
        return "code";
      default:
        return "pattern";
    }
  }

  private generateSuggestions(query: KnowledgeQuery, results: KnowledgeItem[]): string[] {
    const suggestions: string[] = [];

    if (query.searchTerm && results.length === 0) {
      suggestions.push(`Try broader search terms for "${query.searchTerm}"`);
    }

    if (query.tagFilters.length > 5) {
      suggestions.push("Try reducing tag filters for more results");
    }

    if (query.verifiedOnly && results.length === 0) {
      suggestions.push("Try removing verifiedOnly filter");
    }

    if (query.minConfidence > 0.9 && results.length === 0) {
      suggestions.push("Try lowering minConfidence threshold");
    }

    return suggestions;
  }

  // --- Lessons Learned ---

  async saveLesson(lesson: LessonLearned): Promise<void> {
    this.lessons.set(lesson.knowledgeId, lesson);
  }

  async getLesson(knowledgeId: string): Promise<LessonLearned | null> {
    return this.lessons.get(knowledgeId) ?? null;
  }

  async listLessons(category?: LessonLearned["category"]): Promise<LessonLearned[]> {
    let lessons = [...this.lessons.values()];
    
    if (category) {
      lessons = lessons.filter((l) => l.category === category);
    }

    return lessons.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // --- Statistics ---

  getStatistics(): {
    totalItems: number;
    itemsByType: Record<string, number>;
    totalLessons: number;
    lessonsByCategory: Record<string, number>;
    verifiedCount: number;
    averageConfidence: number;
  } {
    const itemsByType: Record<string, number> = {};
    let totalConfidence = 0;
    let verifiedCount = 0;

    for (const item of this.items.values()) {
      itemsByType[item.type] = (itemsByType[item.type] ?? 0) + 1;
      totalConfidence += item.confidence;
      if (item.verified) verifiedCount++;
    }

    const lessonsByCategory: Record<string, number> = {};
    for (const lesson of this.lessons.values()) {
      lessonsByCategory[lesson.category] = (lessonsByCategory[lesson.category] ?? 0) + 1;
    }

    return {
      totalItems: this.items.size,
      itemsByType,
      totalLessons: this.lessons.size,
      lessonsByCategory,
      verifiedCount,
      averageConfidence: this.items.size > 0
        ? totalConfidence / this.items.size
        : 0,
    };
  }

  reset(): void {
    this.items.clear();
    this.lessons.clear();
    this.graph = {
      version: KNOWLEDGE_GRAPH_VERSION,
      lastUpdated: new Date().toISOString(),
      nodes: [],
      edges: [],
    };
  }
}

// ============================================================================
// Knowledge Manager
// ============================================================================

/**
 * High-level knowledge management API.
 * Wraps the storage backend and provides common operations.
 */
export class KnowledgeManager {
  private store: IKnowledgeStore;
  private isInitialized: boolean;

  constructor(store?: IKnowledgeStore) {
    this.store = store ?? new InMemoryKnowledgeStore();
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    this.isInitialized = true;
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
    await this.store.shutdown();
  }

  async save(item: KnowledgeItem): Promise<void> {
    await this.store.save(item);
  }

  async get(id: string): Promise<KnowledgeItem | null> {
    return this.store.get(id);
  }

  async update(id: string, updates: Partial<KnowledgeItem>): Promise<boolean> {
    return this.store.update(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async query(query: KnowledgeQuery): Promise<KnowledgeQueryResult> {
    if (!this.isInitialized) {
      throw new Error("Knowledge manager not initialized");
    }
    return this.store.list(query);
  }

  async search(term: string): Promise<KnowledgeItem[]> {
    if (!this.isInitialized) {
      throw new Error("Knowledge manager not initialized");
    }
    return this.store.search(term);
  }

  async getGraph(): Promise<KnowledgeGraph> {
    return this.store.getGraph();
  }

  async addLesson(lesson: LessonLearned): Promise<void> {
    await this.store.saveLesson(lesson);
  }

  async getLessons(category?: LessonLearned["category"]): Promise<LessonLearned[]> {
    return this.store.listLessons(category);
  }

  async getStatistics(): Promise<{
    totalItems: number;
    itemsByType: Record<string, number>;
    totalLessons: number;
    lessonsByCategory: Record<string, number>;
    verifiedCount: number;
    averageConfidence: number;
  }> {
    if ("getStatistics" in this.store && typeof (this.store as any).getStatistics === "function") {
      return (this.store as InMemoryKnowledgeStore).getStatistics();
    }
    return {
      totalItems: 0,
      itemsByType: {},
      totalLessons: 0,
      lessonsByCategory: {},
      verifiedCount: 0,
      averageConfidence: 0,
    };
  }

  isInitializedFlag(): boolean {
    return this.isInitialized;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new knowledge item.
 */
export function createKnowledgeItem(params: Omit<KnowledgeItem, "id" | "createdAt" | "modifiedAt" | "accessCount" | "relatedIds">): KnowledgeItem {
  const now = new Date().toISOString();
  return {
    ...params,
    id: `knowledge-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    createdAt: now,
    modifiedAt: now,
    accessCount: 0,
    relatedIds: [],
  };
}

/**
 * Create a default knowledge manager with in-memory store.
 */
export function createKnowledgeManager(): KnowledgeManager {
  return new KnowledgeManager(new InMemoryKnowledgeStore());
}