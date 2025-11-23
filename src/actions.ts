import { getVariablePower, COST } from './terms.js';
import {
  ARef,
  AModel,
  tokenEquals,
  isNumber,
  getRefText,
  splice,
  createAref,
  DelayedOp,
  createDelayedRef,
  createModel
} from './token.js';

/**
 * Apply division operations - yields AModel with delayed ops
 */
export function* applyDiv(model: AModel): Generator<AModel> {
  const tokens = model.refs;

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

          yield createModel(model, `divide_numbers_${i}`, newTokens, COST.DIV_COST, resultRef);
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

        yield createModel(model, `divide_vars_${i}`, newTokens, COST.DIV_COST, resultRef);
      }
    }
  }
}

/**
 * Apply cancellation operations - yields AModel
 */
export function* applyCancel(model: AModel): Generator<AModel> {
  const tokens = model.refs;

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
  const tokens = model.refs;
  if (tokens.length === 0) return;

  // Remove leading + operator
  if (tokenEquals(tokens[0], '+')) {
    const newTokens = splice(tokens, 0, 1, []);
    yield createModel(model, 'remove_leading_plus', newTokens, 1);
  }

  // Remove leading - operator and negate
  if (tokenEquals(tokens[0], '-') && tokens.length > 1 && isNumber(tokens[1])) {
    const resultRef = createAref('-' + getRefText(tokens[1]), [tokens[1]]);
    const newTokens = splice(tokens, 0, 2, [resultRef]);
    yield createModel(model, 'negate_leading', newTokens, 1, resultRef);
  }
}

/**
 * Apply parenthesis removal - yields AModel
 */
export function* applyParenthesis(model: AModel): Generator<AModel> {
  const tokens = model.refs;

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
  const tokens = model.refs;

  for (let i = 1; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '-') && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      if (isNumber(nextToken)) {
        const plusRef = createAref('+');
        const resultRef = createAref('-' + getRefText(nextToken), [nextToken]);
        const newTokens = splice(tokens, i, i + 2, [plusRef, resultRef]);

        yield createModel(model, `sub_to_add_${i}`, newTokens, 1, resultRef);
      }
    }
  }
}

// ============================================================================
// Evaluate delayed operations (when needed)
// ============================================================================

/**
 * Get the numeric value of a ref, recursively evaluating delayed ops if needed.
 * Returns null if the ref contains variables or can't be evaluated.
 */
function getRefValue(ref: ARef): number | null {
  // If ref has a computed value, use it
  if (ref.value !== null && ref.value !== undefined) {
    return ref.value;
  }

  // If ref has a delayed op, evaluate it recursively
  if (ref.delayedOp) {
    return evaluateDelayedOp(ref);
  }

  // Try to parse as number from text
  const text = getRefText(ref);
  if (/^-?\d+$/.test(text)) {
    return parseInt(text, 10);
  }

  // Can't evaluate (contains variables or invalid)
  return null;
}

/**
 * Evaluate a delayed operation recursively.
 * If operands have delayed ops, they are evaluated first.
 */
export function evaluateDelayedOp(ref: ARef): number | null {
  if (!ref.delayedOp) {
    return ref.value;
  }

  const op = ref.delayedOp;
  switch (op.kind) {
    case 'add': {
      const leftVal = getRefValue(op.left);
      const rightVal = getRefValue(op.right);
      if (leftVal === null || rightVal === null) return null;
      return leftVal + rightVal;
    }
    case 'sub': {
      const leftVal = getRefValue(op.left);
      const rightVal = getRefValue(op.right);
      if (leftVal === null || rightVal === null) return null;
      return leftVal - rightVal;
    }
    case 'mul': {
      const leftVal = getRefValue(op.left);
      const rightVal = getRefValue(op.right);
      if (leftVal === null || rightVal === null) return null;
      return leftVal * rightVal;
    }
    case 'div': {
      const leftVal = getRefValue(op.left);
      const rightVal = getRefValue(op.right);
      if (leftVal === null || rightVal === null) return null;
      if (rightVal === 0) return null;
      return Math.floor(leftVal / rightVal);
    }
    case 'pow': {
      const baseVal = getRefValue(op.base);
      const expVal = getRefValue(op.exponent);
      if (baseVal === null || expVal === null) return null;
      return Math.pow(baseVal, expVal);
    }
    case 'combine': {
      // Combine terms - sum all numeric values
      let sum = 0;
      for (const term of op.terms) {
        const val = getRefValue(term);
        if (val === null) return null;
        sum += val;
      }
      return sum;
    }
    default:
      return null;
  }
}

