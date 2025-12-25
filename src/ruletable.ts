import { AstNode, MatchFunc } from "./ast.js";
import { RuleId, RuleMeta, RuleTag, Runtime } from "./runtime.js";
import { ruleEqDivideBothSidesLeftMul, ruleEqDivideBothSidesRightMul, ruleEqMoveAddendGeneral, ruleEqNormalize, ruleEqSymmetry, ruleEvalEq, ruleParenRemove } from "./rules/corerules.js";
import { ruleSolveEqIsolatedRight, ruleSolveLinear, ruleSolveLinearMatch, ruleSolveSimpleLinear } from "./rules/equation.js";
import { ruleEvalCollapse, ruleEvalDef, ruleEvalDefSimplify, ruleEvalNeg, ruleEvalNumber, ruleEvalProgressive, ruleEvalSum, ruleEvalSymbol } from "./rules/eval.js";
import { ruleSolveGoalMet } from "./rules/goals.js";
import { ruleCalcDiv, ruleCalcMul, ruleDivNeutralRight, ruleDivSelfToOne, ruleEvalDiv, ruleEvalMul, ruleMulAssocLeft, ruleMulCommutative, ruleMulNeutralLeft, ruleMulNeutralRight, ruleMulToSum, ruleMulZeroLeft, ruleMulZeroRight, ruleSumToMul } from "./rules/mul.js";
import { ruleSolveEqIsolatedLeft, ruleSolveEqNormalize } from "./rules/solverules.js";
import { ruleAssocEnd, ruleAssocLeft, ruleAssocMid, ruleCalcNeg, ruleCalcSum, ruleCommutative, ruleDoubleNeg, ruleLiftSum, ruleNegZero, ruleNeutralRight, ruleSubToSum, ruleSumNegSelf, ruleSwapEnds } from "./rules/sum.js";
import { ruleCalcExp, ruleCalcLn, ruleCalcLogBase, ruleCalcPow, ruleCalcSqrt, ruleEvalExp, ruleEvalLn, ruleEvalLogBase, ruleEvalPow, ruleEvalPowBase0Pos, ruleEvalPowBase1, ruleEvalPowExp0, ruleEvalPowExp1, ruleEvalSqrt, ruleExpLn, ruleExpZero, ruleLn1, ruleLnExp, ruleSqrt2, ruleSqrtToPow } from "./rules/transcendental.js";
import { ruleCombineLikeTerms, ruleCombineNumbers, ruleFactorCommonDivisor, ruleSubExpandSum } from "./rules/simplify.js";
import { ruleBucketSamePick, ruleBucketSameRest, ruleCollectMulNonNumber, ruleCollectMulNumber, ruleCollectSumNonNumber, ruleCollectSumNumber, ruleFoldBase, ruleFoldStep, ruleGroupSame, ruleMulFold, ruleRebuildGroup, ruleSumFold } from "./rules/fold.js";

