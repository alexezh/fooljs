import { RuleBody, RuleId, RuleMeta, RuleTag, Runtime } from "./runtime.js";


/** Convenience tag bundles */
const T = {
  sum: ["sum"] as RuleTag[],
  mul: ["mul"] as RuleTag[],
  eq: ["eq"] as RuleTag[],
  eval: ["eval"] as RuleTag[],
  solve: ["solve"] as RuleTag[],
  step: ["step"] as RuleTag[],
  structural: ["structural"] as RuleTag[],
  simplify: ["simplify"] as RuleTag[],
  normalize: ["normalize"] as RuleTag[],
  compute: ["compute"] as RuleTag[],
  assoc: ["assoc"] as RuleTag[],
  neutral: ["neutral"] as RuleTag[],
  transcendental: ["transcendental"] as RuleTag[],
};

export function initRules(runtime: Runtime) {
  const rules: RuleMeta[] = [
    // -------------------------
    // Sum
    // -------------------------
    {
      id: "sum_assoc_left" as RuleId,
      rule: "sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)",
    },
    {
      id: "sum_assoc_mid" as RuleId,
      rule: "sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)",
    },
    {
      id: "sum_assoc_end" as RuleId,
      rule: "sum(?a, ?mid..., ?b) => sum(sum(?a, ?b), ?mid...)",
    },
    {
      id: "sum_neutral_drop_0" as RuleId,
      rule: "sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)",
    },
    {
      id: "sum_lift_to_eval_def" as RuleId,
      rule: "sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where[is_symbol_name(?y)]",
    },
    {
      id: "sum_factor_common_divisor" as RuleId,
      rule: "sum(?terms...) => mul(?x, sum(?quot...)) where[all_divisible_by([?terms...], ?x), [?quot...] := map_div([?terms...], ?x)]",
    },

    // -------------------------
    // Mul
    // -------------------------
    {
      id: "mul_assoc_left" as RuleId,
      rule: "mul(?a, ?b, ?rest...) => mul(prod(?a, ?b), ?rest...)",
    },
    {
      id: "mul_neutral_drop_1_right" as RuleId,
      rule: "mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)",
    },
    {
      id: "mul_neutral_drop_1_left" as RuleId,
      rule: "mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)",
    },
    {
      id: "mul_zero_to_0_right" as RuleId,
      rule: "mul(?args..., 0, ?rest...) => 0",
    },
    {
      id: "mul_zero_to_0_left" as RuleId,
      rule: "mul(?args..., 0, ?rest...) => 0",
    },

    // -------------------------
    // Div
    // -------------------------
    {
      id: "div_neutral_by_1" as RuleId,
      rule: "div(?a, 1) => ?a",
    },
    {
      id: "div_self_to_1" as RuleId,
      rule: "div(?a, ?a) => 1",
    },

    // -------------------------
    // Paren / Neg / Sub
    // -------------------------
    {
      id: "paren_remove" as RuleId,
      rule: "paren(?a) => ?a",
    },
    {
      id: "sub_to_sum_neg" as RuleId,
      rule: "sub(?a, ?b) => sum(?a, neg(?b))",
    },
    {
      id: "neg_double" as RuleId,
      rule: "neg(neg(?a)) => ?a",
    },
    {
      id: "neg_zero" as RuleId,
      rule: "neg(0) => 0",
    },
    {
      id: "add_inverse_to_0" as RuleId,
      rule: "add(?a, neg(?a)) => 0",
    },

    // -------------------------
    // Special transforms
    // -------------------------
    {
      id: "sum_to_mul_count" as RuleId,
      rule: "sum(?a, ?rest...) => mul(?n, ?a) where[ all_eq([?a, ?rest...], ?a), ?n := count([?a, ?rest...]) ]"
    },
{
  id: "mul_to_sum_repeat" as RuleId,
    rule: "mul(?n, ?a) => sum(?a, ?rest...) where[is_number(?n)]",
    },

// -------------------------
// Eq / Solve / Step / Eval
// -------------------------
{
  id: "eq_normalize_to_zero_form" as RuleId,
    rule: "eq(?a, ?b) => eq(sum(?a, neg(?b)), 0)",
    },
{
  id: "eq_move_addend_general" as RuleId,
    rule: "eq(sum(?t, ?c), ?rhs) => eq(?t, sum(?rhs, neg(?c)))",
    },
{
  id: "eval_eq_both_sides" as RuleId,
    rule: "eval(eq(?a, ?b)) => eq(eval(?a), eval(?b))",
    },
{
  id: "eq_divide_both_sides_left_mul" as RuleId,
    rule: "eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k))",
    },
{
  id: "eq_divide_both_sides_right_mul" as RuleId,
    rule: "eq(?b, mul(?k, ?x)) => eq(div(?b, ?k), ?x)",
    },
{
  id: "solve_goal_met" as RuleId,
    rule: "solve(?e, ?p) => ?e",
    },
{
  id: "solve_eq_normalize" as RuleId,
    rule: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))",
    },
{
  id: "solve_linear_match" as RuleId,
    rule: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve_linear(eq(?lhs, ?rhs), solved_for(?x)) where[or(linear_in(?lhs, ?x), linear_in(?rhs, ?x))]",
    },
{
  id: "solve_isolated_left" as RuleId,
    rule: "solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs",
    },
{
  id: "solve_isolated_right" as RuleId,
    rule: "solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs",
    },

