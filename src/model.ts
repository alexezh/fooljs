import { AModel, ARef } from "./token";
import { heuristic } from "./weight";

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
