import { AstNode } from "../ast.js";
import { Runtime } from "../runtime.js";
import { ruleEqSymmetry, ruleParenRemove } from "./corerules.js";
import { ruleSolveEqIsolatedRight, ruleSolveLinear } from "./equation.js";
import { ruleEvalDef, ruleEvalDefSimplify, ruleEvalNeg, ruleEvalNumber, ruleEvalProgressive, ruleEvalSum, ruleEvalSymbol } from "./eval.js";
import { ruleSolveGoalMet } from "./goals.js";
import { ruleDivNeutralRight, ruleDivSelfToOne, ruleEvalDiv, ruleEvalMul, ruleMulAssocLeft, ruleMulCommutative, ruleMulNeutralLeft, ruleMulNeutralRight, ruleMulToSum, ruleMulZeroLeft, ruleMulZeroRight, ruleSumToMul } from "./mul.js";
import { ruleSolveEqIsolatedLeft, ruleSolveEqNormalize } from "./solverules.js";
import { ruleAssocLeft, ruleAssocMid, ruleCommutative, ruleDoubleNeg, ruleLiftSum, ruleNegZero, ruleNeutralRight, ruleSubToSum, ruleSumNegSelf, ruleSwapEnds } from "./sum.js";

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
  ruleEvalDef,            // 10
  ruleEvalDefSimplify,    // 11
  ruleEvalSum,            // 12
  ruleEvalMul,            // 13
  ruleEvalDiv,            // 14
  ruleEvalNeg,            // 15
  ruleMulAssocLeft,       // 16
  ruleMulCommutative,     // 17
  ruleMulNeutralRight,    // 18
  ruleMulNeutralLeft,     // 19
  ruleMulZeroRight,       // 20
  ruleMulZeroLeft,        // 21
  ruleDivNeutralRight,    // 22
  ruleDivSelfToOne,       // 23
  ruleParenRemove,        // 24
  ruleSubToSum,           // 25
  ruleDoubleNeg,          // 26
  ruleNegZero,            // 27
  ruleSumNegSelf,         // 28
  ruleSumToMul,           // 29
  ruleMulToSum,           // 30
  // Equation rules
  ruleEqSymmetry,         // 31
  // Solve rules
  ruleSolveGoalMet,       // 32
  ruleSolveEqNormalize,   // 33
  ruleSolveEqIsolatedLeft,// 34
  ruleSolveEqIsolatedLeft,// 35
  ruleSolveLinear         // 36
];

export function initCore(runtime: Runtime) {
  const coreRules: [string, (ast: AstNode) => AstNode | undefined][] = [
    // Sum: Associativity variants (works with 3+ args)
    ["sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)", ruleAssocLeft],
    ["sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)", ruleAssocMid],

    // Sum: Commutativity and neutral element
    ["sum(?a, ?b) => sum(?b, ?a)", ruleCommutative],
    ["sum(?a, ?mid..., ?c) => sum(?c, ?mid..., ?a)", ruleSwapEnds],
    ["sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)", ruleNeutralRight],

    // Sum: Lift sums into the evaluation flow
    ["sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name", ruleLiftSum],

    // Eval base cases
    ["eval(?n) => ?n where ?n is number", ruleEvalNumber],
    ["eval(sym(?x)) => sym(?x) where ?x is symbol_name", ruleEvalSymbol],

    // Eval structural progression (left-to-right argument evaluation)
    ["eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name", ruleEvalProgressive],

    // Eval handling for definitions
    ["eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name", ruleEvalDef],
    ["eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name", ruleEvalDefSimplify],

    // Eval computation for arithmetic operations
    ["eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number", ruleEvalSum],
    ["eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number", ruleEvalMul],
    ["eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number", ruleEvalDiv],
    ["eval(neg(?a)) => calc_neg(?a) where ?a is number", ruleEvalNeg],

    // Multiply: Associativity (works with 3+ args)
    ["mul(?a, ?b, ?rest...) => mul(prod(?a, ?b), ?rest...)", ruleMulAssocLeft],

    // Multiply: Commutativity
    ["mul(?a, ?b) => mul(?b, ?a)", ruleMulCommutative],

    // Multiply: Neutral element (1) - works with 2+ args
    ["mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)", ruleMulNeutralRight],
    ["mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)", ruleMulNeutralLeft],

    // Multiply: Zero element - any zero makes product zero
    ["mul(?args..., 0, ?rest...) => 0", ruleMulZeroRight],
    ["mul(?args..., 0, ?rest...) => 0", ruleMulZeroLeft],

    // Divide: Neutral element
    ["div(?a, 1) => ?a", ruleDivNeutralRight],

    // Divide: Self division
    ["div(?a, ?a) => 1", ruleDivSelfToOne],

    // Parenthesis: Remove unnecessary parens
    ["paren(?a) => ?a", ruleParenRemove],

    // Subtraction: Convert to addition with negation
    ["sub(?a, ?b) => sum(?a, neg(?b))", ruleSubToSum],

    // Negation: Double negation elimination
    ["neg(neg(?a)) => ?a", ruleDoubleNeg],

    // Negation: Negation of zero
    ["neg(0) => 0", ruleNegZero],

    // Addition: Add inverse to get zero
    ["add(?a, neg(?a)) => 0", ruleSumNegSelf],

    // Special: Sum to multiply conversion
    ["sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)", ruleSumToMul],

    // Special: Multiply to sum expansion (expands mul(n, a) to repeated sum)
    ["mul(?n, ?a) => sum(?a, ?rest...) where ?n is number", ruleMulToSum],

    // Equation rules
    ["eq(?a, ?b) => eq(?b, ?a)", ruleEqSymmetry],

    // Solve rules - Goal-based solving
    // Note: holds check is done in the rule function itself
    ["solve(?e, ?p) => ?e", ruleSolveGoalMet],

    // Solve + eq rules - Equation solving
    ["solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))", ruleSolveEqNormalize],
    ["solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs", ruleSolveEqIsolatedLeft],
    ["solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs", ruleSolveEqIsolatedRight],
    // Linear equations kx + c = 0 solve for x
    ["solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)", ruleSolveLinear],
  ];

  for (const [ruleStr, ruleFunc] of coreRules) {
    runtime.addRule(ruleStr, ruleFunc);
  }
}
