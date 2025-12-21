import { AstNode, ASymbol, Constraint, MatchFunc, MatchFuncRet } from "./ast.js";
import { parse } from "./parser.js";
import { Goal, Path } from "./planner/plannercore.js";
//import { StateManager, StateGuard } from "./state.js";

export type RuleNode = {
  def: string,
  pattern: AstNode,
  match: AstNode,
  constraints?: Constraint[],
  matchFunc: MatchFunc | undefined
}

export interface Runtime {
  addRule(args: string, matchFunc: MatchFunc | undefined): void;
  matchRule(inp: AstNode): MatchFuncRet[];

  // Tree navigation / update
  /**
   * return astnode based on path
   */
  getAt(root: AstNode, path: Path): AstNode;

  /**
   * replaces node based on path, returns new root
   */
  setAt(root: AstNode, path: Path, newSubtree: AstNode): AstNode;

  /**
   * walk all nodes starting from root
   */
  walk(root: AstNode, cb: (node: AstNode, path: Path) => void): void;

  // Matching and rule application (you have these already)
  matches(patternStr: string, node: AstNode): boolean;

  /**
   * return ast node to root
   */
  tryApplyRuleAt(ruleId: string, root: AstNode, path: Path): AstNode | null;

  // Optional: goal checks
  goalMet(root: AstNode, goal: Goal): boolean;

  // Equivalence / validation
  // For arithmetic you can do random testing; for many transforms use canonical forms.
  equivalent(a: AstNode, b: AstNode): boolean;

  // Used for generating test cases
  // (or you can supply your own generator)
  sampleGrounding?(root: AstNode): Record<string, number>; // e.g., {x: 3, y: -1}
  evalWithEnv?(expr: AstNode, env: Record<string, number>): number; // optional
}

