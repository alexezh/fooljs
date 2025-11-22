
import { applyCancel, applyCleanup, applyDiv, applyMul, applyParenthesis, applySubToAdd } from "./actions.js";
import { applySum } from "./applySum.js";
import { AModel } from "./token.js";

export type ActionGenerator = (model: AModel) => Generator<AModel>;

export const ALL_ACTIONS: ActionGenerator[] = [
  applySum,
  applyMul,
  applyDiv,
  applyCancel,
  applyCleanup,
  applySubToAdd,
  applyParenthesis
];

/**
 * Entry in the merge heap: holds current model and its source iterator
 */
interface MergeEntry {
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
      if (this.heap[index].model.approxCost >= this.heap[parentIndex].model.approxCost) break;
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

      if (leftChild < length && this.heap[leftChild].model.approxCost < this.heap[smallest].model.approxCost) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].model.approxCost < this.heap[smallest].model.approxCost) {
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
export function* getAllActions(model: AModel): Generator<AModel> {
  const mergeHeap = new MergeHeap();

  // Initialize heap with first element from each action generator
  for (const actionFn of ALL_ACTIONS) {
    const iterator = actionFn(model);
    const first = iterator.next();
    if (!first.done) {
      mergeHeap.push({ model: first.value, iterator });
    }
  }

  // K-way merge: always yield the lowest cost model, then pull next from its source
  while (mergeHeap.length > 0) {
    const entry = mergeHeap.pop()!;
    yield entry.model;

    // Get next model from the same iterator
    const next = entry.iterator.next();
    if (!next.done) {
      mergeHeap.push({ model: next.value, iterator: entry.iterator });
    }
  }
}
