export type FeatureId =
  | "has_eq"
  | "has_solve"
  | "has_sum"
  | "has_mul"
  | "has_div"
  | "has_neg"
  | "has_pow"
  | "has_sqrt"
  | "has_log"
  | "has_exp"
  | "has_eval"
  | "has_sub"
  | "many_terms_sum"
  | "many_factors_mul"
  | "eq_rhs_zero"
  | "eq_lhs_zero"
  | "goal_solve_for"
  | "target_present"
  | "target_degree_ge_2"
  | "target_degree_ge_3"
  | "target_in_denominator"
  | "has_cross_term";

export interface FeatureRule {
  id: FeatureId;
  // Same syntax style as your rules, but RHS is feature(...)
  rule: string;
}

// Notes:
// - root(?r) is a conventional "entry" wrapper so all rules match the same input.
// - exists(PATTERN) is a predicate meaning PATTERN is found in some subtree.
// - count(PATTERN) returns integer (number of matches in subtree).
// - goal_is(solve_for) / goal_sym(?x) are predicates reading goal from context.
// - max_degree(?r, ?x) is derived; you can implement syntactically (sum=max, mul=sum, pow=exp, etc).
export const FEATURE_RULES: FeatureRule[] = [
  // --- core operators present anywhere ---
  { id: "has_eq", rule: "root(?r) => feature(has_eq)   where[exists(eq(?a, ?b), ?r)]" },
  { id: "has_solve", rule: "root(?r) => feature(has_solve) where[exists(solve(?e, ?p), ?r)]" },
  { id: "has_sum", rule: "root(?r) => feature(has_sum)  where[exists(sum(?xs...), ?r)]" },
  { id: "has_mul", rule: "root(?r) => feature(has_mul)  where[exists(mul(?xs...), ?r)]" },
  { id: "has_div", rule: "root(?r) => feature(has_div)  where[exists(div(?a, ?b), ?r)]" },
  { id: "has_neg", rule: "root(?r) => feature(has_neg)  where[exists(neg(?a), ?r)]" },
  { id: "has_pow", rule: "root(?r) => feature(has_pow)  where[exists(pow(?a, ?b), ?r)]" },
  { id: "has_sqrt", rule: "root(?r) => feature(has_sqrt) where[exists(sqrt(?a), ?r)]" },
  { id: "has_log", rule: "root(?r) => feature(has_log)  where[exists(log(?a), ?r)]" },
  { id: "has_exp", rule: "root(?r) => feature(has_exp)  where[exists(exp(?a), ?r)]" },
  { id: "has_eval", rule: "root(?r) => feature(has_eval) where[exists(eval(?a), ?r)]" },
  { id: "has_sub", rule: "root(?r) => feature(has_sub)  where[exists(sub(?a, ?b), ?r)]" },

  // --- “many-args” signals (structural) ---
  // count(sum(?xs...)) returns number of args for a *matched* sum node.
  {
    id: "many_terms_sum",
    rule: "root(?r) => feature(many_terms_sum) where[exists(sum(?xs...), ?r), count_args(?xs...) >= 4]"
  },

  {
    id: "many_factors_mul",
    rule: "root(?r) => feature(many_factors_mul) where[exists(mul(?xs...), ?r), count_args(?xs...) >= 4]"
  },

  // --- equation shape ---
  {
    id: "eq_rhs_zero",
    rule: "root(?r) => feature(eq_rhs_zero) where[exists(eq(?lhs, 0), ?r)]"
  },

  {
    id: "eq_lhs_zero",
    rule: "root(?r) => feature(eq_lhs_zero) where[exists(eq(0, ?rhs), ?r)]"
  },

  // --- goal / target-variable dependent features ---
  {
    id: "goal_solve_for",
    rule: "root(?r) => feature(goal_solve_for) where[goal_is(solve_for)]"
  },

  {
    id: "target_present",
    rule: "root(?r) => feature(target_present) where[goal_is(solve_for), goal_sym(?x), exists(?x, ?r)]"
  },

  // target degree heuristics (syntactic, computed by derived predicate)
  {
    id: "target_degree_ge_2",
    rule: "root(?r) => feature(target_degree_ge_2) where[goal_is(solve_for), goal_sym(?x), max_degree(?r, ?x) >= 2]"
  },

  {
    id: "target_degree_ge_3",
    rule: "root(?r) => feature(target_degree_ge_3) where[goal_is(solve_for), goal_sym(?x), max_degree(?r, ?x) >= 3]"
  },

  // target in denominator: exists div(_, denom) where denom contains x OR pow(x, neg(NUM)) patterns
  {
    id: "target_in_denominator",
    rule:
      "root(?r) => feature(target_in_denominator) where[" +
      "goal_is(solve_for), goal_sym(?x), " +
      "or(" +
      "  exists(div(?a, ?d), ?r) where[contains_sym(?d, ?x)]," +
      "  exists(pow(?x, neg(?k)), ?r)" +
      ")" +
      "]"
  },

  // cross term: a mul node contains >=2 distinct symbols (derived predicate)
  {
    id: "has_cross_term",
    rule: "root(?r) => feature(has_cross_term) where[exists(mul(?xs...), ?r), distinct_sym_count(?xs...) >= 2]"
  },
];