import { AstNode } from "./ast.js";
import { MinHeap } from "./minheap.js";
import { Runtime } from "./runtime.js";
import { SearchState } from "./tests/searchstate.js";

export function getSolutionString(st: SearchState): string {
  let path = st.getPath();
  return path.map(x => x.toString()).join(";");
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
): SearchState | null {
  // Initialize open set (priority queue) and closed set (visited states)
  const openSet = new OpenSet();

  const startState = new SearchState(undefined, start);
  openSet.push(startState);

  let statesExplored = 0;

  const path: AstNode[] = [];

  while (openSet.size > 0 && statesExplored < maxStates) {
    const current = openSet.pop()!;
    const currentKey = current.getKey();
    console.log(current.debugStr);

    // Skip if already visited
    if (openSet.visited.has(currentKey)) {
      continue;
    }

    openSet.visited.add(currentKey);
    statesExplored++;

    // Check if we reached the goal
    if (goalFn(current.node)) {
      return current;
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

  const stateManager = Runtime.instance.getStateManager();

  // find all rules which match
  const rewriters = Runtime.instance.matchRule(node);
  for (const rewrite of rewriters) {
    const successorKey = rewrite.toString();

    // Skip if already visitedx
    if (openSet.visited.has(successorKey)) {
      continue;
    }

    // Compute state-based score for this (node, rule) pair
    // Higher weights indicate better transitions
    const ruleDef = rewrite.ruleDef ?? '';
    const stateScore = stateManager.scoreRule(node, ruleDef);

    // Create successor state with state-based score adjustment
    // Negative score means "prefer this", so we subtract it from cost
    const successorState = SearchState.create(state, path, node, rewrite, -stateScore);

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

