import {
  AToken,
  ARef,
  AModel,
  tokenEquals,
  isNumber,
  isVariable,
  getRefText,
  splice,
  createAref,
  createToken,
  DelayedOp,
  VariablePowerResult
} from './token.js';
import { makeMultTerm } from './transform.js';
import {
  calculateAdditionCost,
  calculateMultiplicationCost,
  calculateSubtractionCost
} from './weight.js';

// ============================================================================
// Helper functions
// ============================================================================

function createDelayedRef(
  text: string,
  sourceArefs: ARef[],
  delayedOp: DelayedOp
): ARef {
  return {
    token: createToken(text),
    arefs: sourceArefs,
    value: null,
    delayedOp
  };
}

function createModel(
  parent: AModel,
  transform: string,
  tokens: ARef[],
  cost: number
): AModel {
  return {
    parent,
    transform,
    tokens,
    approxCost: parent.approxCost + cost
  };
}

function getBoolAttr(token: ARef, attr: string, tokens: ReadonlyArray<ARef>): boolean {
  if (attr === 'is_factor') {
    const idx = tokens.indexOf(token);
    if (idx > 0 && tokenEquals(tokens[idx - 1], '*')) return true;
    if (idx < tokens.length - 1 && tokenEquals(tokens[idx + 1], '*')) return true;
    return false;
  }
  if (attr === 'is_term') {
    const idx = tokens.indexOf(token);
    if (idx > 0 && tokenEquals(tokens[idx - 1], '*')) return false;
    if (idx < tokens.length - 1 && tokenEquals(tokens[idx + 1], '*')) return false;
    return true;
  }
  return false;
}

function getVariablePower(tokens: ReadonlyArray<ARef>, startIdx: number): VariablePowerResult {
  if (startIdx >= tokens.length) {
    return { variable: null, power: null, endIndex: startIdx };
  }

  if (isVariable(tokens[startIdx])) {
    const variable = tokens[startIdx];
    if (
      startIdx + 2 < tokens.length &&
      tokenEquals(tokens[startIdx + 1], '^') &&
      isNumber(tokens[startIdx + 2])
    ) {
      const power = parseInt(getRefText(tokens[startIdx + 2]), 10);
      return { variable, power, endIndex: startIdx + 3 };
    } else {
      return { variable, power: 1, endIndex: startIdx + 1 };
    }
  }
  return { variable: null, power: null, endIndex: startIdx };
}

// ============================================================================
// Generator-based action functions with delayed operations
// ============================================================================

/**
 * Apply sum/subtraction operations - yields AModel with delayed ops
 */
