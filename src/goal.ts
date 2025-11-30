import { ARef } from './token.js';

/**
 * Check if the expression is a linear expression goal.
 * Valid goals:
 * - A single digit (number)
 * - const * var where var appears exactly once
 */
export function isLinearExpressionGoal(refs: ARef[]): boolean {
  // Single number is a valid goal
  if (refs.length === 1 && refs[0].isNumber) {
    return true;
  }

  // Collect all variables from the expression
  const counts: { [name: string]: number } = {};

  // Count variables in all tokens
  for (const token of refs) {
    if (token.isNumber) {
      counts["_number"] = counts["_number"] ?? 0 + 1;
    } else if (token.isOp) {
      // nothing
    } else {
      if (token.isInternalSymbol()) {
        // form value * var
        if (token.arefs.length !== 3) {
          return false;
        }
        let [t1, t2, t3] = token.arefs;
        if (t2.symbol !== "*") {
          return false;
        }

        if (t1.isNumber && t3.isPublicVariable()) {
          counts[t3.symbol!] = counts[t3.symbol!] ?? 0 + 1;
        }
        else if (t3.isNumber && t1.isPublicVariable()) {
          counts[t1.symbol!] = counts[t1.symbol!] ?? 0 + 1;
        } else {
          return false;
        }
      } else {
        counts[token.symbol!] = counts[token.symbol!] ?? 0 + 1;
      }
    }
  }

  // Check if each variable appears exactly once
  for (const [_, count] of Object.entries(counts)) {
    if (count !== 1) {
      return false;
    }
  }

  return true;
}
