import { AModel, createModel } from "./model.js";
import { calculateTermAddCost, canAddTerms } from "./terms.js";
import { ARef, createSymbolRef } from "./token.js";

/**
 * Apply addition/subtraction operations - yields AModel with computed results
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

  // Need at least 2 terms to combine
  if (termIndices.length < 2) {
    return;
  }

  // Try all valid pairs
  for (let i = 0; i < termIndices.length; i++) {
    for (let j = i + 1; j < termIndices.length; j++) {
      const iPos = termIndices[i];
      const jPos = termIndices[j];
      const refA = refs[iPos];
      const refB = refs[jPos];

      if (canAddTerms(refA, refB)) {
        // Determine operation by checking operator before refB
        const opBeforeB = jPos > 0 && refs[jPos - 1].refType === 'op' ? refs[jPos - 1] : null;
        const effectiveOp = (opBeforeB && opBeforeB.symbol === '-') ? '-' : '+';
        const cost = calculateTermAddCost(refA, refB, effectiveOp);

        // Create compute function for the operation
        const compute = () => {
          const aVal = refA.value;
          const bVal = refB.value;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return effectiveOp === '+' ? aVal + bVal : aVal - bVal;
          }
          return null;
        };

        const resultRef = createSymbolRef(model.cache, [refA, refB], undefined, compute);

        // Build new refs array
        const opIndexBeforeB = jPos > 0 && refs[jPos - 1].refType === 'op' ? jPos - 1 : -1;

        let newRefs: ARef[] = [];

        // Before refA
        newRefs.push(...refs.slice(0, iPos));

        // The result
        newRefs.push(resultRef);

        // Between refA and operator before refB
        const startAfterA = iPos + 1;
        const endBeforeOpB = opIndexBeforeB > 0 ? opIndexBeforeB : jPos;
        if (endBeforeOpB > startAfterA) {
          newRefs.push(...refs.slice(startAfterA, endBeforeOpB));
        }

        // After refB
        newRefs.push(...refs.slice(jPos + 1));

        const transformName = refA.refType === 'number'
          ? `${effectiveOp === '+' ? 'add' : 'sub'}_${iPos}_${jPos}`
          : `combine_${iPos}_${jPos}`;

        yield createModel(model, transformName, newRefs, cost, resultRef);
      }
    }
  }
}