// {
//   id: "step_via_eval_progress" as RuleId,
//   rule: "step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)",
// },
// {
//   id: "solve_driver_step" as RuleId,
//   rule: "solve(?e, ?p) => solve(?e1, ?p) where step(?e) => ?e1",
// },

{
  id: "eval_number" as RuleId,
    rule: "eval(?n) => ?n where[is_number(?n)]",
    },
{
  id: "eval_symbol" as RuleId,
    rule: "eval(sym(?x)) => sym(?x) where[is_symbol_name(?x)]",
    },
{
  id: "eval_progressive" as RuleId,
    rule: "eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where[is_func_name(?f)]",
    },
{
  id: "eval_collapse" as RuleId,
    rule: "eval(eval(?x)) => eval(?x)",
    },

// -------------------------
// Eval compute rules
// -------------------------

// Direct compute (no eval wrapper)

// -------------------------
// Transcendentals
// -------------------------





// -------------------------
// Fold (generic)
// -------------------------
{
  id: "fold_base" as RuleId,
    rule: "fold(?f, ?acc, []) => ?acc",
    },
{
  id: "fold_step" as RuleId,
    rule: "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
    },

// -------------------------
// Group same terms
// -------------------------
{
  id: "group_same" as RuleId,
    rule: "group_same(sum(?terms...), ?target) => rebuild_group(fold(bucket_same(?target), acc(pick(), rest()), [?terms...]))",
    },
{
  id: "bucket_same_pick" as RuleId,
    rule: "bucket_same(?target, acc(pick(?p...), rest(?r...)), ?t) => acc(pick(?p..., ?t), rest(?r...)) where[eq_ast(?t, ?target)]",
    },
{
  id: "bucket_same_rest" as RuleId,
    rule: "bucket_same(?target, acc(pick(?p...), rest(?r...)), ?t) => acc(pick(?p...), rest(?r..., ?t))",
    },
{
  id: "rebuild_group" as RuleId,
    rule: "rebuild_group(acc(pick(?p...), rest(?r...))) => sum(?p..., ?r...)",
    },

    // -------------------------
    // Solve linear (added by you)
    // -------------------------
    // {
    //   id: "solve_simple_linear",
    //   rule: "solve(eq(sum(?x, ?c), 0), solved_for(?x)) => neg(?c)",
    // },
    // {
    //   id: "solve_linear_kx_plus_c",
    //   rule: "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)",
    // },
  ];

// let x: RuleMeta = {
//   id: "eq_move_addend_general" as RuleId,
//   // rule: "eq(sum(?t, ?c), ?rhs) => eq(?t, sum(?rhs, neg(?c)))",
//   rule: "bucket_same(?target, acc(pick(?p...), rest(?r...)), ?t) => acc(pick(?p..., ?t), rest(?r...)) where[eq_ast(?t, ?target), eq_ast(?t, ?target)]",
// };
// let rule = add(runtime, x);

// let func = astCreateMatcher(rule);
//func(matcherSymbols,);

for (const r of rules) {
  runtime.ruleCache.compileRule(r.rule as RuleBody, r.id as RuleId);
}
}

