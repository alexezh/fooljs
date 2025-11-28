import { isGoal } from "./goal.js";
import { ARef, getRefText, isVariableRef, getVariableName, getPower } from "./token.js";
import { calculateTermAddCost, calculateMultiplicationCost, canAddTerms, COST } from "./terms.js";

export class AModel {
  parent?: AModel;
  transform: string;
  refs: ARef[];

  pendingOp?: (model: AModel) => AModel;
  pendingOpCost?: number;

  remainCost: number;

  /**
   * cost to full compute from 0. combined from past cost and estimated future cost
   */
  totalApproxCost: number;
  resultRef?: ARef;  // The ref created by this transform (also in tokens array)

  constructor(params: {
    parent?: AModel;
    transform: string;
    refs: ARef[];
    pendingOp?: (model: AModel) => AModel;
    pendingOpCost?: number;
    totalApproxCost?: number;
    resultRef?: ARef;
  }) {
    this.parent = params.parent;
    this.transform = params.transform;
    this.refs = params.refs;
    this.pendingOp = params.pendingOp;
    this.pendingOpCost = params.pendingOpCost;
    this.remainCost = getApproxCost(this);
    this.totalApproxCost = params.totalApproxCost ?? 0;
    this.resultRef = params.resultRef;
  }
}

export function modelToKey(model: AModel): string {

  return model.refs.map(t => getRefText(t)).join('|');
  //return tokensToKey(model.refs);
}

/**
 * Create initial model from tokens
 */
export function createInitialModel(tokens: ARef[]): AModel {
  return new AModel({
    parent: undefined,
    transform: 'initial',
    refs: tokens,
    totalApproxCost: 0
  });
}

/**
 * Get the path from root to this model
 */
export function getModelPath(model: AModel): AModel[] {
  const path: AModel[] = [];
  let current: AModel | undefined = model;
  while (current) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

// Maximum assumed value for expression estimation (used when actual value unknown)
const MAX_EXPR_VALUE = 100;

function getApproxCost(a: AModel): number {
  // Goal state has zero remaining cost
  if (isGoal(a.refs)) {
    return 0;
  }

  const refs = a.refs;

  // Find all terms (potential operands for addition/subtraction)
  const terms: ARef[] = [];
  for (const ref of refs) {
    if (ref.role === 'term') {
      terms.push(ref);
    }
  }

  // If only one term or no terms, we're close to done
  if (terms.length <= 1) {
    // Still need to handle operators and factors
    return refs.filter(r => r.refType !== 'op').length;
  }

  // Group terms by compatibility (like terms)
  const groups = new Map<string, ARef[]>();

  for (const term of terms) {
    let key: string;
    if (term.refType === 'digit') {
      key = 'digit';
    } else if (isVariableRef(term)) {
      const varName = getVariableName(term) || '';
      const power = getPower(term);
      key = `${varName}^${power}`;
    } else {
      // For expressions, use the text as key (simplified)
      key = `expr:${getRefText(term)}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(term);
  }

  let estimatedCost = 0;

  // Estimate cost to combine each group
  for (const [key, groupTerms] of groups.entries()) {
    if (groupTerms.length <= 1) continue;

    // Number of operations needed to combine all terms in this group
    const numOps = groupTerms.length - 1;

    if (key === 'digit') {
      // Estimate cost for combining numbers
      // Assume average case with MAX_EXPR_VALUE
      const avgCost = COST.ADD_PER_DIGIT * Math.log10(MAX_EXPR_VALUE);
      estimatedCost += numOps * avgCost;
    } else if (key.startsWith('expr:')) {
      // Expression combinations
      estimatedCost += numOps * COST.EXPR_COMBINE_COST;
    } else {
      // Variable combinations
      estimatedCost += numOps * COST.VAR_COMBINE_COST;
    }
  }

  // Estimate cost to reduce different groups to final result
  const numGroups = groups.size;
  if (numGroups > 1) {
    // Additional cost to combine different types of terms
    estimatedCost += (numGroups - 1) * COST.VAR_BASE_COST;
  }

  // Add cost for any remaining operators (multiply, divide, power)
  const operators = refs.filter(r => r.refType === 'op' && ['*', '/', '^'].includes(getRefText(r)));
  if (operators.length > 0) {
    // Estimate multiplication/division costs
    estimatedCost += operators.length * COST.MUL_SINGLE_DIGIT * Math.log10(MAX_EXPR_VALUE);
  }

  return estimatedCost;
}


export function createModel(
  parent: AModel,
  transform: string,
  tokens: ARef[],
  cost: number,
  resultRef?: ARef
): AModel {
  return new AModel({
    parent,
    transform,
    refs: tokens,
    totalApproxCost: parent.totalApproxCost + cost,
    resultRef
  });
}
