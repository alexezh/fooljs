import { ARef, getRefText, createDelayedRef, DelayedOp, isVariableRef, getVariableName, getPower, createAref } from './token.js';
import { parseExpression } from './parser.js';
import { isGoal } from './goal.js';
import { getAllActions } from './allactions.js';
import { AModel, createInitialModel, createModel, getModelPath, modelToKey } from './model.js';
import { COST } from './terms.js';

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
 * Execute a model's delayed operation if present.
 * Updates the refs at the specified indexes within the parent or root.
 * Returns a new model with the operation executed, or null if no delayed op.
 */
function executeDelayedOp(model: AModel): AModel | null {
  if (!model.delayedOp) {
    return null;
  }

  const modelDelayedOp = model.delayedOp;

  // If compute function is provided, use it
  if (modelDelayedOp.compute) {
    return modelDelayedOp.compute(model, modelDelayedOp.operation);
  }

  // Fallback: manual execution for operations without compute function
  const targetRefs = modelDelayedOp.parentRef ? modelDelayedOp.parentRef.arefs as ARef[] : model.refs;

  // Execute based on operation kind
  switch (modelDelayedOp.kind) {
    case 'add':
    case 'sub': {
      // Get the operation data (TermPair)
      const pair = modelDelayedOp.operation;
      const [iPos, jPos] = modelDelayedOp.indexes;

      const refA = targetRefs[iPos];
      const refB = targetRefs[jPos];

      // Determine operation by checking operator before refB
      const opBeforeB = jPos > 0 && targetRefs[jPos - 1].refType === 'op' ? targetRefs[jPos - 1] : null;
      const effectiveOp = (opBeforeB && getRefText(opBeforeB) === '-') ? '-' : '+';

      let resultText: string;
      let refDelayedOp: DelayedOp;

      // Case 1: Both are numbers
      if (refA.refType === 'number' && refB.refType === 'number') {
        refDelayedOp = effectiveOp === '+'
          ? { kind: 'add', left: refA, right: refB }
          : { kind: 'sub', left: refA, right: refB };
        resultText = `(${getRefText(refA)}${effectiveOp}${getRefText(refB)})`;
      }
      // Case 2: Both are variables
      else if (isVariableRef(refA) && isVariableRef(refB)) {
        const aVarName = getVariableName(refA)!;
        const aPower = getPower(refA);

        if (effectiveOp === '+') {
          refDelayedOp = { kind: 'combine', terms: [refA, refB], op: '+' };
          const powerStr = aPower !== 1 ? `^${aPower}` : '';
          resultText = `(2*${aVarName}${powerStr})`;
        } else {
          refDelayedOp = { kind: 'sub', left: refA, right: refB };
          resultText = '0';
        }
      }
      // Case 3: Expressions
      else {
        const aText = getRefText(refA);
        const bText = getRefText(refB);

        if (effectiveOp === '+') {
          refDelayedOp = { kind: 'add', left: refA, right: refB };
          resultText = `(${aText}+${bText})`;
        } else {
          refDelayedOp = { kind: 'sub', left: refA, right: refB };
          resultText = aText === bText ? '0' : `(${aText}-${bText})`;
        }
      }

      // Try to compute the value immediately if both operands are numeric
      let resultRef: ARef;
      let computedValue: number | null = null;

      if (refA.refType === 'number' && refB.refType === 'number') {
        // Both are numbers - compute directly
        const aVal = refA.value as number;
        const bVal = refB.value as number;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          computedValue = effectiveOp === '+' ? aVal + bVal : aVal - bVal;
        }
      }

      if (computedValue !== null) {
        // We computed a numeric value - create a digit ref with the value
        resultRef = createAref(String(computedValue), [refA, refB], computedValue);
        resultRef.refType = 'number';
      } else if (isVariableRef(refA) && isVariableRef(refB) && getVariableName(refA) === getVariableName(refB)) {
        const varName = getVariableName(refA)!;
        const power = getPower(refA);

        if (effectiveOp === '-') {
          // Variables cancelled out (x - x = 0)
          resultRef = createAref('0', [refA, refB], 0);
          resultRef.refType = 'number';
        } else {
          // Variables combined (x + x = 2x)
          const powerStr = power !== 1 ? `^${power}` : '';
          resultRef = createDelayedRef(`(2*${varName}${powerStr})`, [refA, refB], refDelayedOp);
          resultRef.refType = 'expr';  // 2x is an expression
          resultRef.variables = [varName];
        }
      } else if (refA.refType === 'expr' && refB.refType === 'expr' && getRefText(refA) === getRefText(refB)) {
        // Identical expressions
        if (effectiveOp === '-') {
          // Expressions cancelled out (expr - expr = 0)
          resultRef = createAref('0', [refA, refB], 0);
          resultRef.refType = 'number';
        } else {
          // Expressions combined (expr + expr = 2*expr)
          resultRef = createDelayedRef(resultText, [refA, refB], refDelayedOp);
          resultRef.refType = 'expr';
          if (refA.variables) {
            resultRef.variables = refA.variables;
          }
        }
      } else {
        // Create delayed ref for later evaluation
        resultRef = createDelayedRef(resultText, [refA, refB], refDelayedOp);
      }

      resultRef.role = 'term';

      // Build new refs array
      const opIndexBeforeB = jPos > 0 && targetRefs[jPos - 1].refType === 'op' ? jPos - 1 : -1;

      let newRefs: ARef[] = [];

      // Before refA
      newRefs.push(...targetRefs.slice(0, iPos));

      // The result
      newRefs.push(resultRef);

      // Between refA and operator before refB
      const startAfterA = iPos + 1;
      const endBeforeOpB = opIndexBeforeB > 0 ? opIndexBeforeB : jPos;
      if (endBeforeOpB > startAfterA) {
        newRefs.push(...targetRefs.slice(startAfterA, endBeforeOpB));
      }

      // After refB
      newRefs.push(...targetRefs.slice(jPos + 1));

      const transformName = refA.refType === 'number'
        ? `${effectiveOp === '+' ? 'add' : 'sub'}_${iPos}_${jPos}`
        : `combine_${iPos}_${jPos}`;

      // If operating on a parentRef, update it and return model with updated tree
      if (modelDelayedOp.parentRef) {
        // Need to update the parent ref's children and rebuild model
        const parent = modelDelayedOp.parentRef;
        const updatedParent = new ARef({
          token: parent.token,
          arefs: newRefs,
          value: parent.value,
          delayedOp: parent.delayedOp,
          refType: parent.refType,
          variables: parent.variables,
          depth: parent.depth,
          role: parent.role
        });

        // Find and replace parent in model.refs
        const newModelRefs = model.refs.map(ref =>
          ref === modelDelayedOp.parentRef ? updatedParent : ref
        );

        return createModel(model, transformName, newModelRefs, modelDelayedOp.cost, resultRef);
      } else {
        // Operating on model.refs directly
        return createModel(model, transformName, newRefs, modelDelayedOp.cost, resultRef);
      }
    }

    default:
      // Other operation types not yet implemented
      return null;
  }
}

