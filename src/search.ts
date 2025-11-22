import { ARef } from './token.js';
import {
  Action,
  applySum,
  applyMul,
  applyDiv,
  applyCancel,
  applyCleanup,
  applySubToAdd,
  applyParenthesis,
  executeAction
} from './actions.js';
import { heuristic } from './weight.js';
import { parseExpression } from './parser.js';

// ============================================================================
// Types
// ============================================================================

type ActionFunc = (tokens: ARef[]) => Action[] | ARef[] | null;

interface HeapEntry {
  estimatedTotal: number;
  cost: number;
  tokens: ARef[];
  path: ARef[][];
}

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
// Helper functions
// ============================================================================

function getRefText(ref: ARef): string {
  return ref.token.text;
}

function tokensToKey(tokens: ARef[]): string {
  return tokens.map(t => getRefText(t)).join('|');
}

// TODO: implement in goal.ts
function isGoal(tokens: ARef[]): boolean {
  // Placeholder - implement actual goal checking logic
  // A goal might be a simplified expression like a single number or "ax + b" form
  return tokens.length === 1;
}

function isAction(item: unknown): item is Action {
  return (
    typeof item === 'object' &&
    item !== null &&
    'cost' in item &&
    'name' in item &&
    'actionType' in item &&
    'actionInfo' in item
  );
}

// ============================================================================
// Actions list
// ============================================================================

const ACTIONS: ActionFunc[] = [
  applySum,
  applyMul,
  applyDiv,
  applyCancel,
  applyCleanup,
  applySubToAdd,
  applyParenthesis
];

// ============================================================================
// A* Search
// ============================================================================

export function aStarSearch(startTokens: ARef[]): ARef[][] | null {
  const heap = new MinHeap<HeapEntry>((a, b) => a.estimatedTotal - b.estimatedTotal);

  heap.push({
    estimatedTotal: heuristic(startTokens),
    cost: 0,
    tokens: startTokens,
    path: []
  });

  const visited = new Set<string>();

  while (heap.length > 0) {
    const entry = heap.pop()!;
    const { cost, tokens, path } = entry;

    const stateKey = tokensToKey(tokens);
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);

    if (isGoal(tokens)) {
      return [...path, tokens];
    }

    for (const actionFunc of ACTIONS) {
      const result = actionFunc(tokens);

      // Handle different action return types
      if (result === null) {
        // No actions available from this function
        continue;
      }

      if (Array.isArray(result)) {
        if (result.length === 0) {
          // Empty action list
          continue;
        }

        // Check if it's a list of Action objects
        if (isAction(result[0])) {
          // It's a list of action tuples - execute each action
          for (const action of result as Action[]) {
            try {
              const newTokens = executeAction(action);
              const newKey = tokensToKey(newTokens);
              if (newTokens && !visited.has(newKey)) {
                const newCost = cost + action.cost;
                heap.push({
                  estimatedTotal: newCost + heuristic(newTokens),
                  cost: newCost,
                  tokens: newTokens,
                  path: [...path, tokens]
                });
              }
            } catch {
              // Skip actions that fail to execute
              continue;
            }
          }
        } else {
          // It's a list of tokens (old format) - treat as single action with cost 1
          const newTokens = result as ARef[];
          const newKey = tokensToKey(newTokens);
          if (newTokens && !visited.has(newKey)) {
            const newCost = cost + 1;
            heap.push({
              estimatedTotal: newCost + heuristic(newTokens),
              cost: newCost,
              tokens: newTokens,
              path: [...path, tokens]
            });
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
  // const exprStr = "-4 + 3 * 4 + x + y - 3";
  const exprStr = '4 + 3 * 4';
  const expr = parseExpression(exprStr);
  const result = aStarSearch(expr);

  if (result) {
    for (const step of result) {
      console.log(step.map(t => getRefText(t)).join(' '));
    }
  } else {
    console.log('No solution found');
  }
}

main();
