import { isGoal } from "./goal.js";
import { ARef, getRefText } from "./token.js";
import { calculateTermAddCost, calculateMultiplicationCost, canAddTerms, COST } from "./terms.js";

/**
 * Delayed operation to be executed at model level
 * Stores parent ARef and indexes for updating when operation executes
 */
export interface ModelDelayedOp {
  kind: 'add' | 'sub' | 'mul' | 'div' | 'pow' | 'combine';
  parentRef?: ARef;  // The composite ARef containing children to update
  indexes: number[]; // Indexes within parentRef.arefs (or model.refs if no parentRef)
  operation: any;    // Operation-specific data
  cost: number;      // Cost to execute this operation
  compute: (model: AModel, operation: any) => AModel;  // Function to perform the computation
}

class AModelInternalVars {
  /**
 * Cache mapping aref[] to internal variable names (e.g., ?1, ?2, ?3)
 * Key: serialized aref array (using getRefText)
 * Value: internal variable name
 */
  cache: Map<string, string> = new Map();
  private nextInternalVarNum: number = 1;

  /**
   * Get or create an internal variable for the given arefs
   */
  getInternalVar(arefs: ARef[]): string {
    const key = arefs.map(r => getRefText(r)).join('|');

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const varName = `?${this.nextInternalVarNum}`;
    this.cache.set(key, varName);
    this.nextInternalVarNum++;

    return varName;
  }
}

export class AModel {
  parent?: AModel;
  transform: string;
  refs: ARef[];

  delayedOp?: ModelDelayedOp;  // Single delayed operation for this model

  remainCost: number;

  /**
   * cost to full compute from 0. combined from past cost and estimated future cost
   */
  totalApproxCost: number;
  resultRef?: ARef;  // The ref created by this transform (also in tokens array)
  cache: AModelInternalVars;

  constructor(params: {
    parent?: AModel;
    transform: string;
    refs: ARef[];
    delayedOp?: ModelDelayedOp;
    totalApproxCost?: number;
    resultRef?: ARef;
    nextInternalVarNum?: number;
  }) {
    this.parent = params.parent;
    this.transform = params.transform;
    this.refs = params.refs;
    this.delayedOp = params.delayedOp;
    this.remainCost = getApproxCost(this);
    this.totalApproxCost = params.totalApproxCost ?? 0;
    this.resultRef = params.resultRef;

    // Inherit cache from parent or create new
    if (params.parent) {
      this.cache = params.parent.cache;
    } else {
      this.cache = new AModelInternalVars();
    }
  }
}

export function modelToKey(model: AModel): string {

  const refs = model.refs.map(t => getRefText(t)).join('|');
  return (model.delayedOp) ? "?" + refs : refs;
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
    } else if (term.isVariableRef(term)) {
      const varName = getVariableName(term) || '';
      const power = term.getPower();
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
    resultRef,
    cache: parent.cache,
    nextInternalVarNum: parent.nextInternalVarNum
  });
}
