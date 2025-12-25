import { AstNode, ASymbol, Constraint, MatchFunc, MatchFuncRet } from "./ast.js";
import { parse } from "./parser.js";
import { Goal, Path } from "./planner/plannercore.js";
import type { RuleCache } from "./rulecache.js";
//import { StateManager, StateGuard } from "./state.js";
import type { SkillRegistry } from "./skillregistry.js";
import type { ConstraintFunctionRegistry } from "./constraintfuncs.js";

export type RuleId = string & { __tag_ruleid: never };
export type SkillId = string & { __tag_skillid: never };
export type RuleBody = string & { __tag_rulebody: never };

export type RuleTag =
  | "sum" | "mul" | "div" | "neg" | "paren"
  | "eq" | "solve" | "eval" | "step"
  | "assoc" | "neutral" | "normalize" | "compute" | "simplify"
  | "structural" | "progress" | "fold" | "list"
  | "transcendental" | "power" | "sqrt" | "log" | "exp"
  | "danger_expand"
  | "isolate"
  | "group" | "bucket" | "rebuild"
  | "factor" | "progress"
  | "linear" | "compute" | "progress"; // e.g. rules that can blow up size (keep for future)

export interface RuleMeta {
  // deprecated
  id?: RuleId;
  rule: string;
  // deprecated
  tags?: RuleTag[];
  /**
   * matches first occurance of rule in input
   */
  fn?: MatchFunc;
}


export type RuleNode = {
  def: string,
  pattern: AstNode,
  match: AstNode,
  constraints?: Constraint[],
  matchFunc: MatchFunc
}

export interface Runtime {
  get skillRegistry(): SkillRegistry;
  get ruleCache(): RuleCache;
  get constraintRegistry(): ConstraintFunctionRegistry;

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

  // Optional: goal checks
  goalMet(root: AstNode, goal: Goal): boolean;

  // Equivalence / validation
  // For arithmetic you can do random testing; for many transforms use canonical forms.
  equivalent(a: AstNode, b: AstNode): boolean;

  // Used for generating test cases
  // (or you can supply your own generator)
  sampleGrounding?(root: AstNode): Record<string, number>; // e.g., {x: 3, y: -1}
  evalWithEnv?(expr: AstNode, env: Record<string, number>): number; // optional
  parseExpr?(exprStr: string): AstNode; // for pattern parsing
  matchPattern?(pattern: AstNode, expr: AstNode): Map<string, AstNode> | undefined; // for matching
}