export function* applySum(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  // Check for multiplication terms that need wrapping first
  let hasMultiplications = false;
  for (const token of tokens) {
    if (getBoolAttr(token, 'is_factor', tokens)) {
      hasMultiplications = true;
      break;
    }
  }

  if (hasMultiplications) {
    const newTokens = wrapAllMultiplications(tokens);
    yield createModel(model, 'wrap_mult', newTokens, 1);
  }

  // Look for addition/subtraction operations
  for (let i = 1; i < tokens.length - 1; i++) {
    const op = getRefText(tokens[i]);
    if (op === '+' || op === '-') {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      const leftIsTerm = getBoolAttr(left, 'is_term', tokens);
      const rightIsTerm = getBoolAttr(right, 'is_term', tokens);

      if (!(leftIsTerm && rightIsTerm)) {
        continue;
      }

      // number +/- number - create delayed operation
      if (isNumber(left) && isNumber(right)) {
        const leftValue = left.value ?? parseInt(getRefText(left), 10);
        const rightValue = right.value ?? parseInt(getRefText(right), 10);

        const cost = op === '+'
          ? calculateAdditionCost(leftValue, rightValue)
          : calculateSubtractionCost(leftValue, rightValue);

        const delayedOp: DelayedOp = op === '+'
          ? { kind: 'add', left, right }
          : { kind: 'sub', left, right };

        const resultText = `(${getRefText(left)}${op}${getRefText(right)})`;
        const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `compute_${op === '+' ? 'sum' : 'sub'}_${i}`, newTokens, cost);
      }

      // Handle like terms: x + x -> 2*x (only for addition)
      if (op === '+') {
        const leftResult = getVariablePower(tokens, i - 1);
        const rightResult = getVariablePower(tokens, i + 1);

        if (
          leftResult.variable &&
          rightResult.variable &&
          getRefText(leftResult.variable) === getRefText(rightResult.variable) &&
          leftResult.power === rightResult.power
        ) {
          const sourceTokens = tokens.slice(i - 1, rightResult.endIndex);
          const delayedOp: DelayedOp = { kind: 'combine', terms: sourceTokens, op: '+' };
          const resultText = `(2*${getRefText(leftResult.variable)}${leftResult.power !== 1 ? '^' + leftResult.power : ''})`;
          const resultRef = createDelayedRef(resultText, sourceTokens, delayedOp);
          const newTokens = splice(tokens, i - 1, rightResult.endIndex, [resultRef]);

          yield createModel(model, `combine_like_terms_${i}`, newTokens, 3);
        }
      }

      // Handle like terms subtraction: x - x -> 0
      if (op === '-') {
        const leftResult = getVariablePower(tokens, i - 1);
        const rightResult = getVariablePower(tokens, i + 1);

        if (
          leftResult.variable &&
          rightResult.variable &&
          getRefText(leftResult.variable) === getRefText(rightResult.variable) &&
          leftResult.power === rightResult.power
        ) {
          const sourceTokens = tokens.slice(i - 1, rightResult.endIndex);
          const delayedOp: DelayedOp = { kind: 'sub', left: leftResult.variable, right: rightResult.variable };
          const resultRef = createDelayedRef('0', sourceTokens, delayedOp);
          const newTokens = splice(tokens, i - 1, rightResult.endIndex, [resultRef]);

          yield createModel(model, `subtract_like_terms_${i}`, newTokens, 3);
        }
      }

      // Reorder: variable + number -> number + variable
      if (op === '+' && isVariable(left) && isNumber(right)) {
        const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
        const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

        if (!(leftIsFactor || rightIsFactor)) {
          const combinedText = `(${getRefText(right)}+${getRefText(left)})`;
          const newRef = createAref(combinedText, [left, right]);
          const newTokens = splice(tokens, i - 1, i + 2, [newRef]);

          yield createModel(model, `reorder_${i}`, newTokens, 4);
        }
      }
    }
  }
}

/**
 * Apply multiplication operations - yields AModel with delayed ops
 */
