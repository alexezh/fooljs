import { AModel, createModel } from './model.js';
import {
  ARef,
  tokenEquals,
  isNumber,
  getRefText,
  splice,
  createAref
} from './token.js';

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

  // Try to parse as number from text
  const text = getRefText(ref);
  if (/^-?\d+$/.test(text)) {
    return parseInt(text, 10);
  }

  // Can't evaluate (contains variables or invalid)
  return null;
}
