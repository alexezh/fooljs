import { AModel, createModel } from './model.js';
import {
  ARef,
  tokenEquals,
  splice,
  createOpRef,
  createSymbolRef,
} from './token.js';

/**
 * Apply cancellation operations - yields AModel
 */
export function* applyCancel(model: AModel): Generator<AModel> {
  const refs = model.refs;

  function isPartOfMultiplication(index: number): boolean {
    if (index > 0 && tokenEquals(refs[index - 1], '*')) return true;
    if (index + 1 < refs.length && tokenEquals(refs[index + 1], '*')) return true;
    return false;
  }

  // Look for +term ... -term patterns
  for (let i = 0; i < refs.length; i++) {
    if (tokenEquals(refs[i], '+') && i + 1 < refs.length) {
      const addTerm = refs[i + 1];
      if (isPartOfMultiplication(i + 1)) continue;

      for (let j = i + 2; j < refs.length; j++) {
        if (
          tokenEquals(refs[j], '-') &&
          j + 1 < refs.length &&
          refs[j + 1].symbol === addTerm.symbol &&
          !isPartOfMultiplication(j + 1)
        ) {
          let newTokens = splice(refs, j, j + 2, []);
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
  if (tokenEquals(tokens[0], '-') && tokens.length > 1 && tokens[1].isNumber) {
    const resultRef = createSymbolRef(model.cache, [tokens[1]]);
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
      if (nextToken.isNumber) {
        const plusRef = createOpRef('+');
        const resultRef = createSymbolRef(model.cache, [nextToken]);
        const newTokens = splice(tokens, i, i + 2, [plusRef, resultRef]);

        yield createModel(model, `sub_to_add_${i}`, newTokens, 1, resultRef);
      }
    }
  }
}
