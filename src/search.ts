import { AstNode } from "./ast.js";
import { MinHeap } from "./minheap.js";
import { Runtime } from "./runtime.js";

/**
 * Represents a state in the search space
 */
class SearchState {
  node: AstNode;
  parent?: SearchState;
  gCost: number;  // Cost from start
  hCost: number;  // Heuristic (node.getCost())
  fCost: number;  // Total (g + h)

  constructor(node: AstNode, parent?: SearchState, gCost: number = 0) {
    this.node = node;
    this.parent = parent;
    this.gCost = gCost;
    this.hCost = node.getCost();
    this.fCost = this.gCost + this.hCost;
  }

  /**
   * clone parent of node to point to rewrite
   */
  static create(state: SearchState, path: AstNode[], orig: AstNode, rewrite: AstNode, newGCost: number): SearchState {
    for (var idx = path.length - 1; idx >= 0; idx--) {
      let parent = path[idx];
      let children: AstNode[] = [];
      for (let child of parent.children!) {
        if (child === orig) {
          children.push(rewrite);
        } else {
          children.push(child);
        }
      }

      let parentClone = parent.clone(children);
      orig = parent;
      rewrite = parentClone;
    }
    return new SearchState(rewrite, state, newGCost)
  }

  /**
   * Reconstruct the path from start to this state
   */
  getPath(): AstNode[] {
    const path: AstNode[] = [];
    let current: SearchState | undefined = this;

    while (current) {
      path.unshift(current.node);
      current = current.parent;
    }

    return path;
  }

  /**
   * Get a unique key for this state (for visited set)
   */
  getKey(): string {
    return this.node.toString();
  }
}

/**
 * Determines if a node is a goal state (sufficiently simplified)
 */
export function isGoal(node: AstNode): boolean {
  // A node is a goal if it's a simple number
  if (node.kind === 'number') {
    return true;
  }

  // A node is a goal if it's a simple symbol
  if (node.kind === 'symbol') {
    return true;
  }

  // A node is a goal if it's a simple function with no further simplifications possible
  // This is conservative - we could expand this, but for now we consider
  // expressions to not be goals (search will continue trying to simplify)
  return false;
}

class OpenSet {
  public readonly heap = new MinHeap<SearchState>((a: SearchState, b: SearchState) => a.fCost - b.fCost);
  /**
   * our nodes are immutable, so we can use them as keys
   */
  public readonly nodeMap = new WeakMap<AstNode, SearchState>();
  public readonly visited = new Set<string>();

  public get size(): number {
    return this.heap.size;
  }
  public push(st: SearchState): void {
    this.heap.push(st);
  }
  public pop(): SearchState | undefined {
    return this.heap.pop();
  }
}

/**
 * A* search to find optimal simplification path
 *
 * @param start Starting AST node
 * @param runtime Runtime with rewrite rules (defaults to Runtime.instance)
 * @param goalFn Function to determine if node is a goal (defaults to isGoal)
 * @param maxStates Maximum number of states to explore (prevents infinite loops)
 * @returns Path of transformations from start to goal, or null if no path found
 */
export function aStarSearch(
  start: AstNode,
  runtime: Runtime = Runtime.instance,
  goalFn: (node: AstNode) => boolean = isGoal,
  maxStates: number = 10000
): AstNode[] | null {
  // Initialize open set (priority queue) and closed set (visited states)
  const openSet = new OpenSet();

  const startState = new SearchState(start);
  openSet.push(startState);

  let statesExplored = 0;

  const path: AstNode[] = [];

  while (openSet.size > 0 && statesExplored < maxStates) {
    const current = openSet.pop()!;
    const currentKey = current.getKey();

    // Skip if already visited
    if (openSet.visited.has(currentKey)) {
      continue;
    }

    openSet.visited.add(currentKey);
    statesExplored++;

    // Check if we reached the goal
    if (goalFn(current.node)) {
      return current.getPath();
    }

    // Generate successors by applying all matching rules
    getRewrites(current, current.node, path, openSet);
  }

  // No path found
  return null;
}

function getRewrites(state: SearchState, node: AstNode, path: AstNode[], openSet: OpenSet): void {
  if (openSet.nodeMap.has(node)) {
    return;
  }

  const rewriters = Runtime.instance.matchRule(node);
  for (const rewrite of rewriters) {
    const successorKey = rewrite.toString();

    // Skip if already visitedx
    if (openSet.visited.has(successorKey)) {
      continue;
    }

    // Cost to reach this successor is current g-cost + 1 (each rule application costs 1)
    const newGCost = state.gCost + 1;
    const successorState = SearchState.create(state, path, node, rewrite, newGCost);

    openSet.push(successorState);
  }

  if (node.children) {
    for (let child of node.children) {
      path.push(node);
      getRewrites(state, child, path, openSet);
      path.pop();
    }
  }

  openSet.nodeMap.set(node, state);
}

/**
 * Greedy simplification - always takes the lowest-cost successor
 * Faster than A* but may not find optimal solution
 *
 * @param start Starting AST node
 * @param runtime Runtime with rewrite rules (defaults to Runtime.instance)
 * @param maxSteps Maximum number of simplification steps
 * @returns Simplified AST node
 */
export function simplify(
  start: AstNode,
  runtime: Runtime = Runtime.instance,
  maxSteps: number = 100
): AstNode {
  let current = start;
  let currentCost = current.getCost();

  for (let step = 0; step < maxSteps; step++) {
    // Generate all possible successors
    const successors = runtime.matchRule(current);

    // If no successors, we're done
    if (successors.length === 0) {
      break;
    }

    // Find the successor with the lowest cost
    let bestSuccessor = successors[0];
    let bestCost = bestSuccessor.getCost();

    for (let i = 1; i < successors.length; i++) {
      const cost = successors[i].getCost();
      if (cost < bestCost) {
        bestSuccessor = successors[i];
        bestCost = cost;
      }
    }

    // If best successor is not better than current, we're done
    if (bestCost >= currentCost) {
      break;
    }

    // Move to best successor
    current = bestSuccessor;
    currentCost = bestCost;
  }

  return current;
}
