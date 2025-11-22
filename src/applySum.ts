import { calculateTermAddCost, canAddTerms, extractTerms } from "./terms.js";
import { AModel, ARef, createAref, createDelayedRef, createModel, DelayedOp, getRefText } from "./token.js";

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

    if (termA.isNumber && termB.isNumber) {
      // Number + Number or Number - Number
      delayedOp = effectiveOp === '+'
        ? { kind: 'add', left: termA.refs[0], right: termB.refs[0] }
        : { kind: 'sub', left: termA.refs[0], right: termB.refs[0] };
      resultText = `(${getRefText(termA.refs[0])}${effectiveOp}${getRefText(termB.refs[0])})`;
    } else if (termA.isVariable && termB.isVariable) {
      // Like terms: x + x -> 2x, x - x -> 0
      const allRefs = [...termA.refs, ...termB.refs];
      if (effectiveOp === '+') {
        delayedOp = { kind: 'combine', terms: allRefs, op: '+' };
        const powerStr = termA.power !== 1 ? `^${termA.power}` : '';
        resultText = `(2*${termA.variableName}${powerStr})`;
      } else {
        // x - x = 0
        delayedOp = { kind: 'sub', left: termA.refs[0], right: termB.refs[0] };
        resultText = '0';
      }
    } else {
      continue; // Skip non-combinable pairs
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

    yield createModel(model, transformName, newTokens, pairs.find(p => p.i === i && p.j === j)!.cost);
  }
}
