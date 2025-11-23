import { calculateTermAddCost, canAddTerms } from "./terms.js";
import { AModel, ARef, createAref, createDelayedRef, createModel, DelayedOp, getRefText, areRefsCompatible, isVariableRef, getVariableName, getPower } from "./token.js";

/**
 * Apply sum/subtraction operations - yields AModel with delayed ops.
 * Finds all pairs of terms (role='term') that can be combined.
 */
export function* applySum(model: AModel): Generator<AModel> {
  const refs = model.refs;

  // Find all term indices (refs with role='term')
  const termIndices: number[] = [];
  for (let i = 0; i < refs.length; i++) {
    if (refs[i].role === 'term') {
      termIndices.push(i);
    }
  }

  // Collect all valid pairs with their costs
  const pairs: Array<{ iIdx: number; jIdx: number; iPos: number; jPos: number; cost: number }> = [];

  for (let i = 0; i < termIndices.length; i++) {
    for (let j = i + 1; j < termIndices.length; j++) {
      const iPos = termIndices[i];
      const jPos = termIndices[j];
      const refA = refs[iPos];
      const refB = refs[jPos];

      if (canAddTerms(refA, refB)) {
        const effectiveOp = refB.sign ?? '+';
        const cost = calculateTermAddCost(refA, refB, effectiveOp);
        pairs.push({ iIdx: i, jIdx: j, iPos, jPos, cost });
      }
    }
  }

  // Sort pairs by cost (lowest first)
  pairs.sort((a, b) => a.cost - b.cost);

  // Yield models for each pair
  for (const { iPos, jPos, cost } of pairs) {
    const refA = refs[iPos];
    const refB = refs[jPos];
    const effectiveOp = refB.sign ?? '+';

    let resultText: string;
    let delayedOp: DelayedOp;

    // Case 1: Both are digits
    if (refA.refType === 'digit' && refB.refType === 'digit') {
      delayedOp = effectiveOp === '+'
        ? { kind: 'add', left: refA, right: refB }
        : { kind: 'sub', left: refA, right: refB };
      resultText = `(${getRefText(refA)}${effectiveOp}${getRefText(refB)})`;
    }
    // Case 2: Both are variables (including with power from delayed ops)
    else if (isVariableRef(refA) && isVariableRef(refB)) {
      const aVarName = getVariableName(refA);
      const bVarName = getVariableName(refB);
      const aPower = getPower(refA);
      const bPower = getPower(refB);

      // Must have same variable name and power
      if (aVarName !== bVarName || aPower !== bPower) {
        continue;
      }

      if (effectiveOp === '+') {
        delayedOp = { kind: 'combine', terms: [refA, refB], op: '+' };
        const powerStr = aPower !== 1 ? `^${aPower}` : '';
        resultText = `(2*${aVarName}${powerStr})`;
      } else {
        // x - x = 0
        delayedOp = { kind: 'sub', left: refA, right: refB };
        resultText = '0';
      }
    }
    // Case 3: Expressions with compatible variables
    else if ((refA.refType === 'expr' || refB.refType === 'expr') && areRefsCompatible(refA, refB)) {
      const aVars = refA.variables ?? [];
      const bVars = refB.variables ?? [];

      // Check variables match
      if (aVars.length !== bVars.length && !(aVars.length === 0 && bVars.length === 0)) {
        continue;
      }
      if (aVars.length > 0) {
        const aSet = new Set(aVars);
        if (!bVars.every(v => aSet.has(v))) {
          continue;
        }
      }

      const aText = getRefText(refA);
      const bText = getRefText(refB);

      if (effectiveOp === '+') {
        delayedOp = { kind: 'add', left: refA, right: refB };
        resultText = `(${aText}+${bText})`;
      } else {
        delayedOp = { kind: 'sub', left: refA, right: refB };
        resultText = aText === bText ? '0' : `(${aText}-${bText})`;
      }
    }
    else {
      continue;
    }

    const resultRef = createDelayedRef(resultText, [refA, refB], delayedOp);

    // Build new token array:
    // - Remove refB and its preceding operator
    // - Replace refA with result

    // Find operator before refB (should be at jPos - 1)
    const opBeforeB = jPos > 0 && refs[jPos - 1].refType === 'op' ? jPos - 1 : -1;

    let newRefs: ARef[] = [];

    // Before refA
    newRefs.push(...refs.slice(0, iPos));

    // The result
    newRefs.push(resultRef);

    // Between refA and operator before refB
    const startAfterA = iPos + 1;
    const endBeforeOpB = opBeforeB > 0 ? opBeforeB : jPos;
    if (endBeforeOpB > startAfterA) {
      newRefs.push(...refs.slice(startAfterA, endBeforeOpB));
    }

    // After refB
    newRefs.push(...refs.slice(jPos + 1));

    const transformName = refA.refType === 'digit'
      ? `${effectiveOp === '+' ? 'add' : 'sub'}_${iPos}_${jPos}`
      : `combine_${iPos}_${jPos}`;

    yield createModel(model, transformName, newRefs, cost, resultRef);
  }
}
