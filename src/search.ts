import { ARef, getRefText, createAref } from './token.js';
import { heuristic } from './weight.js';
import { parseExpression } from './parser.js';
import { isGoal } from './goal.js';
import { getAllActions } from './allactions.js';
import { evaluateDelayedOp } from './actions.js';
import { COST } from './terms.js';
import { AModel, createInitialModel, createModel, getApproxCost, getModelPath, modelToKey } from './model.js';

// ============================================================================
// Priority Queue (Min-Heap) Implementation
// ============================================================================

class MinHeap<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const result = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return result;
  }

  get length(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.compare(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compare(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
// ============================================================================
// Compute delayed operations
// ============================================================================

/**
 * Evaluate a single delayed ref and return a new ref with computed value.
 * Returns null if the ref has no delayed op or can't be computed (e.g., contains variables).
 */
function computeSingleRef(ref: ARef): ARef | null {
  if (!ref.delayedOp) {
    return null;
  }

  // Only compute if result is a digit type (pure numeric)
  if (ref.refType !== 'digit') {
    return null;
  }

  const value = evaluateDelayedOp(ref);
  if (value === null) {
    return null;
  }

  // Create new ref with computed value
  return createAref(String(value), ref.arefs as ARef[], value);
}

/**
 * Compute all delayed refs in a model's tokens.
 * Returns a new model with computed values, or null if nothing was computed.
 */
function computeDelayedRefs(model: AModel): AModel | null {
  let hasComputed = false;
  const newTokens: ARef[] = [];

  for (const token of model.refs) {
    const computed = computeSingleRef(token);
    if (computed) {
      newTokens.push(computed);
      hasComputed = true;
    } else {
      newTokens.push(token);
    }
  }

  if (!hasComputed) {
    return null;
  }

  // Create new model with computed tokens
  // Cost of computation is low since it's just evaluation
  return createModel(model, 'compute', newTokens, COST.ADD_SINGLE_DIGIT);
}

// ============================================================================
// A* Search with AModel
// ============================================================================

export function aStarSearch(startTokens: ARef[]): AModel[] | null {
  const startModel = createInitialModel(startTokens);

  const heap = new MinHeap<AModel>((a, b) => {
    const aTotal = a.approxCost + heuristic(a.refs);
    const bTotal = b.approxCost + heuristic(b.refs);
    return aTotal - bTotal;
  });

  heap.push(startModel);

  const visited = new Set<string>();

  while (heap.length > 0) {
    const endOfChain: AModel[] = [];

    while (heap.length > 0) {
      const model = heap.pop()!;

      const stateKey = modelToKey(model);
      if (visited.has(stateKey)) {
        continue;
      }
      visited.add(stateKey);

      if (isGoal(model.refs)) {
        return getModelPath(model);
      }

      // Get all possible next states using generators
      let isEnd = true;
      for (const nextModel of getAllActions(model)) {
        const nextKey = modelToKey(nextModel);
        if (!visited.has(nextKey)) {
          heap.push(nextModel);
          isEnd = false;
        }
      }

      if (isEnd) {
        endOfChain.push(model)
      }
    }

    // Compute delayed operations for end-of-chain models and continue search
    for (const model of endOfChain) {
      const computedModel = computeDelayedRefs(model);
      if (computedModel) {
        const computedKey = modelToKey(computedModel);
        if (!visited.has(computedKey)) {
          // New state after computation - add to heap for further exploration
          heap.push(computedModel);
        }
        // If already visited, skip - we've seen this computed state before
      }
    }

    endOfChain.length = 0;
  }


  return null;
}

// ============================================================================
// Example usage (main)
// ============================================================================

function main(): void {
  const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';
  const expr = parseExpression(exprStr);
  console.log(`Searching for solution to: ${exprStr}`);
  console.log(`Parsed tokens: ${expr.map(t => getRefText(t)).join(' ')}`);
  console.log('---');

  const result = aStarSearch(expr);

  if (result) {
    console.log('Solution found:');
    for (const model of result) {
      const tokensStr = model.refs.map(t => getRefText(t)).join(' ');
      console.log(`  [${model.transform}] ${tokensStr} (cost: ${model.approxCost})`);
    }
  } else {
    console.log('No solution found');
  }
}

main();
