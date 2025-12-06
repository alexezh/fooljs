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

import { ARef, getVariableName } from "./token.js";

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

/**
 * Check if two terms can be added (are "like terms")
 * - Two digit terms can always be added
 * - Two variables with same name and power can be added
 * - Two expressions are compatible if they have the same variables
 */
export function canAddTerms(a: ARef, b: ARef): boolean {
  // Two numbers/digits can always be added
  if (a.isNumber && b.isNumber) {
    return true;
  }

  // Get variables from both refs
  // const aVars = a.variables ?? (a.refType === 'symbol' && a.symbol ? [a.symbol] : []);
  // const bVars = b.variables ?? (b.refType === 'symbol' && b.symbol ? [b.symbol] : []);

  // // If either has no variables and other has variables, not compatible
  // if (aVars.length === 0 && bVars.length > 0) return false;
  // if (bVars.length === 0 && aVars.length > 0) return false;

  // // Compare variable sets - must be identical for compatibility
  // if (aVars.length !== bVars.length) return false;
  // const aSet = new Set(aVars);
  // return bVars.every(v => aSet.has(v));
  return false;
}


/**
 * Calculate cost of adding/subtracting two ARef terms.
 * Cancelling terms (A - A = 0) returns negative cost (reward) to prioritize simplification.
 */
export function calculateTermAddCost(a: ARef, b: ARef, op: '+' | '-'): number {
  // Number + Number or Number - Number
  if (a.isNumber && b.isNumber) {
    const aVal = (a.value as number) ?? parseInt(a.symbol || '0', 10) ?? 0;
    const bVal = (b.value as number) ?? parseInt(b.symbol || '0', 10) ?? 0;
    return op === '+' ? calculateAdditionCost(aVal, bVal) : calculateSubtractionCost(aVal, bVal);
  }

  // Variable operations (including variables with power from delayed ops)
  if (a.isSymbol && b.isSymbol) {
    const aVarName = getVariableName(a);
    const bVarName = getVariableName(b);
    const aPowerRef = a.getPower();
    const bPowerRef = b.getPower();
    const aPower = aPowerRef.isNumber && typeof aPowerRef.value === 'number' ? aPowerRef.value : 1;
    const bPower = bPowerRef.isNumber && typeof bPowerRef.value === 'number' ? bPowerRef.value : 1;

    // Cancelling like terms: x - x = 0 (reward with negative cost)
    if (op === '-' && aVarName === bVarName && aPower === bPower) {
      return COST.VAR_CANCEL_REWARD;
    }
    // Combining like terms: x + x = 2x
    if (aVarName === bVarName && aPower === bPower) {
      return COST.VAR_COMBINE_COST;
    }
    // Different variables or powers - base cost
    return COST.VAR_BASE_COST;
  }

  // Other symbol operations
  const aText = a.symbol;
  const bText = b.symbol;

  // Cancelling identical expressions: (expr) - (expr) = 0
  if (op === '-' && aText === bText) {
    return COST.VAR_CANCEL_REWARD;
  }

  // Combining compatible expressions
  return COST.EXPR_COMBINE_COST;
}


