
import { applyCancel, applyCleanup, applyParenthesis } from "./actions.js";
import { applyDiv } from "./applyDiv.js";
import { applyMul } from "./applyMul.js";
import { applySum } from "./applySum.js";
import { AModel } from "./model.js";

export type ActionGenerator = (model: AModel) => Generator<AModel>;

export interface ActionEntry {
  name: string;
  fn: ActionGenerator;
}

export const ALL_ACTIONS: ActionEntry[] = [
  { name: 'sum', fn: applySum },
  { name: 'mul', fn: applyMul },
  { name: 'div', fn: applyDiv },
  { name: 'cancel', fn: applyCancel },
  { name: 'cleanup', fn: applyCleanup },
  { name: 'parenthesis', fn: applyParenthesis }
];

/**
 * Entry in the merge heap: holds current model, its source iterator, and action name
 */
interface MergeEntry {
  action: string;
  model: AModel;
  iterator: Generator<AModel>;
}

/**
 * Min-heap for merging sorted iterators by cost
 */
class MergeHeap {
  private heap: MergeEntry[] = [];

  push(entry: MergeEntry): void {
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): MergeEntry | undefined {
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
      if (this.heap[index].model.totalApproxCost >= this.heap[parentIndex].model.totalApproxCost) break;
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

      if (leftChild < length && this.heap[leftChild].model.totalApproxCost < this.heap[smallest].model.totalApproxCost) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].model.totalApproxCost < this.heap[smallest].model.totalApproxCost) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * Get all possible next states from current model, merged and sorted by cost.
 * Assumes each individual action generator yields models sorted by cost (lowest first).
 * Uses k-way merge to yield globally sorted results across all action types.
 */
export function* getAllActions(model: AModel): Generator<{ action: string, model: AModel, next: Generator<AModel> }> {

  const mergeHeap = new MergeHeap();

  // Initialize heap with first element from each action generator
  for (const actionEntry of ALL_ACTIONS) {
    const iterator = actionEntry.fn(model);
    const first = iterator.next();
    if (!first.done) {
      mergeHeap.push({ action: actionEntry.name, model: first.value, iterator });
    }
  }

  // K-way merge: always yield the lowest cost model with its action name and generator
  while (mergeHeap.length > 0) {
    const entry = mergeHeap.pop()!;
    yield {
      action: entry.action,
      model: entry.model,
      next: entry.iterator
    };

    // Get next model from the same iterator and add back to heap
    const next = entry.iterator.next();
    if (!next.done) {
      mergeHeap.push({ action: entry.action, model: next.value, iterator: entry.iterator });
    }
  }
}
