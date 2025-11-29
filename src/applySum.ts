import { AModel, createModel, ModelDelayedOp } from "./model.js";
import { calculateTermAddCost, canAddTerms, COST } from "./terms.js";
import { ARef, createDelayedRef, DelayedOp, getRefText, areRefsCompatible, isVariableRef, getVariableName, getPower } from "./token.js";

/**
 * Scanned term pair info for pending realization
 */
interface TermPair {
  iPos: number;
  jPos: number;
  cost: number;
}

/**
 * Part 1: Scan for terms and create model with pendingOp.
 * Scanning cost is proportional to number of terms.
 * Returns a model with pendingOp that will generate actual pair combinations.
 */
export function* applySumScan(model: AModel): Generator<AModel> {
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

  // Collect all valid pairs with their costs
  const pairs: TermPair[] = [];

  for (let i = 0; i < termIndices.length; i++) {
    for (let j = i + 1; j < termIndices.length; j++) {
      const iPos = termIndices[i];
      const jPos = termIndices[j];
      const refA = refs[iPos];
      const refB = refs[jPos];

      if (canAddTerms(refA, refB)) {
        const effectiveOp = refB.sign ?? '+';
        const cost = calculateTermAddCost(refA, refB, effectiveOp);
        pairs.push({ iPos, jPos, cost });
      }
    }
  }

  if (pairs.length === 0) {
    return;
  }

  // Sort pairs by cost (lowest first)
  pairs.sort((a, b) => a.cost - b.cost);

  // Scan cost: proportional to number of terms
  const scanCost = termIndices.length * COST.ADD_SINGLE_DIGIT;

  // Create model with delayedOp for each pair
  for (const pair of pairs) {
    const delayedOp: ModelDelayedOp = {
      kind: 'add',
      indexes: [pair.iPos, pair.jPos],
      operation: pair,
      cost: pair.cost,
      compute: (m: AModel, op: any) => realizeSumPair(m, op as TermPair)
    };

    const pendingModel = new AModel({
      parent: model,
      transform: `sum_scan_${pair.iPos}_${pair.jPos}`,
      refs: refs, // Keep same refs - not realized yet
      totalApproxCost: model.totalApproxCost + scanCost,
      delayedOp
    });

    yield pendingModel;
  }
}

/**
 * Part 2: Realize a single term pair combination.
 * Called when search decides to expand a pending sum operation.
 */
export function realizeSumPair(model: AModel, pair: TermPair): AModel {
  const refs = model.refs;
  const { iPos, jPos, cost } = pair;

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
  // Case 2: Both are variables
  else if (isVariableRef(refA) && isVariableRef(refB)) {
    const aVarName = getVariableName(refA)!;
    const aPower = getPower(refA);

    if (effectiveOp === '+') {
      delayedOp = { kind: 'combine', terms: [refA, refB], op: '+' };
      const powerStr = aPower !== 1 ? `^${aPower}` : '';
      resultText = `(2*${aVarName}${powerStr})`;
    } else {
      delayedOp = { kind: 'sub', left: refA, right: refB };
      resultText = '0';
    }
  }
  // Case 3: Expressions
  else {
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

  const resultRef = createDelayedRef(resultText, [refA, refB], delayedOp);

  // Build new refs array
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

  return createModel(model, transformName, newRefs, cost, resultRef);
}

/**
 * Direct sum application - executes delayed operations immediately.
 */
export function* applySum(model: AModel): Generator<AModel> {
  for (const pendingModel of applySumScan(model)) {
    if (pendingModel.delayedOp) {
      const pair = pendingModel.delayedOp.operation as TermPair;
      yield realizeSumPair(pendingModel, pair);
    } else {
      yield pendingModel;
    }
  }
}
