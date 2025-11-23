import { calculateTermAddCost, canAddTerms, extractTerms, Term } from "./terms.js";
import { AModel, ARef, createAref, createDelayedRef, createModel, DelayedOp, getRefText, areRefsCompatible } from "./token.js";

/**
 * Apply sum/subtraction operations - yields AModel with delayed ops.
 * Finds all pairs of terms that can be combined and creates a delayed operation for each.
 */
export function* applySum(model: AModel): Generator<AModel> {
  const tokens = model.tokens;
  const terms = extractTerms(tokens);

  // Collect all valid pairs with their costs, then sort by cost
  const pairs: Array<{ i: number; j: number; cost: number }> = [];

  // Find all pairs of terms that can be added
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (canAddTerms(terms[i], terms[j])) {
        // Determine effective operation based on signs
        const effectiveOp = terms[j].sign;
        const cost = calculateTermAddCost(terms[i], terms[j], effectiveOp);
        pairs.push({ i, j, cost });
      }
    }
  }

  // Sort pairs by cost (lowest first)
  pairs.sort((a, b) => a.cost - b.cost);

  // Yield models for each pair
  for (const { i, j } of pairs) {
    const termA = terms[i];
    const termB = terms[j];
    const effectiveOp = termB.sign;

    // Build the result
    let resultText: string;
    let delayedOp: DelayedOp;

    const refA = termA.refs[0];
    const refB = termB.refs[0];

    // Only create delayed op when:
    // 1. Both are digits, OR
    // 2. Both are expressions/variables with the same variables (and same power for variables)

    if (termA.isNumber && termB.isNumber) {
      // Case 1: Digit + Digit or Digit - Digit
      // Both must be digit type (pure numeric)
      if (refA.refType !== 'digit' || refB.refType !== 'digit') {
        continue;
      }
      delayedOp = effectiveOp === '+'
        ? { kind: 'add', left: refA, right: refB }
        : { kind: 'sub', left: refA, right: refB };
      resultText = `(${getRefText(refA)}${effectiveOp}${getRefText(refB)})`;

    } else if (termA.isVariable && termB.isVariable) {
      // Case 2a: Variable + Variable (same name and power)
      // Already validated by canAddTerms that variableName and power match
      if (effectiveOp === '+') {
        delayedOp = { kind: 'combine', terms: [refA, refB], op: '+' };
        const powerStr = termA.power !== 1 ? `^${termA.power}` : '';
        resultText = `(2*${termA.variableName}${powerStr})`;
      } else {
        // x - x = 0
        delayedOp = { kind: 'sub', left: refA, right: refB };
        resultText = '0';
      }

    } else if ((termA.isExpr || termB.isExpr) && areRefsCompatible(refA, refB)) {
      // Case 2b: Expression + Expression with same variables
      // Only combine if refs have identical variable sets
      const aVars = refA.variables ?? [];
      const bVars = refB.variables ?? [];

      // Strict check: must have same variables
      if (aVars.length === 0 && bVars.length === 0) {
        // Both are digit expressions - ok to combine
      } else if (aVars.length !== bVars.length) {
        continue; // Different variable count - skip
      } else {
        // Check all variables match
        const aSet = new Set(aVars);
        if (!bVars.every(v => aSet.has(v))) {
          continue; // Different variables - skip
        }
      }

      const aText = getRefText(refA);
      const bText = getRefText(refB);

      if (effectiveOp === '+') {
        delayedOp = { kind: 'add', left: refA, right: refB };
        resultText = `(${aText}+${bText})`;
      } else {
        delayedOp = { kind: 'sub', left: refA, right: refB };
        // Check if expressions are identical (cancel out)
        if (aText === bText) {
          resultText = '0';
        } else {
          resultText = `(${aText}-${bText})`;
        }
      }
    } else {
      continue; // Skip - not compatible for delayed op
    }

    const allSourceRefs = [...termA.refs, ...termB.refs];
    const resultRef = createDelayedRef(resultText, allSourceRefs, delayedOp);

    // Build new token array:
    // - Remove term B (and its preceding operator)
    // - Replace term A with result
    // We need to handle the operators carefully

    // Find the operator before term B (if any)
    const opBeforeB = termB.startIdx > 0 ? termB.startIdx - 1 : -1;

    // Build new tokens by:
    // 1. Keep everything before term A
    // 2. Insert result (with term A's sign if it's not the first term)
    // 3. Keep everything between term A and operator before B
    // 4. Skip operator before B and term B
    // 5. Keep everything after term B

    let newTokens: ARef[] = [];

    // Before term A
    newTokens.push(...tokens.slice(0, termA.startIdx));

    // The result (keep the sign if term A had one and wasn't first)
    if (termA.sign === '-' && termA.startIdx > 0) {
      newTokens.push(createAref('-'));
    }
    newTokens.push(resultRef);

    // Between term A end and operator before B
    if (opBeforeB > termA.endIdx) {
      newTokens.push(...tokens.slice(termA.endIdx, opBeforeB));
    }

    // After term B
    newTokens.push(...tokens.slice(termB.endIdx));

    const transformName = termA.isNumber
      ? `${effectiveOp === '+' ? 'add' : 'sub'}_${termA.startIdx}_${termB.startIdx}`
      : `combine_${termA.startIdx}_${termB.startIdx}`;

    yield createModel(model, transformName, newTokens, pairs.find(p => p.i === i && p.j === j)!.cost, resultRef);
  }
}