// ============================================================================
// A* Search with AModel
// ============================================================================

export function aStarSearch(startTokens: ARef[]): AModel[] | null {
  const startModel = createInitialModel(startTokens);

  const heap = new MinHeap<AModel>((a, b) => {
    const aTotal = a.remainCost;
    const bTotal = b.remainCost;
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
      // For each action type, get models while remainCost is improving
      let isEnd = true;
      for (const actionResult of getAllActions(model)) {
        const { action, model: nextModel, next } = actionResult;
        const nextKey = modelToKey(nextModel);

        if (!visited.has(nextKey)) {
          heap.push(nextModel);
          isEnd = false;

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

      if (isEnd) {
        endOfChain.push(model)
      }
    }

    // Execute delayed operations for end-of-chain models and continue search
    for (const model of endOfChain) {
      const executedModel = executeDelayedOp(model);
      if (executedModel) {
        const executedKey = modelToKey(executedModel);
        if (!visited.has(executedKey)) {
          // New state after execution - add to heap for further exploration
          heap.push(executedModel);
        }
        // If already visited, skip - we've seen this executed state before
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
      console.log(`  [${model.transform}] ${tokensStr} (cost: ${model.totalApproxCost})`);
    }
  } else {
    console.log('No solution found');
  }
}

main();
