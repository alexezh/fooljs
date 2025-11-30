import { isLinearExpressionGoal } from "./goal.js";
import { ARef } from "./token.js";
import { calculateTermAddCost, calculateMultiplicationCost, canAddTerms, COST } from "./terms.js";
import { AModelSymbolCache } from "./asymbol.js";

export class AModel {
  parent?: AModel;
  transform: string;
  refs: ARef[];

  remainCost: number;

  /**
   * cost to full compute from 0. combined from past cost and estimated future cost
   */
  totalApproxCost: number;
  resultRef?: ARef;  // The ref created by this transform (also in tokens array)
  cache: AModelSymbolCache;

  constructor(params: {
    parent?: AModel;
    cache?: AModelSymbolCache;
    transform: string;
    refs: ARef[];
    totalApproxCost?: number;
    resultRef?: ARef;
    nextInternalVarNum?: number;
  }) {
    this.parent = params.parent;
    this.transform = params.transform;
    this.refs = params.refs;
    this.remainCost = getApproxCost(this);
    this.totalApproxCost = params.totalApproxCost ?? 0;
    this.resultRef = params.resultRef;

    // Inherit cache from parent or create new
    if (params.parent) {
      this.cache = params.parent.cache;
    } else {
      this.cache = params.cache!;
    }
  }
}

export function modelToKey(model: AModel): string {
  return model.refs.map(t => t.symbol).join('|');
}

/**
 * Create initial model from tokens
 * Converts sub-expressions to symbols using the model's cache
 */
export function createInitialModel(tokens: ARef[]): AModel {
  const model = new AModel({
    parent: undefined,
    transform: 'initial',
    refs: tokens,
    totalApproxCost: 0
  });

  return model;
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
  if (isLinearExpressionGoal(a.refs)) {
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
    if (term.refType === 'number') {
      key = 'number';
    } else if (term.refType === 'symbol') {
      const varName = term.symbol || '';
      const power = term.getPower();
      key = `${varName}^${power.value ?? 1}`;
    } else {
      // For other types, use the symbol as key
      key = `other:${term.symbol}`;
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

    if (key === 'number') {
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
  const operators = refs.filter(r => r.refType === 'op' && r.symbol && ['*', '/', '^'].includes(r.symbol));
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
