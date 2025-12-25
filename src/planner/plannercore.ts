import { AstNode } from "../ast";
import type { Runtime } from "../runtime";

export type Path = Array<number>; // e.g. child indices from root

export type Goal =
  | { kind: "compute" }
  | { kind: "simplify" }
  | { kind: "solve" } // variable name (or your ASymbol)
  | { kind: "solve_for"; x: string } // variable name (or your ASymbol)
  | { kind: "normalize" };

// ----------------------------
// 1) Features (pluggable, no AST details here)
// ----------------------------

export type FeatureVector = Record<string, number | boolean | string>;

export interface FeatureExtractor {
  // Return features for (root, goal, focusPath)
  extract(runtime: Runtime, root: AstNode, goal: Goal, focus: Path): FeatureVector;

  // Optional: compute a scalar progress score for reward shaping
  // (bigger is better)
  score?(runtime: Runtime, root: AstNode, goal: Goal): number;
}

// ----------------------------
// 2) Candidate focus selection (where in AST to act)
// ----------------------------

export interface FocusSelector {
  // Return a list of focus points (paths). Keep it bounded.
  select(runtime: Runtime, root: AstNode, goal: Goal, maxFocus: number): Path[];
}

