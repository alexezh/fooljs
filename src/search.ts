import { ARef, AModel, getRefText, createInitialModel, getModelPath, modelToKey } from './token.js';
import { getAllActions } from './actions.js';
import { heuristic } from './weight.js';
import { parseExpression } from './parser.js';
import { isGoal } from './goal.js';

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
// A* Search with AModel
// ============================================================================

export function aStarSearch(startTokens: ARef[]): AModel[] | null {
  const startModel = createInitialModel(startTokens);

  const heap = new MinHeap<AModel>((a, b) => {
    const aTotal = a.approxCost + heuristic(a.tokens);
    const bTotal = b.approxCost + heuristic(b.tokens);
    return aTotal - bTotal;
  });

  heap.push(startModel);

  const visited = new Set<string>();

  while (heap.length > 0) {
    const model = heap.pop()!;

    const stateKey = modelToKey(model);
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);

    if (isGoal(model.tokens)) {
      return getModelPath(model);
    }

    // Get all possible next states using generators
    for (const nextModel of getAllActions(model)) {
      const nextKey = modelToKey(nextModel);
      if (!visited.has(nextKey)) {
        heap.push(nextModel);
      }
    }
  }

  return null;
}

/**
 * Iterator-based search that yields models as they are explored
 */
export function* searchIterator(startTokens: ARef[]): Generator<AModel> {
  const startModel = createInitialModel(startTokens);

  const heap = new MinHeap<AModel>((a, b) => {
    const aTotal = a.approxCost + heuristic(a.tokens);
    const bTotal = b.approxCost + heuristic(b.tokens);
    return aTotal - bTotal;
  });

  heap.push(startModel);

  const visited = new Set<string>();

  while (heap.length > 0) {
    const model = heap.pop()!;

    const stateKey = modelToKey(model);
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);

    // Yield current model being explored
    yield model;

    if (isGoal(model.tokens)) {
      return;
    }

    // Get all possible next states using generators
    for (const nextModel of getAllActions(model)) {
      const nextKey = modelToKey(nextModel);
      if (!visited.has(nextKey)) {
        heap.push(nextModel);
      }
    }
  }
}

// ============================================================================
// Example usage (main)
// ============================================================================

function main(): void {
  const exprStr = '-4 + 3 * 4 + x + y - 3';
  // const exprStr = '4 + 3 * 4';
  const expr = parseExpression(exprStr);
  console.log(`Searching for solution to: ${exprStr}`);
  console.log(`Parsed tokens: ${expr.map(t => getRefText(t)).join(' ')}`);
  console.log('---');

  const result = aStarSearch(expr);

  if (result) {
    console.log('Solution found:');
    for (const model of result) {
      const tokensStr = model.tokens.map(t => getRefText(t)).join(' ');
      console.log(`  [${model.transform}] ${tokensStr} (cost: ${model.approxCost})`);
    }
  } else {
    console.log('No solution found');
  }
}

main();
