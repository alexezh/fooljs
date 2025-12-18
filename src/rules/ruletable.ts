import { AstNode, MatchFunc } from "../ast.js";
import { Runtime } from "../runtime.js";
import { ruleEqSymmetry, ruleEvalEq, ruleParenRemove } from "./corerules.js";
import { ruleSolveEqIsolatedRight, ruleSolveLinear } from "./equation.js";
import { ruleEvalCollapse, ruleEvalDef, ruleEvalDefSimplify, ruleEvalNeg, ruleEvalNumber, ruleEvalProgressive, ruleEvalSum, ruleEvalSymbol } from "./eval.js";
import { ruleSolveGoalMet, ruleStep, ruleSolveStep } from "./goals.js";
import { ruleDivNeutralRight, ruleDivSelfToOne, ruleEvalDiv, ruleEvalMul, ruleMulAssocLeft, ruleMulCommutative, ruleMulNeutralLeft, ruleMulNeutralRight, ruleMulToSum, ruleMulZeroLeft, ruleMulZeroRight, ruleSumToMul } from "./mul.js";
import { ruleSolveEqIsolatedLeft, ruleSolveEqNormalize } from "./solverules.js";
import { ruleAssocEnd, ruleAssocLeft, ruleAssocMid, ruleCommutative, ruleDoubleNeg, ruleLiftSum, ruleNegZero, ruleNeutralRight, ruleSubToSum, ruleSumNegSelf, ruleSwapEnds } from "./sum.js";
import { ruleEvalExp, ruleEvalLn, ruleEvalLogBase, ruleEvalPow, ruleEvalPowBase0Pos, ruleEvalPowBase1, ruleEvalPowExp0, ruleEvalPowExp1, ruleEvalSqrt, ruleExpLn, ruleExpZero, ruleLn1, ruleLnExp, ruleSqrt2, ruleSqrtToPow } from "./transcendental.js";
import { ruleCombineLikeTerms, ruleCombineNumbers, ruleSubExpandSum } from "./simplify.js";

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
  // Step rules
  ruleStep,               // 39
  ruleSolveStep,          // 40
  // Transcendental functions
  ruleEvalPow,            // 41
  ruleEvalPowExp1,        // 42
  ruleEvalPowExp0,        // 43
  ruleEvalPowBase1,       // 44
  ruleEvalPowBase0Pos,    // 45
  ruleEvalSqrt,           // 46
  ruleSqrt2,              // 47
  ruleSqrtToPow,          // 48
  ruleEvalLn,             // 49
  ruleEvalLogBase,        // 50
  ruleLn1,                // 51
  ruleLnExp,              // 52
  ruleEvalExp,            // 53
  ruleExpLn,              // 54
  ruleExpZero,            // 55
  // Simplification rules
  ruleCombineLikeTerms,   // 56
  ruleSubExpandSum,       // 57
  ruleCombineNumbers      // 58
];