export const coreRuleFunctions = [
  ruleAssocLeft,          // 0
  ruleAssocMid,           // 1
  ruleCommutative,        // 2
  ruleSwapEnds,           // 3
  ruleNeutralRight,       // 4
  ruleLiftSum,            // 6
  ruleEvalNumber,         // 7
  ruleEvalSymbol,         // 8
  ruleEvalProgressive,    // 9
  ruleEvalCollapse,       // 10
  ruleEvalDef,            // 11
  ruleEvalDefSimplify,    // 12
  ruleEvalSum,            // 13
  ruleEvalMul,            // 14
  ruleEvalDiv,            // 15
  ruleEvalNeg,            // 16
  ruleMulAssocLeft,       // 17
  ruleMulCommutative,     // 18
  ruleMulNeutralRight,    // 19
  ruleMulNeutralLeft,     // 20
  ruleMulZeroRight,       // 21
  ruleMulZeroLeft,        // 22
  ruleDivNeutralRight,    // 23
  ruleDivSelfToOne,       // 24
  ruleParenRemove,        // 25
  ruleSubToSum,           // 26
  ruleDoubleNeg,          // 27
  ruleNegZero,            // 28
  ruleSumNegSelf,         // 29
  ruleSumToMul,           // 30
  ruleMulToSum,           // 31
  // Equation rules
  ruleEqSymmetry,         // 32
  ruleEvalEq,             // 33
  // Solve rules
  ruleSolveGoalMet,       // 34
  ruleSolveEqNormalize,   // 35
  ruleSolveEqIsolatedLeft,// 36
  ruleSolveEqIsolatedRight,// 37
  ruleSolveLinear,        // 38
  ruleSolveSimpleLinear,  // 39
  // Step rules
  // ruleStep,               // 40
  // ruleSolveStep,          // 41
  // Transcendental functions
  ruleEvalPow,            // 42
  ruleEvalPowExp1,        // 43
  ruleEvalPowExp0,        // 44
  ruleEvalPowBase1,       // 45
  ruleEvalPowBase0Pos,    // 46
  ruleEvalSqrt,           // 47
  ruleSqrt2,              // 48
  ruleSqrtToPow,          // 49
  ruleEvalLn,             // 50
  ruleEvalLogBase,        // 51
  ruleLn1,                // 52
  ruleLnExp,              // 53
  ruleEvalExp,            // 54
  ruleExpLn,              // 55
  ruleExpZero,            // 56
  // Simplification rules
  ruleCombineLikeTerms,   // 57
  ruleSubExpandSum,       // 58
  ruleCombineNumbers,     // 59
  ruleFactorCommonDivisor // 60
];


