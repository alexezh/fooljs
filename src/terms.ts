// ============================================================================
// Term extraction helpers
// ============================================================================

import { ARef, getRefText, isNumber, isVariable, tokenEquals } from "./token.js";
import { calculateAdditionCost, calculateSubtractionCost } from "./weight";

interface Term {
  startIdx: number;
  endIdx: number;      // exclusive
  refs: ARef[];        // the tokens that make up this term
  sign: '+' | '-';     // sign preceding this term (first term is '+')
  isNumber: boolean;
  isVariable: boolean;
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

    // Classify the term
    const term: Term = {
      startIdx,
      endIdx,
      refs: termRefs,
      sign: currentSign,
      isNumber: termRefs.length === 1 && isNumber(firstRef),
      isVariable: termRefs.length === 1 && isVariable(firstRef)
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
 */
export function canAddTerms(a: Term, b: Term): boolean {
  // Two numbers can always be added
  if (a.isNumber && b.isNumber) {
    return true;
  }
  // Two variables with same name and power can be added
  if (a.isVariable && b.isVariable && a.variableName === b.variableName && a.power === b.power) {
    return true;
  }
  return false;
}

/**
 * Calculate cost of adding two terms
 */
export function calculateTermAddCost(a: Term, b: Term, op: '+' | '-'): number {
  if (a.isNumber && b.isNumber) {
    const aVal = a.numericValue ?? 0;
    const bVal = b.numericValue ?? 0;
    return op === '+' ? calculateAdditionCost(aVal, bVal) : calculateSubtractionCost(aVal, bVal);
  }
  // Combining like terms has fixed cost
  return 3;
}