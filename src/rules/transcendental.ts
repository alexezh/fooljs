// =============================================================================
// Transcendental functions: pow, sqrt, log, exp
// =============================================================================

import { AstNode, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// =============================================================================
// Constraint helpers
// =============================================================================

export function isZero(node: AstNode): boolean {
  return isNumber(node) && node.value === 0;
}

export function isOne(node: AstNode): boolean {
  return isNumber(node) && node.value === 1;
}

export function isPositiveNumber(node: AstNode): boolean {
  return isNumber(node) && (node.value as number) > 0;
}

export function isNonNegNumber(node: AstNode): boolean {
  return isNumber(node) && (node.value as number) >= 0;
}

export function isNonZeroNumber(node: AstNode): boolean {
  return isNumber(node) && node.value !== 0;
}

// =============================================================================
// Numeric computation helpers
// =============================================================================

function calc_pow(a: number, b: number): number {
  return Math.pow(a, b);
}

function calc_sqrt(a: number): number {
  return Math.sqrt(a);
}

function calc_ln(a: number): number {
  return Math.log(a);
}

function calc_log(a: number, b: number): number {
  return Math.log(a) / Math.log(b);
}

function calc_exp(a: number): number {
  return Math.exp(a);
}

// =============================================================================
// POW rules
// =============================================================================

// eval(pow(?a, ?b)) => calc_pow(?a, ?b) where ?a is number, ?b is number
export function ruleEvalPow(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'pow')) return undefined;

  const powArgs = getArgs(inner);
  if (powArgs.length !== 2) return undefined;

  const [base, exp] = powArgs;
  if (!isNumber(base) || !isNumber(exp)) return undefined;

  const result = calc_pow(base.value as number, exp.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(pow(?x, 1)) => ?x
export function ruleEvalPowExp1(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'pow')) return undefined;

  const powArgs = getArgs(inner);
  if (powArgs.length !== 2) return undefined;

  const [base, exp] = powArgs;
  if (isOne(exp)) {
    return {
      replace: base,
      cost: 0 // No new nodes, just unwrapping
    };
  }

  return undefined;
}

// eval(pow(?x, 0)) => 1 where not is_zero(?x)
export function ruleEvalPowExp0(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'pow')) return undefined;

  const powArgs = getArgs(inner);
  if (powArgs.length !== 2) return undefined;

  const [base, exp] = powArgs;
  if (isZero(exp) && !isZero(base)) {
    return {
      replace: AstNode.create('number', 1),
      cost: 1 // Creates 1 new number node
    };
  }

  return undefined;
}

// eval(pow(1, ?y)) => 1
export function ruleEvalPowBase1(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'pow')) return undefined;

  const powArgs = getArgs(inner);
  if (powArgs.length !== 2) return undefined;

  const [base, _exp] = powArgs;
  if (isOne(base)) {
    return {
      replace: AstNode.create('number', 1),
      cost: 1 // Creates 1 new number node
    };
  }

  return undefined;
}

// eval(pow(0, ?y)) => 0 where ?y is positive_number
export function ruleEvalPowBase0Pos(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'pow')) return undefined;

  const powArgs = getArgs(inner);
  if (powArgs.length !== 2) return undefined;

  const [base, exp] = powArgs;
  if (isZero(base) && isPositiveNumber(exp)) {
    return {
      replace: AstNode.create('number', 0),
      cost: 1 // Creates 1 new number node
    };
  }

  return undefined;
}

// =============================================================================
// SQRT rules
// =============================================================================

