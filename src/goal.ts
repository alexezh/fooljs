import { ARef, isNumber, isVariable, getRefText, tokenEquals } from './token.js';

export function isGoal(tokens: ARef[]): boolean {
  // Goal: single token, number, variable, or coeffvar (e.g., 2x, x^2)
  // Also handle multiple tokens for powers and multiplication with any number of variables

  // Single token cases
  if (tokens.length === 1) {
    const token = tokens[0];
    const text = getRefText(token);
    // Handle plain numbers and variables
    if (isNumber(token) || isVariable(token)) {
      return true;
    }
    // Handle coefficient*variable patterns: 2x, 2*x, (2*x), 2x^2, etc.
    // Remove parentheses for checking
    const cleanText = text.replace(/^\(|\)$/g, '');
    // Match: optional-number, optional-*, variable, optional-power
    if (/^\d*\*?[a-zA-Z](\^\d+)?$/.test(cleanText)) {
      return true;
    }
    // Match more complex patterns like 2*x^2
    if (/^\d+\*[a-zA-Z](\^\d+)?$/.test(cleanText)) {
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
        (isNumber(left) && isNumber(right)) ||
        (isVariable(left) && isVariable(right))
      ) {
        return true;
      }
    }

    // Addition: only different variables, not numbers, not same variables
    if (tokenEquals(op, '+')) {
      if (
        isVariable(left) &&
        isVariable(right) &&
        getRefText(left) !== getRefText(right)
      ) {
        return true;
      }
      // Numbers with addition should not be goals (need simplification)
      if (isNumber(left) && isNumber(right)) {
        return false;
      }
      // Same variables should not be goals (x + x -> 2*x)
      if (
        isVariable(left) &&
        isVariable(right) &&
        getRefText(left) === getRefText(right)
      ) {
        return false;
      }
    }

    // Subtraction: allow various valid goal patterns
    if (tokenEquals(op, '-')) {
      // Different variables are valid goals (x - y)
      if (
        isVariable(left) &&
        isVariable(right) &&
        getRefText(left) !== getRefText(right)
      ) {
        return true;
      }
      // Variable - number is valid goal (x - 5)
      if (isVariable(left) && isNumber(right)) {
        return true;
      }
      // Number - variable is valid goal (5 - x)
      if (isNumber(left) && isVariable(right)) {
        return true;
      }
      // Numbers with subtraction should not be goals (need simplification)
      if (isNumber(left) && isNumber(right)) {
        return false;
      }
      // Same variables should not be goals (x - x -> 0)
      if (
        isVariable(left) &&
        isVariable(right) &&
        getRefText(left) === getRefText(right)
      ) {
        return false;
      }
      // Other cases may be complex expressions - check in multi-token logic
      return false;
    }

    // Multiplication: should be simplified
    if (tokenEquals(op, '*')) {
      // Number * number should be computed
      if (isNumber(left) && isNumber(right)) {
        return false;
      }
      // Number * variable should become coefficient-variable
      if (
        (isNumber(left) && isVariable(right)) ||
        (isVariable(left) && isNumber(right))
      ) {
        return false;
      }
      // Variable * variable should become power or remain separate for different variables
      if (isVariable(left) && isVariable(right)) {
        if (getRefText(left) === getRefText(right)) {
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
  if (i < tokens.length && isNumber(tokens[i])) {
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
    if (i >= tokens.length || !isVariable(tokens[i])) {
      return false;
    }
    hasVariable = true;
    i++;

    // Optional power
    if (
      i + 1 < tokens.length &&
      tokenEquals(tokens[i], '^') &&
      isNumber(tokens[i + 1])
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
  const text = getRefText(token);
  return text === '*' || text === '/' || text === '-' || text === '+';
}