function add(runtime: Runtime, m: RuleMeta) {
  runtime.ruleCache.addRule(m);
}

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
      fn: ruleAssocLeft,
      tags: [...T.sum, ...T.structural, ...T.assoc],
    },
    {
      id: "sum_assoc_mid" as RuleId,
      rule: "sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)",
      fn: ruleAssocMid,
      tags: [...T.sum, ...T.structural, ...T.assoc],
    },
    {
      id: "sum_assoc_end" as RuleId,
      rule: "sum(?a, ?mid..., ?b) => sum(sum(?a, ?b), ?rest...)",
      fn: ruleAssocEnd,
      tags: [...T.sum, ...T.structural, ...T.assoc],
    },
    {
      id: "sum_neutral_drop_0" as RuleId,
      rule: "sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)",
      fn: ruleNeutralRight,
      tags: [...T.sum, ...T.simplify, ...T.neutral],
    },
    {
      id: "sum_lift_to_eval_def" as RuleId,
      rule: "sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name",
      fn: ruleLiftSum,
      tags: [...T.sum, ...T.eval, "progress", "structural"],
    },
    {
      id: "sum_factor_common_divisor" as RuleId,
      rule: "sum(?terms...) => mul(?x, sum(?quot...)) where all_divisible_by([?terms...], ?x), map_div([?terms...], ?x) => [?quot...]",
      fn: ruleFactorCommonDivisor,
      tags: [...T.sum, ...T.simplify, "factor", "progress"],
    },

    // -------------------------
    // Mul
    // -------------------------
    {
      id: "mul_assoc_left" as RuleId,
      rule: "mul(?a, ?b, ?rest...) => mul(prod(?a, ?b), ?rest...)",
      fn: ruleMulAssocLeft,
      tags: [...T.mul, ...T.structural, ...T.assoc],
    },
    {
      id: "mul_neutral_drop_1_right" as RuleId,
      rule: "mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)",
      fn: ruleMulNeutralRight,
      tags: [...T.mul, ...T.simplify, ...T.neutral],
    },
    {
      id: "mul_neutral_drop_1_left" as RuleId,
      rule: "mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)",
      fn: ruleMulNeutralLeft,
      tags: [...T.mul, ...T.simplify, ...T.neutral],
    },
    {
      id: "mul_zero_to_0_right" as RuleId,
      rule: "mul(?args..., 0, ?rest...) => 0",
      fn: ruleMulZeroRight,
      tags: [...T.mul, ...T.simplify, "compute"],
    },
    {
      id: "mul_zero_to_0_left" as RuleId,
      rule: "mul(?args..., 0, ?rest...) => 0",
      fn: ruleMulZeroLeft,
      tags: [...T.mul, ...T.simplify, "compute"],
    },

    // -------------------------
    // Div
    // -------------------------
    {
      id: "div_neutral_by_1" as RuleId,
      rule: "div(?a, 1) => ?a",
      fn: ruleDivNeutralRight,
      tags: ["div", ...T.simplify, ...T.neutral],
    },
    {
      id: "div_self_to_1" as RuleId,
      rule: "div(?a, ?a) => 1",
      fn: ruleDivSelfToOne,
      tags: ["div", ...T.simplify],
    },

    // -------------------------
    // Paren / Neg / Sub
    // -------------------------
    {
      id: "paren_remove" as RuleId,
      rule: "paren(?a) => ?a",
      fn: ruleParenRemove,
      tags: ["paren", ...T.simplify, ...T.structural],
    },
    {
      id: "sub_to_sum_neg" as RuleId,
      rule: "sub(?a, ?b) => sum(?a, neg(?b))",
      fn: ruleSubToSum,
      tags: ["sum", "neg", ...T.normalize, ...T.structural],
    },
    {
      id: "neg_double" as RuleId,
      rule: "neg(neg(?a)) => ?a",
      fn: ruleDoubleNeg,
      tags: ["neg", ...T.simplify],
    },
    {
      id: "neg_zero" as RuleId,
      rule: "neg(0) => 0",
      fn: ruleNegZero,
      tags: ["neg", ...T.simplify, "compute"],
    },
    {
      id: "add_inverse_to_0" as RuleId,
      rule: "add(?a, neg(?a)) => 0",
      fn: ruleSumNegSelf,
      tags: ["sum", "neg", ...T.simplify],
    },

    // -------------------------
    // Special transforms
    // -------------------------
    {
      id: "sum_to_mul_count" as RuleId,
      rule: "sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)",
      fn: ruleSumToMul,
      tags: ["sum", "mul", "list", ...T.normalize, "danger_expand"], // can be risky
    },
    {
      id: "mul_to_sum_repeat" as RuleId,
      rule: "mul(?n, ?a) => sum(?a, ?rest...) where ?n is number",
      fn: ruleMulToSum,
      tags: ["mul", "sum", ...T.normalize, "danger_expand"],
    },

    // -------------------------
    // Eq / Solve / Step / Eval
    // -------------------------
    {
      id: "eq_normalize_to_zero_form" as RuleId,
      rule: "eq(?a, ?b) => eq(sum(?a, neg(?b)), 0)",
      fn: ruleEqNormalize,
      tags: [...T.eq, ...T.normalize, "progress"],
    },
    {
      id: "eq_move_addend_general" as RuleId,
      rule: "eq(sum(?t, ?c), ?rhs) => eq(?t, sum(?rhs, neg(?c)))",
      fn: ruleEqMoveAddendGeneral,
      tags: ["eq", "normalize", "isolate", "progress"],
    },
    {
      id: "eval_eq_both_sides" as RuleId,
      rule: "eval(eq(?a, ?b)) => eq(eval(?a), eval(?b))",
      fn: ruleEvalEq,
      tags: [...T.eq, ...T.eval, "progress"],
    },
    {
      id: "eq_divide_both_sides_left_mul" as RuleId,
      rule: "eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k))",
      fn: ruleEqDivideBothSidesLeftMul,
      tags: ["eq", "normalize", "isolate", "progress", "linear"],
    },
    {
      id: "eq_divide_both_sides_right_mul" as RuleId,
      rule: "eq(?b, mul(?k, ?x)) => eq(div(?b, ?k), ?x)",
      fn: ruleEqDivideBothSidesRightMul,
      tags: ["eq", "normalize", "isolate", "progress", "linear"],
    },
    {
      id: "solve_goal_met" as RuleId,
      rule: "solve(?e, ?p) => ?e",
      fn: ruleSolveGoalMet,
      tags: [...T.solve, "progress"],
    },
    {
      id: "solve_eq_normalize" as RuleId,
      rule: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))",
      fn: ruleSolveEqNormalize,
      tags: [...T.solve, ...T.eq, ...T.normalize, "progress"],
    },
    {
      id: "solve_linear_match" as RuleId,
      rule: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve_linear(eq(?lhs, ?rhs), solved_for(?x)) where linear_in(?lhs, ?x) or linear_in(?rhs, ?x)",
      fn: ruleSolveLinearMatch,
      tags: [...T.solve, ...T.eq, "linear", "progress"],
    },
    {
      id: "solve_isolated_left" as RuleId,
      rule: "solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs",
      fn: ruleSolveEqIsolatedLeft,
      tags: [...T.solve, ...T.eq, "simplify", "progress"],
    },
    {
      id: "solve_isolated_right" as RuleId,
      rule: "solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs",
      fn: ruleSolveEqIsolatedRight,
      tags: [...T.solve, ...T.eq, "simplify", "progress"],
    },

    // {
    //   id: "step_via_eval_progress" as RuleId,
    //   rule: "step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)",
    //   fn: ruleStep,
    //   tags: [...T.step, ...T.eval, "progress"],
    // },
    // {
    //   id: "solve_driver_step" as RuleId,
    //   rule: "solve(?e, ?p) => solve(?e1, ?p) where step(?e) => ?e1",
    //   fn: ruleSolveStep,
    //   tags: [...T.solve, ...T.step, "progress"],
    // },

    {
      id: "eval_number" as RuleId,
      rule: "eval(?n) => ?n where ?n is number",
      fn: ruleEvalNumber,
      tags: [...T.eval, ...T.compute],
    },
    {
      id: "eval_symbol" as RuleId,
      rule: "eval(sym(?x)) => sym(?x) where ?x is symbol_name",
      fn: ruleEvalSymbol,
      tags: [...T.eval, "simplify"],
    },
    {
      id: "eval_progressive" as RuleId,
      rule: "eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name",
      fn: ruleEvalProgressive,
      tags: [...T.eval, "progress", ...T.structural],
    },
    {
      id: "eval_collapse" as RuleId,
      rule: "eval(eval(?x)) => eval(?x)",
      fn: ruleEvalCollapse,
      tags: [...T.eval, ...T.simplify],
    },

    // -------------------------
    // Eval compute rules
    // -------------------------
    { id: "eval_sum_numbers" as RuleId, rule: "eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number", fn: ruleEvalSum, tags: [...T.eval, ...T.compute, "sum"] },
    { id: "eval_mul_numbers" as RuleId, rule: "eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number", fn: ruleEvalMul, tags: [...T.eval, ...T.compute, "mul"] },
    { id: "eval_div_numbers" as RuleId, rule: "eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number", fn: ruleEvalDiv, tags: [...T.eval, ...T.compute, "div"] },
    { id: "eval_neg_number" as RuleId, rule: "eval(neg(?a)) => calc_neg(?a) where ?a is number", fn: ruleEvalNeg, tags: [...T.eval, ...T.compute, "neg"] },

    // Direct compute (no eval wrapper)
    { id: "calc_sum_numbers" as RuleId, rule: "sum(?a, ?b) => calc_sum(?a, ?b) where ?a is number, ?b is number", fn: ruleCalcSum, tags: [...T.compute, "sum"] },
    { id: "calc_mul_numbers" as RuleId, rule: "mul(?a, ?b) => calc_mul(?a, ?b) where ?a is number, ?b is number", fn: ruleCalcMul, tags: [...T.compute, "mul"] },
    { id: "calc_div_numbers" as RuleId, rule: "div(?a, ?b) => calc_div(?a, ?b) where ?a is number, ?b is number", fn: ruleCalcDiv, tags: [...T.compute, "div"] },
    { id: "calc_neg_number" as RuleId, rule: "neg(?a) => calc_neg(?a) where ?a is number", fn: ruleCalcNeg, tags: [...T.compute, "neg"] },

    // -------------------------
    // Transcendentals
    // -------------------------
    { id: "eval_pow_numbers" as RuleId, rule: "eval(pow(?a, ?b)) => calc_pow(?a, ?b) where ?a is number, ?b is number", fn: ruleEvalPow, tags: [...T.eval, ...T.compute, ...T.transcendental, "power"] },
    { id: "pow_exp_1" as RuleId, rule: "eval(pow(?x, 1)) => ?x", fn: ruleEvalPowExp1, tags: [...T.eval, ...T.simplify, ...T.transcendental, "power"] },
    { id: "pow_exp_0" as RuleId, rule: "eval(pow(?x, 0)) => 1", fn: ruleEvalPowExp0, tags: [...T.eval, ...T.simplify, ...T.transcendental, "power"] },
    { id: "pow_base_1" as RuleId, rule: "eval(pow(1, ?y)) => 1", fn: ruleEvalPowBase1, tags: [...T.eval, ...T.simplify, ...T.transcendental, "power"] },
    { id: "pow_base_0_pos" as RuleId, rule: "eval(pow(0, ?y)) => 0", fn: ruleEvalPowBase0Pos, tags: [...T.eval, ...T.simplify, ...T.transcendental, "power"] },

    { id: "eval_sqrt" as RuleId, rule: "eval(sqrt(?a)) => calc_sqrt(?a)", fn: ruleEvalSqrt, tags: [...T.eval, ...T.compute, ...T.transcendental, "sqrt"] },
    { id: "sqrt_pow2" as RuleId, rule: "eval(sqrt(pow(?x, 2))) => ?x", fn: ruleSqrt2, tags: [...T.eval, ...T.simplify, ...T.transcendental, "sqrt"] },
    { id: "sqrt_to_pow_half" as RuleId, rule: "eval(sqrt(?x)) => pow(?x, div(1, 2))", fn: ruleSqrtToPow, tags: [...T.eval, ...T.normalize, ...T.transcendental, "sqrt"] },

    { id: "eval_ln" as RuleId, rule: "eval(log(?a)) => calc_ln(?a)", fn: ruleEvalLn, tags: [...T.eval, ...T.compute, ...T.transcendental, "log"] },
    { id: "eval_log_base" as RuleId, rule: "eval(log(?a, ?b)) => calc_log(?a, ?b)", fn: ruleEvalLogBase, tags: [...T.eval, ...T.compute, ...T.transcendental, "log"] },
    { id: "ln_1" as RuleId, rule: "eval(log(1)) => 0", fn: ruleLn1, tags: [...T.eval, ...T.simplify, ...T.transcendental, "log"] },
    { id: "ln_exp" as RuleId, rule: "eval(log(exp(?x))) => ?x", fn: ruleLnExp, tags: [...T.eval, ...T.simplify, ...T.transcendental, "log", "exp"] },

    { id: "eval_exp_number" as RuleId, rule: "eval(exp(?a)) => calc_exp(?a) where ?a is number", fn: ruleEvalExp, tags: [...T.eval, ...T.compute, ...T.transcendental, "exp"] },
    { id: "exp_ln" as RuleId, rule: "eval(exp(log(?x))) => ?x", fn: ruleExpLn, tags: [...T.eval, ...T.simplify, ...T.transcendental, "exp", "log"] },
    { id: "exp_0" as RuleId, rule: "eval(exp(0)) => 1", fn: ruleExpZero, tags: [...T.eval, ...T.simplify, ...T.transcendental, "exp"] },

    { id: "calc_pow_numbers" as RuleId, rule: "pow(?a, ?b) => calc_pow(?a, ?b) where ?a is number, ?b is number", fn: ruleCalcPow, tags: [...T.compute, ...T.transcendental, "power"] },
    { id: "calc_sqrt_nonneg" as RuleId, rule: "sqrt(?a) => calc_sqrt(?a) where ?a is nonneg_number", fn: ruleCalcSqrt, tags: [...T.compute, ...T.transcendental, "sqrt"] },
    { id: "calc_ln_pos" as RuleId, rule: "log(?a) => calc_ln(?a) where ?a is positive_number", fn: ruleCalcLn, tags: [...T.compute, ...T.transcendental, "log"] },
    { id: "calc_log_base" as RuleId, rule: "log(?a, ?b) => calc_log(?a, ?b) where ?a is positive_number, ?b is positive_number", fn: ruleCalcLogBase, tags: [...T.compute, ...T.transcendental, "log"] },
    { id: "calc_exp_number" as RuleId, rule: "exp(?a) => calc_exp(?a) where ?a is number", fn: ruleCalcExp, tags: [...T.compute, ...T.transcendental, "exp"] },

    // -------------------------
    // Fold (generic)
    // -------------------------
    {
      id: "fold_base" as RuleId,
      rule: "fold(?f, ?acc, []) => ?acc",
      fn: ruleFoldBase,
      tags: ["fold", "list", ...T.structural, "simplify"],
    },
    {
      id: "fold_step" as RuleId,
      rule: "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      fn: ruleFoldStep,
      tags: ["fold", "list", ...T.structural, "progress"],
    },

    // -------------------------
    // Group same terms
    // -------------------------
    {
      id: "group_same" as RuleId,
      rule: "group_same(sum(?terms...), ?target) => rebuild_group(fold(bucket_same(?target), acc(pick(), rest()), [?terms...]))",
      fn: ruleGroupSame,
      tags: ["fold", "group", ...T.structural, "progress"],
    },
    {
      id: "bucket_same_pick" as RuleId,
      rule: "bucket_same(?target, acc(pick(?p...), rest(?r...)), ?t) => acc(pick(?p..., ?t), rest(?r...)) where eq_ast(?t, ?target)",
      fn: ruleBucketSamePick,
      tags: ["fold", "bucket", ...T.structural, "progress"],
    },
    {
      id: "bucket_same_rest" as RuleId,
      rule: "bucket_same(?target, acc(pick(?p...), rest(?r...)), ?t) => acc(pick(?p...), rest(?r..., ?t))",
      fn: ruleBucketSameRest,
      tags: ["fold", "bucket", ...T.structural, "progress"],
    },
    {
      id: "rebuild_group" as RuleId,
      rule: "rebuild_group(acc(pick(?p...), rest(?r...))) => sum(?p..., ?r...)",
      fn: ruleRebuildGroup,
      tags: ["fold", "rebuild", ...T.structural, "simplify"],
    },

    // -------------------------
    // Solve linear (added by you)
    // -------------------------
    // {
    //   id: "solve_simple_linear",
    //   rule: "solve(eq(sum(?x, ?c), 0), solved_for(?x)) => neg(?c)",
    //   fn: ruleSolveSimpleLinear,
    //   tags: [...T.solve, ...T.eq, "linear", "compute", "progress"],
    // },
    // {
    //   id: "solve_linear_kx_plus_c",
    //   rule: "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)",
    //   fn: ruleSolveLinear,
    //   tags: [...T.solve, ...T.eq, "linear", "compute", "progress"],
    // },
  ];

  for (const r of rules) add(runtime, r);
}

