import { ARef, isVariableRef, getVariableName, getPower, createNumberRef, createSymbolRef } from './token.js';
import { parseExpression } from './parser.js';
import { isGoal } from './goal.js';
import { getAllActions } from './allactions.js';
import { AModel, createInitialModel, createModel, getModelPath, modelToKey } from './model.js';
import { COST } from './terms.js';
import { AModelSymbolCache } from './asymbol.js';

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

export function aStarSearch(startModel: AModel): AModel[] | null {
  const heap = new MinHeap<AModel>((a, b) => {
    const aTotal = a.remainCost;
    const bTotal = b.remainCost;
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

    if (isGoal(model.refs)) {
      return getModelPath(model);
    }

    // Get all possible next states using generators
    for (const actionResult of getAllActions(model)) {
      const { action, model: nextModel, next } = actionResult;
      const nextKey = modelToKey(nextModel);

      if (!visited.has(nextKey)) {
        heap.push(nextModel);

        // Continue getting models from this action while remainCost improves
        let prevRemainCost = nextModel.remainCost;
        for (const furtherModel of next) {
          if (furtherModel.remainCost >= prevRemainCost) {
            break; // Cost is not improving, stop this action
          }

          const furtherKey = modelToKey(furtherModel);
          if (!visited.has(furtherKey)) {
            heap.push(furtherModel);
            prevRemainCost = furtherModel.remainCost;
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Example usage (main)
// ============================================================================

function main(): void {
  const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';

  // Create a temporary model to get the cache
  const cache = new AModelSymbolCache();
  const expr = parseExpression(cache, exprStr);
  const model = new AModel({ transform: "initial", cache: cache, refs: expr })

  console.log(`Searching for solution to: ${exprStr}`);
  console.log(`Parsed tokens: ${expr.map(t => t.symbol).join(' ')}`);
  console.log('---');

  const result = aStarSearch(model);

  if (result) {
    console.log('Solution found:');
    for (const model of result) {
      const tokensStr = model.refs.map(t => t.symbol).join(' ');
      console.log(`  [${model.transform}] ${tokensStr} (cost: ${model.totalApproxCost})`);
    }
  } else {
    console.log('No solution found');
  }
}

main();
