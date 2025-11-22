// ============================================================================
// Cost constants - tunable parameters for model optimization
// ============================================================================

export const COST = {
  // Addition costs
  ADD_ZERO: 1,                    // Adding 0 to anything
  ADD_SINGLE_DIGIT: 1,            // Adding two single-digit numbers
  ADD_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit addition

  // Subtraction costs
  SUB_IDENTICAL: 1,               // Subtracting identical numbers (A - A = 0)
  SUB_DIFF_BY_ONE: 2,             // Subtracting numbers that differ by 1
  SUB_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit subtraction

  // Multiplication costs
  MUL_BY_ZERO: 1,                 // Multiplying by 0
  MUL_BY_ONE: 1,                  // Multiplying by 1
  MUL_SINGLE_DIGIT: 2,            // Multiplying two single-digit numbers
  MUL_DIGIT_EXPONENT: 2,          // Exponent for digit-based cost (cost = digits^exp)

  // Variable costs
  VAR_BASE_COST: 10,              // Base cost for operations involving variables
  VAR_COMBINE_COST: 3,            // Cost to combine like terms (x + x = 2x)
  VAR_CANCEL_REWARD: -5,          // Negative cost (reward) for cancelling terms (x - x = 0)

  // Expression costs
  EXPR_COMBINE_COST: 2,           // Cost to combine compatible expressions

  // Other operation costs
  COEFF_VAR_MUL: 2,               // Cost for coefficient * variable (3 * x = 3x)
  SAME_VAR_MUL: 2,                // Cost for same variable multiplication (x * x = x^2)
  DIV_COST: 2,                    // Base division cost
} as const;

// ============================================================================
// Term extraction helpers
// ============================================================================

import { ARef, getRefText, isNumber, isVariable, tokenEquals, VariablePowerResult, areRefsCompatible } from "./token.js";

// ============================================================================
// Cost calculation helpers
// ============================================================================

function countDigits(value: number): number {
  return Math.abs(value).toString().length;
}

export function calculateAdditionCost(leftValue: number, rightValue: number): number {
  if (leftValue === 0 || rightValue === 0) {
    return COST.ADD_ZERO;
  }
  if (countDigits(leftValue) === 1 && countDigits(rightValue) === 1) {
    return COST.ADD_SINGLE_DIGIT;
  }
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits * COST.ADD_PER_DIGIT;
}

export function calculateSubtractionCost(leftValue: number, rightValue: number): number {
  if (leftValue === rightValue) {
    return COST.SUB_IDENTICAL;
  }
  if (Math.abs(leftValue - rightValue) === 1) {
    return COST.SUB_DIFF_BY_ONE;
  }
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits * COST.SUB_PER_DIGIT;
}

export function calculateMultiplicationCost(leftValue: number, rightValue: number): number {
  if (leftValue === 0 || rightValue === 0) {
    return COST.MUL_BY_ZERO;
  }
  if (leftValue === 1 || rightValue === 1) {
    return COST.MUL_BY_ONE;
  }
  if (countDigits(leftValue) === 1 && countDigits(rightValue) === 1) {
    return COST.MUL_SINGLE_DIGIT;
  }
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits ** COST.MUL_DIGIT_EXPONENT;
}

// ============================================================================
// Term interface
// ============================================================================

export interface Term {
  startIdx: number;
  endIdx: number;      // exclusive
  refs: ARef[];        // the tokens that make up this term
  sign: '+' | '-';     // sign preceding this term (first term is '+')
  isNumber: boolean;
  isVariable: boolean;
  isExpr: boolean;     // true if term is a delayed expression (contains variables)
  variableName?: string;
  power?: number;
  numericValue?: number;
}

/**
 * Extract all terms from token list.
 * A term is a value (number, variable, or expression) separated by + or - operators.
 * Handles operator precedence by treating multiplication chains as single terms.
 */