// eval(sqrt(?a)) => calc_sqrt(?a) where ?a is nonneg_number
export function ruleEvalSqrt(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sqrt')) return undefined;

  const sqrtArgs = getArgs(inner);
  if (sqrtArgs.length !== 1) return undefined;

  const arg = sqrtArgs[0];
  if (!isNonNegNumber(arg)) return undefined;

  const result = calc_sqrt(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(sqrt(pow(?x, 2))) => ?x
// Simplifies sqrt(x²) to x (assumes x >= 0, or would need abs)
export function ruleSqrt2(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sqrt')) return undefined;

  const sqrtArgs = getArgs(inner);
  if (sqrtArgs.length !== 1) return undefined;

  const sqrtArg = sqrtArgs[0];
  if (isFunc(sqrtArg, 'pow')) {
    const powArgs = getArgs(sqrtArg);
    if (powArgs.length === 2) {
      const [base, exp] = powArgs;
      // Check if exponent is 2
      if (isNumber(exp) && exp.value === 2) {
        return {
          replace: base,
          cost: 0 // No new nodes, just unwrapping
        };
      }
    }
  }

  return undefined;
}
// eval(sqrt(?x)) => pow(?x, div(1, 2))
export function ruleSqrtToPow(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sqrt')) return undefined;

  const sqrtArgs = getArgs(inner);
  if (sqrtArgs.length !== 1) return undefined;

  return {
    replace: AstNode.create('func', 'pow', [
      sqrtArgs[0],
      AstNode.create('func', 'div', [
        AstNode.create('number', 1),
        AstNode.create('number', 2)
      ])
    ]),
    cost: 4 // Creates 4 new nodes: pow, div, and 2 numbers
  };
}

// =============================================================================
// LOG rules
// =============================================================================

// eval(log(?a)) => calc_ln(?a) where ?a is positive_number
export function ruleEvalLn(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'log')) return undefined;

  const logArgs = getArgs(inner);
  if (logArgs.length !== 1) return undefined;

  const arg = logArgs[0];
  if (!isPositiveNumber(arg)) return undefined;

  const result = calc_ln(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(log(?a, ?b)) => calc_log(?a, ?b) where ?a is positive_number, ?b is positive_number, not is_one(?b)
export function ruleEvalLogBase(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'log')) return undefined;

  const logArgs = getArgs(inner);
  if (logArgs.length !== 2) return undefined;

  const [arg, base] = logArgs;
  if (!isPositiveNumber(arg) || !isPositiveNumber(base) || isOne(base)) {
    return undefined;
  }

  const result = calc_log(arg.value as number, base.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(log(1)) => 0
export function ruleLn1(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'log')) return undefined;

  const logArgs = getArgs(inner);
  if (logArgs.length !== 1) return undefined;

  if (isOne(logArgs[0])) {
    return {
      replace: AstNode.create('number', 0),
      cost: 1 // Creates 1 new number node
    };
  }

  return undefined;
}

// eval(log(exp(?x))) => ?x
export function ruleLnExp(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'log')) return undefined;

  const logArgs = getArgs(inner);
  if (logArgs.length !== 1) return undefined;

  const logArg = logArgs[0];
  if (isFunc(logArg, 'exp')) {
    const expArgs = getArgs(logArg);
    if (expArgs.length === 1) {
      return {
        replace: expArgs[0],
        cost: 0 // No new nodes, just unwrapping
      };
    }
  }

  return undefined;
}

// =============================================================================
// EXP rules
// =============================================================================

// eval(exp(?a)) => calc_exp(?a) where ?a is number
export function ruleEvalExp(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'exp')) return undefined;

  const expArgs = getArgs(inner);
  if (expArgs.length !== 1) return undefined;

  const arg = expArgs[0];
  if (!isNumber(arg)) return undefined;

  const result = calc_exp(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(exp(log(?x))) => ?x where ?x is positive_expr
export function ruleExpLn(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'exp')) return undefined;

  const expArgs = getArgs(inner);
  if (expArgs.length !== 1) return undefined;

  const expArg = expArgs[0];
  if (isFunc(expArg, 'log')) {
    const logArgs = getArgs(expArg);
    if (logArgs.length === 1) {
      // Ideally check if logArgs[0] is positive, but for now we'll allow it
      return {
        replace: logArgs[0],
        cost: 0 // No new nodes, just unwrapping
      };
    }
  }

  return undefined;
}

// eval(exp(0)) => 1
export function ruleExpZero(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'exp')) return undefined;

  const expArgs = getArgs(inner);
  if (expArgs.length !== 1) return undefined;

  if (isZero(expArgs[0])) {
    return {
      replace: AstNode.create('number', 1),
      cost: 1 // Creates 1 new number node
    };
  }

  return undefined;
}

// =============================================================================
// Direct calculation rules (without eval wrapper)
// =============================================================================

// pow(?a, ?b) => calc_pow(?a, ?b) where ?a is number, ?b is number
export function ruleCalcPow(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'pow')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [base, exp] = args;
  if (!isNumber(base) || !isNumber(exp)) return undefined;

  const result = calc_pow(base.value as number, exp.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// sqrt(?a) => calc_sqrt(?a) where ?a is nonneg_number
export function ruleCalcSqrt(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sqrt')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isNonNegNumber(arg)) return undefined;

  const result = calc_sqrt(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// log(?a) => calc_ln(?a) where ?a is positive_number
export function ruleCalcLn(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'log')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isPositiveNumber(arg)) return undefined;

  const result = calc_ln(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// log(?a, ?b) => calc_log(?a, ?b) where ?a is positive_number, ?b is positive_number, not is_one(?b)
export function ruleCalcLogBase(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'log')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [arg, base] = args;
  if (!isPositiveNumber(arg) || !isPositiveNumber(base) || isOne(base)) {
    return undefined;
  }

  const result = calc_log(arg.value as number, base.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// exp(?a) => calc_exp(?a) where ?a is number
export function ruleCalcExp(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'exp')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isNumber(arg)) return undefined;

  const result = calc_exp(arg.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}
