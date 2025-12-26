// ============================================================================
// Hierarchical policy tree (routing nodes + leaf pickers) with backtracking
// ============================================================================

import { AstNode } from "../ast.js";
import { Goal } from "./plannercore.js";
import { BoolVec, Choice } from "./policy.js";


export type NodeId = string;
export type ChildId = string;

// ------------------------------------
// Cost model (K dims) + rollback signal
// ------------------------------------
export type CostVec = number[]; // length K
export interface CostModel {
  cost(root: AstNode, goal: Goal): CostVec;
  // returns true if after is "worse enough" to trigger backtrack
  isWorse(before: CostVec, after: CostVec): boolean;
  // scalar reward used for updates (can be Δ in a key dim, or weighted, etc.)
  reward(before: CostVec, after: CostVec): number;
}

// Feature extraction is yours; keep minimal
export interface FeatureFn {
  extract(root: AstNode, goal: Goal): BoolVec; // e.g. 50 booleans
}

// Tracks decisions for credit assignment + rollback
export type DecisionRecord =
  | { kind: "route"; nodeId: NodeId; childId: ChildId; x: BoolVec }
  | { kind: "leaf"; nodeId: NodeId; skillId: string; x: BoolVec; focus: number[] };

export type StepRecord = {
  checkpointRoot: AstNode;
  checkpointCost: CostVec;
  decisions: DecisionRecord[]; // full path taken in tree
  chosen: Choice;
};