export function extractTerms(tokens: ReadonlyArray<ARef>): Term[] {
  const terms: Term[] = [];
  let i = 0;
  let currentSign: '+' | '-' = '+';

  while (i < tokens.length) {
    const token = tokens[i];
    const text = getRefText(token);

    // Handle leading sign
    if (i === 0 && (text === '+' || text === '-')) {
      currentSign = text as '+' | '-';
      i++;
      continue;
    }

    // Skip operators between terms, capture sign
    if (text === '+' || text === '-') {
      currentSign = text as '+' | '-';
      i++;
      continue;
    }

    // Found start of a term - collect it (including any multiplication chain)
    const startIdx = i;
    const termRefs: ARef[] = [token];
    i++;

    // Extend term to include multiplication chains: 3 * x * y
    while (i < tokens.length - 1 && tokenEquals(tokens[i], '*')) {
      termRefs.push(tokens[i]);     // the *
      termRefs.push(tokens[i + 1]); // the operand
      i += 2;
    }

    // Also extend for powers: x ^ 2
    while (i < tokens.length - 1 && tokenEquals(tokens[i], '^')) {
      termRefs.push(tokens[i]);     // the ^
      termRefs.push(tokens[i + 1]); // the exponent
      i += 2;
    }

    const endIdx = i;
    const firstRef = termRefs[0];

    // Classify the term based on first ref's type
    const isDigit = termRefs.length === 1 && (firstRef.refType === 'digit' || isNumber(firstRef));
    const isSingleVar = termRefs.length === 1 && (firstRef.refType === 'variable' || isVariable(firstRef));
    const isExprRef = firstRef.refType === 'expr' || (termRefs.length > 1);

    const term: Term = {
      startIdx,
      endIdx,
      refs: termRefs,
      sign: currentSign,
      isNumber: isDigit,
      isVariable: isSingleVar,
      isExpr: isExprRef
    };

    if (term.isNumber) {
      term.numericValue = firstRef.value ?? parseInt(getRefText(firstRef), 10);
    }

    if (term.isVariable) {
      term.variableName = getRefText(firstRef);
      term.power = 1;
    }

    // Check for variable with power: x ^ 2
    if (termRefs.length === 3 && isVariable(termRefs[0]) && tokenEquals(termRefs[1], '^') && isNumber(termRefs[2])) {
      term.isVariable = true;
      term.isExpr = false;
      term.variableName = getRefText(termRefs[0]);
      term.power = parseInt(getRefText(termRefs[2]), 10);
    }

    terms.push(term);
    currentSign = '+'; // reset for next term
  }

  return terms;
}

/**
 * Check if two terms can be added (are "like terms")
 * - Two digit terms can always be added
 * - Two variables with same name and power can be added
 * - Two expressions are compatible if they have the same variables
 */
export function canAddTerms(a: Term, b: Term): boolean {
  // Two numbers/digits can always be added
  if (a.isNumber && b.isNumber) {
    return true;
  }

  // Two variables with same name and power can be added
  if (a.isVariable && b.isVariable && a.variableName === b.variableName && a.power === b.power) {
    return true;
  }

  // Two expressions can be combined if they have compatible variables
  if (a.isExpr && b.isExpr) {
    // Use the first ref from each term to check compatibility
    return areRefsCompatible(a.refs[0], b.refs[0]);
  }

  // Expression and variable can be combined if expression contains only that variable
  if (a.isExpr && b.isVariable) {
    return areRefsCompatible(a.refs[0], b.refs[0]);
  }
  if (a.isVariable && b.isExpr) {
    return areRefsCompatible(a.refs[0], b.refs[0]);
  }

  return false;
}

/**
 * Calculate cost of adding/subtracting two terms.
 * Cancelling terms (A - A = 0) returns negative cost (reward) to prioritize simplification.
 */
export function calculateTermAddCost(a: Term, b: Term, op: '+' | '-'): number {
  // Number + Number or Number - Number
  if (a.isNumber && b.isNumber) {
    const aVal = a.numericValue ?? 0;
    const bVal = b.numericValue ?? 0;
    return op === '+' ? calculateAdditionCost(aVal, bVal) : calculateSubtractionCost(aVal, bVal);
  }

  // Variable operations
  if (a.isVariable && b.isVariable) {
    // Cancelling like terms: x - x = 0 (reward with negative cost)
    if (op === '-' && a.variableName === b.variableName && a.power === b.power) {
      return COST.VAR_CANCEL_REWARD;
    }
    // Combining like terms: x + x = 2x
    return COST.VAR_COMBINE_COST;
  }

  // Expression operations
  if (a.isExpr || b.isExpr) {
    const aText = getRefText(a.refs[0]);
    const bText = getRefText(b.refs[0]);

    // Cancelling identical expressions: (expr) - (expr) = 0
    if (op === '-' && aText === bText) {
      return COST.VAR_CANCEL_REWARD;
    }

    // Combining compatible expressions
    return COST.EXPR_COMBINE_COST;
  }

  // Default: base variable cost
  return COST.VAR_BASE_COST;
}

export function getBoolAttr(token: ARef, attr: string, tokens: ReadonlyArray<ARef>): boolean {
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

export function getVariablePower(tokens: ReadonlyArray<ARef>, startIdx: number): VariablePowerResult {
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
