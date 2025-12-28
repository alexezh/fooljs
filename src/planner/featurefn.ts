import type { AstNode } from "../ast.ts";
import type { Goal } from "./plannercore.ts";

export type BoolVec = boolean[];

// You already have something like this.
export interface FeatureFn {
  extract(root: AstNode, goal: Goal): BoolVec; // length N
}

// Basic, robust feature extractor for arithmetic ASTs.
// Assumptions (duck-typed):
// - Number literals: number | { type/kind: "num"/"number", value: number }
// - Symbols: string | { type/kind: "sym"/"symbol", name: string }
// - Calls: { type/kind: "call"/"app"/"op", op/name: string, args: AstNode[] }
// Common ops: sum, mul, div, neg, pow/power, sqrt, log, exp, eq, solve
//
// Output BoolVec has a fixed layout (see FEATURE_INDEX below).
// If your AST differs, just adjust getOp/getArgs/isNum/isSym.

export const FEATURE_INDEX = {
  // structure
  has_eq: 0,
  has_solve: 1,

  // ops present
  has_sum: 2,
  has_mul: 3,
  has_div: 4,
  has_neg: 5,
  has_pow: 6,
  has_sqrt: 7,
  has_log: 8,
  has_exp: 9,

  // constants/symbols
  has_num: 10,
  has_sym: 11,
  has_many_terms_sum: 12,     // some sum with >= 4 args
  has_many_factors_mul: 13,   // some mul with >= 4 args

  // power/degree signals (global)
  has_numeric_power: 14,      // pow(base, NUM)
  has_non_numeric_power: 15,  // pow(base, non-NUM)
  max_power_ge_2: 16,
  max_power_ge_3: 17,

  // goal-related / target-var degree (approx)
  goal_solve_for: 18,
  target_present: 19,
  target_linear: 20,          // max deg(target) == 1
  target_quadratic: 21,       // max deg(target) == 2
  target_degree_ge_3: 22,     // max deg(target) >= 3
  target_in_denominator: 23,  // target appears inside divisor (div(_, denom) or pow(target, -k))
  has_cross_term: 24,         // mul has >=2 distinct symbols anywhere

  // equation flavor
  eq_rhs_is_zero: 25,
  eq_lhs_is_zero: 26,

  // size-ish
  ast_large: 27,              // node count >= threshold
} as const;

export const FEATURE_COUNT = 28;
