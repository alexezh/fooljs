import { ARef, getRefText } from "./token.js";
import { heuristic } from "./weight.js";

export interface AModel {
  parent?: AModel;
  transform: string;
  refs: ARef[];

  pendingOp?: (model: AModel) => AModel;
  pendingOpCost?: number;

  /**
   * cost to full compute from 0. combined from past cost and estimated future cost
   */
  approxCost: number;
  resultRef?: ARef;  // The ref created by this transform (also in tokens array)
}

export function modelToKey(model: AModel): string {

  return model.refs.map(t => getRefText(t)).join('|');
  //return tokensToKey(model.refs);
}

/**
 * Create initial model from tokens
 */
export function createInitialModel(tokens: ARef[]): AModel {
  return {
    parent: undefined,
    transform: 'initial',
    refs: tokens,
    approxCost: 0
  };
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

export function getApproxCost(a: AModel): number {
  if (a.approxCost !== undefined) {
    return a.approxCost;
  }

  a.approxCost = heuristic(a.refs);
  return a.approxCost;
}

export function createModel(
  parent: AModel,
  transform: string,
  tokens: ARef[],
  cost: number,
  resultRef?: ARef
): AModel {
  return {
    parent,
    transform,
    refs: tokens,
    approxCost: parent.approxCost + cost,
    resultRef
  };
}
