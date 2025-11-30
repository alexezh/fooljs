import { ARef, tokenEquals } from './token.js';

export function isGoal(tokens: ARef[]): boolean {
  // Goal: single token, number, variable, or coeffvar (e.g., 2x, x^2)
  // Also handle multiple tokens for powers and multiplication with any number of variables

  // Single token cases
  if (tokens.length === 1) {
    const token = tokens[0];
    // Handle plain numbers and variables
    if (token.isNumber || token.isSymbol) {
      return true;
    }

    return false;
  }

  // For multiple tokens, check if it's a valid goal expression
  // Valid goals: number, variable, coefficient*variable(s), variable(s) with powers
  // Examples: [2], [x], [x, ^, 2], [2, *, x], [2, *, x, *, y], [x, *, y, ^, 3], etc.

  return isValidGoalSequence(tokens);
}

function isValidGoalSequence(tokens: ARef[]): boolean {
  if (tokens.length === 0) {
    return false;
  }

  // Handle 3-token expressions first to be specific
  if (tokens.length === 3) {
    const left = tokens[0];
    const op = tokens[1];
    const right = tokens[2];

    // Division: number / number or variable / variable are valid goals
    if (tokenEquals(op, '/')) {
      if (
        (left.isNumber && right.isNumber) ||
        (left.isSymbol && right.isSymbol)
      ) {
        return true;
      }
    }

    // Addition: only different variables, not numbers, not same variables
    if (tokenEquals(op, '+')) {
      if (
        left.isSymbol &&
        right.isSymbol &&
        left.symbol !== right.symbol
      ) {
        return true;
      }
      // Numbers with addition should not be goals (need simplification)
      if (left.isNumber && right.isNumber) {
        return false;
      }
      // Same variables should not be goals (x + x -> 2*x)
      if (
        left.isSymbol &&
        right.isSymbol &&
        left.symbol === right.symbol
      ) {
        return false;
      }
    }

    // Subtraction: allow various valid goal patterns
    if (tokenEquals(op, '-')) {
      // Different variables are valid goals (x - y)
      if (
        left.isSymbol &&
        right.isSymbol &&
        left.symbol !== right.symbol
      ) {
        return true;
      }
      // Variable - number is valid goal (x - 5)
      if (left.isSymbol && right.isNumber) {
        return true;
      }
      // Number - variable is valid goal (5 - x)
      if (left.isNumber && right.isSymbol) {
        return true;
      }
      // Numbers with subtraction should not be goals (need simplification)
      if (left.isNumber && right.isNumber) {
        return false;
      }
      // Same variables should not be goals (x - x -> 0)
      if (
        left.isSymbol &&
        right.isSymbol &&
        left.symbol === right.symbol
      ) {
        return false;
      }
      // Other cases may be complex expressions - check in multi-token logic
      return false;
    }

    // Multiplication: should be simplified
    if (tokenEquals(op, '*')) {
      // Number * number should be computed
      if (left.isNumber && right.isNumber) {
        return false;
      }
      // Number * variable should become coefficient-variable
      if (
        (left.isNumber && right.isSymbol) ||
        (left.isSymbol && right.isNumber)
      ) {
        return false;
      }
      // Variable * variable should become power or remain separate for different variables
      if (left.isSymbol && right.isSymbol) {
        if (left.symbol === right.symbol) {
          return false; // x * x -> x^2
        } else {
          return true; // x * y stays as x * y
        }
      }
      return false;
    }
  }

  let i = 0;

  // Optional leading coefficient or number
  if (i < tokens.length && tokens[i].isNumber) {
    i++;
    if (i < tokens.length && isOperator(tokens[i])) {
      i++;
    } else {
      // Just a number, valid goal
      return i === tokens.length;
    }
  }

  // Must have at least one variable
  let hasVariable = false;

  while (i < tokens.length) {
    // Expect variable
    if (i >= tokens.length || !tokens[i].isSymbol) {
      return false;
    }
    hasVariable = true;
    i++;

    // Optional power
    if (
      i + 1 < tokens.length &&
      tokenEquals(tokens[i], '^') &&
      tokens[i + 1].isNumber
    ) {
      i += 2;
    }

    // Optional operation for next variable/number
    if (i < tokens.length) {
      if (isOperator(tokens[i])) {
        i++;
      } else {
        // No more operations, should be end
        return i === tokens.length;
      }
    }
  }

  return hasVariable;
}

function isOperator(token: ARef): boolean {
  const text = token.symbol;
  return text === '*' || text === '/' || text === '-' || text === '+';
}