export function* applyMul(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
      const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

      if (!(leftIsFactor && rightIsFactor)) {
        continue;
      }

      // number * variable -> coefficient-variable with delayed op
      if (isNumber(left) && isVariable(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const combinedText = `${getRefText(left)}${getRefText(right)}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, 2);
      } else if (isVariable(left) && isNumber(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const combinedText = `${getRefText(right)}${getRefText(left)}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, 2);
      }

      // variable * variable (same variable) -> power with delayed op
      const leftResult = getVariablePower(tokens, i - 1);
      const rightResult = getVariablePower(tokens, i + 1);

      if (leftResult.variable && rightResult.variable) {
        if (getRefText(leftResult.variable) === getRefText(rightResult.variable)) {
          const totalPower = (leftResult.power ?? 1) + (rightResult.power ?? 1);
          const delayedOp: DelayedOp = { kind: 'pow', base: leftResult.variable, exponent: createAref(String(totalPower)) };
          const resultText = totalPower === 1
            ? getRefText(leftResult.variable)
            : `${getRefText(leftResult.variable)}^${totalPower}`;
          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          const newTokens = splice(tokens, i - 1, rightResult.endIndex, [resultRef]);

          yield createModel(model, `multiply_same_var_${i}`, newTokens, 2);
        }
      }

      // number * number -> delayed multiplication
      if (isNumber(left) && isNumber(right)) {
        const leftValue = left.value ?? parseInt(getRefText(left), 10);
        const rightValue = right.value ?? parseInt(getRefText(right), 10);
        const cost = calculateMultiplicationCost(leftValue, rightValue);

        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const resultText = `(${getRefText(left)}*${getRefText(right)})`;
        const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_numbers_${i}`, newTokens, cost);
      }
    }
  }
}

/**
 * Apply division operations - yields AModel with delayed ops
 */
export function* applyDiv(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '/')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // number / number
      if (isNumber(left) && isNumber(right)) {
        const rightVal = parseInt(getRefText(right), 10);
        const leftVal = parseInt(getRefText(left), 10);
        if (rightVal !== 0 && leftVal % rightVal === 0) {
          const delayedOp: DelayedOp = { kind: 'div', left, right };
          const resultText = `(${getRefText(left)}/${getRefText(right)})`;
          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

          yield createModel(model, `divide_numbers_${i}`, newTokens, 2);
        }
      }

      // variable / variable
      const leftResult = getVariablePower(tokens, i - 1);
      const rightResult = getVariablePower(tokens, i + 1);

      if (
        leftResult.variable &&
        rightResult.variable &&
        getRefText(leftResult.variable) === getRefText(rightResult.variable)
      ) {
        const powerDiff = (leftResult.power ?? 1) - (rightResult.power ?? 1);
        const sourceArefs = tokens.slice(i - 1, rightResult.endIndex);
        const delayedOp: DelayedOp = { kind: 'div', left: leftResult.variable, right: rightResult.variable };

        let resultText: string;
        if (powerDiff === 0) {
          resultText = '1';
        } else if (powerDiff === 1) {
          resultText = getRefText(leftResult.variable);
        } else {
          resultText = `${getRefText(leftResult.variable)}^${powerDiff}`;
        }

        const resultRef = createDelayedRef(resultText, sourceArefs, delayedOp);
        const newTokens = splice(tokens, i - 1, rightResult.endIndex, [resultRef]);

        yield createModel(model, `divide_vars_${i}`, newTokens, 2);
      }
    }
  }
}

/**
 * Apply cancellation operations - yields AModel
 */
export function* applyCancel(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  function isPartOfMultiplication(index: number): boolean {
    if (index > 0 && tokenEquals(tokens[index - 1], '*')) return true;
    if (index + 1 < tokens.length && tokenEquals(tokens[index + 1], '*')) return true;
    return false;
  }

  // Look for +term ... -term patterns
  for (let i = 0; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '+') && i + 1 < tokens.length) {
      const addTerm = tokens[i + 1];
      if (isPartOfMultiplication(i + 1)) continue;

      for (let j = i + 2; j < tokens.length; j++) {
        if (
          tokenEquals(tokens[j], '-') &&
          j + 1 < tokens.length &&
          getRefText(tokens[j + 1]) === getRefText(addTerm) &&
          !isPartOfMultiplication(j + 1)
        ) {
          let newTokens = splice(tokens, j, j + 2, []);
          newTokens = splice(newTokens, i, i + 2, []);

          yield createModel(model, `cancel_${i}_${j}`, newTokens, 1);
        }
      }
    }
  }
}

/**
 * Apply cleanup operations - yields AModel
 */
export function* applyCleanup(model: AModel): Generator<AModel> {
  const tokens = model.tokens;
  if (tokens.length === 0) return;

  // Remove leading + operator
  if (tokenEquals(tokens[0], '+')) {
    const newTokens = splice(tokens, 0, 1, []);
    yield createModel(model, 'remove_leading_plus', newTokens, 1);
  }

  // Remove leading - operator and negate
  if (tokenEquals(tokens[0], '-') && tokens.length > 1 && isNumber(tokens[1])) {
    const negativeRef = createAref('-' + getRefText(tokens[1]), [tokens[1]]);
    const newTokens = splice(tokens, 0, 2, [negativeRef]);
    yield createModel(model, 'negate_leading', newTokens, 1);
  }
}

/**
 * Apply parenthesis removal - yields AModel
 */
export function* applyParenthesis(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  for (let i = 0; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '(')) {
      for (let j = i + 2; j < tokens.length; j++) {
        if (tokenEquals(tokens[j], ')')) {
          const subexpr = tokens.slice(i + 1, j);
          if (subexpr.length === 1) {
            const newTokens = splice(tokens, i, j + 1, subexpr);
            yield createModel(model, `remove_parens_${i}`, newTokens, 1);
          }
        }
      }
    }
  }
}

/**
 * Convert subtraction to addition with negatives - yields AModel
 */
export function* applySubToAdd(model: AModel): Generator<AModel> {
  const tokens = model.tokens;

  for (let i = 1; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '-') && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      if (isNumber(nextToken)) {
        const plusRef = createAref('+');
        const negativeRef = createAref('-' + getRefText(nextToken), [nextToken]);
        const newTokens = splice(tokens, i, i + 2, [plusRef, negativeRef]);

        yield createModel(model, `sub_to_add_${i}`, newTokens, 1);
      }
    }
  }
}

// ============================================================================
// Helper: wrap all multiplication terms
// ============================================================================

function wrapAllMultiplications(tokens: ReadonlyArray<ARef>): ARef[] {
  function detectAllMultTerms(): Array<{ start: number; end: number }> {
    const multTerms: Array<{ start: number; end: number }> = [];
    let i = 0;

    while (i < tokens.length) {
      if (getBoolAttr(tokens[i], 'is_factor', tokens)) {
        const start = i;
        let end = i + 1;

        while (end < tokens.length) {
          if (tokenEquals(tokens[end], '*')) {
            end++;
            if (end < tokens.length && getBoolAttr(tokens[end], 'is_factor', tokens)) {
              end++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        multTerms.push({ start, end });
        i = end;
      } else {
        i++;
      }
    }
    return multTerms;
  }

  const multTerms = detectAllMultTerms();
  let newTokens = [...tokens];

  // Process from right to left
  for (let j = multTerms.length - 1; j >= 0; j--) {
    const { start, end } = multTerms[j];
    const multTokens = newTokens.slice(start, end);
    const delayedOp: DelayedOp = { kind: 'wrap', terms: [...multTokens] };
    const wrapText = multTokens.map(t => getRefText(t)).join('');
    const wrappedRef = createDelayedRef(`_${wrapText}`, multTokens, delayedOp);
    newTokens = splice(newTokens, start, end, [wrappedRef]);
  }

  return newTokens;
}

// ============================================================================
// Evaluate delayed operations (when needed)
// ============================================================================

export function evaluateDelayedOp(ref: ARef): number | null {
  if (!ref.delayedOp) {
    return ref.value;
  }

  const op = ref.delayedOp;
  switch (op.kind) {
    case 'add': {
      const leftVal = op.left.value ?? parseInt(getRefText(op.left), 10);
      const rightVal = op.right.value ?? parseInt(getRefText(op.right), 10);
      return leftVal + rightVal;
    }
    case 'sub': {
      const leftVal = op.left.value ?? parseInt(getRefText(op.left), 10);
      const rightVal = op.right.value ?? parseInt(getRefText(op.right), 10);
      return leftVal - rightVal;
    }
    case 'mul': {
      const leftVal = op.left.value ?? parseInt(getRefText(op.left), 10);
      const rightVal = op.right.value ?? parseInt(getRefText(op.right), 10);
      return leftVal * rightVal;
    }
    case 'div': {
      const leftVal = op.left.value ?? parseInt(getRefText(op.left), 10);
      const rightVal = op.right.value ?? parseInt(getRefText(op.right), 10);
      if (rightVal === 0) return null;
      return Math.floor(leftVal / rightVal);
    }
    default:
      return null;
  }
}

// ============================================================================
// All actions combined
// ============================================================================

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