export function initCore(runtime: Runtime) {
  const coreRules: [string, MatchFunc | undefined][] = [
    // Sum: Associativity variants (works with 3+ args)
    ["sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)", ruleAssocLeft],
    ["sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)", ruleAssocMid],
    ["sum(?a, ?mid..., ?b) => sum(sum(?a, ?b), ?rest...)", ruleAssocEnd],

    // Sum: Commutativity and neutral element
    //["sum(?a, ?b) => sum(?b, ?a)", ruleCommutative],
    //["sum(?a, ?mid..., ?c) => sum(?c, ?mid..., ?a)", ruleSwapEnds],
    ["sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)", ruleNeutralRight],

    // Sum: Lift sums into the evaluation flow
    ["sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name", ruleLiftSum],

    // Multiply: Associativity (works with 3+ args)
    ["mul(?a, ?b, ?rest...) => mul(prod(?a, ?b), ?rest...)", ruleMulAssocLeft],

    // Multiply: Commutativity
    //["mul(?a, ?b) => mul(?b, ?a)", ruleMulCommutative],

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
    //["eq(?a, ?b) => eq(?b, ?a)", ruleEqSymmetry],
    ["eval(eq(?a, ?b)) => eq(eval(?a), eval(?b))", ruleEvalEq],

    // Solve rules - Goal-based solving
    // Note: holds check is done in the rule function itself
    ["solve(?e, ?p) => ?e", ruleSolveGoalMet],

    // Solve + eq rules - Equation solving
    ["solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))", ruleSolveEqNormalize],
    ["solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs", ruleSolveEqIsolatedLeft],
    ["solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs", ruleSolveEqIsolatedRight],

    // Step rule - Bridge between solve and eval
    ["step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)", ruleStep],

    // Solve driver - Uses step to make progress
    ["solve(?e, ?p) => solve(?e1, ?p) where step(?e) => ?e1", ruleSolveStep],

    // Eval base cases
    ["eval(?n) => ?n where ?n is number", ruleEvalNumber],
    ["eval(sym(?x)) => sym(?x) where ?x is symbol_name", ruleEvalSymbol],

    // Eval structural progression (left-to-right argument evaluation)
    ["eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name", ruleEvalProgressive],

    // Eval collapse redundant wrappers
    ["eval(eval(?x)) => eval(?x)", ruleEvalCollapse],

    // Eval handling for definitions
    // ["eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name", ruleEvalDef],
    // ["eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name", ruleEvalDefSimplify],

    // Eval computation for arithmetic operations
    ["eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number", ruleEvalSum],
    ["eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number", ruleEvalMul],
    ["eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number", ruleEvalDiv],
    ["eval(neg(?a)) => calc_neg(?a) where ?a is number", ruleEvalNeg],

    // Transcendental functions - Power
    ["eval(pow(?a, ?b)) => calc_pow(?a, ?b) where ?a is number, ?b is number", ruleEvalPow],
    ["eval(pow(?x, 1)) => ?x", ruleEvalPowExp1],
    ["eval(pow(?x, 0)) => 1", ruleEvalPowExp0],
    ["eval(pow(1, ?y)) => 1", ruleEvalPowBase1],
    ["eval(pow(0, ?y)) => 0", ruleEvalPowBase0Pos],

    // Transcendental functions - Square root
    ["eval(sqrt(?a)) => calc_sqrt(?a)", ruleEvalSqrt],
    ["eval(sqrt(pow(?x, 2))) => ?x", ruleSqrt2],
    ["eval(sqrt(?x)) => pow(?x, div(1, 2))", ruleSqrtToPow],

    // Transcendental functions - Logarithm
    ["eval(log(?a)) => calc_ln(?a)", ruleEvalLn],
    ["eval(log(?a, ?b)) => calc_log(?a, ?b)", ruleEvalLogBase],
    ["eval(log(1)) => 0", ruleLn1],
    ["eval(log(exp(?x))) => ?x", ruleLnExp],

    // Transcendental functions - Exponential
    ["eval(exp(?a)) => calc_exp(?a) where ?a is number", ruleEvalExp],
    ["eval(exp(log(?x))) => ?x", ruleExpLn],
    ["eval(exp(0)) => 1", ruleExpZero],

    // Simplification - Like terms and arithmetic
    // TODO: remove
    // ["eval(sum(?terms...)) => eval(sum(?combined...))", ruleCombineLikeTerms],
    // ["eval(sub(sum(?terms...), ?b)) => eval(sum(?terms..., neg(?b)))", ruleSubExpandSum],
    // ["eval(sum(?terms...)) => eval(sum(?combined...))", ruleCombineNumbers],

    // Linear equations kx + c = 0 solve for x
    ["solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)", ruleSolveLinear],
  ];

  for (const [ruleStr, ruleFunc] of coreRules) {
    runtime.addRule(ruleStr, ruleFunc);
  }
}
