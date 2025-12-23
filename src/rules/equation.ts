// solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs

import { AstNode, ASymbol, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// Helper: Check if expression is linear in variable x
// Linear means: x appears at most to power 1, not in denominators, not in transcendental functions
function linear_in(expr: AstNode, varName: string): boolean {
  if (expr.kind === 'number') {
    return true; // Constants are linear
  }

  if (expr.kind === 'symbol') {
    // Variables (including the target variable) are linear
    return true;
  }

  if (expr.kind === 'func') {
    const funcName = expr.value as string;
    const args = getArgs(expr);

    switch (funcName) {
      case 'sum':
      case 'sub':
      case 'neg':
        // Sum, subtraction, negation preserve linearity
        return args.every(arg => linear_in(arg, varName));

      case 'mul': {
        // Multiplication is linear if at most one argument contains the variable
        let hasVar = false;
        for (const arg of args) {
          if (containsVar(arg, varName)) {
            if (hasVar) {
              // Second occurrence means x*x or similar - not linear
              return false;
            }
            // Check that this argument is linear
            if (!linear_in(arg, varName)) {
              return false;
            }
            hasVar = true;
          } else {
            // Non-variable arguments must be linear (constants, other vars)
            if (!linear_in(arg, varName)) {
              return false;
            }
          }
        }
        return true;
      }

      case 'div': {
        // Division is linear only if variable doesn't appear in denominator
        if (args.length !== 2) return false;
        const [numerator, denominator] = args;
        // Variable cannot appear in denominator
        if (containsVar(denominator, varName)) {
          return false;
        }
        // Numerator must be linear
        return linear_in(numerator, varName);
      }

      case 'pow': {
        // Power is linear only if base is the variable and exponent is 1, or variable doesn't appear
        if (args.length !== 2) return false;
        const [base, exponent] = args;

        if (containsVar(base, varName)) {
          // Variable in base - exponent must be 1
          if (isNumber(exponent) && exponent.value === 1) {
            return linear_in(base, varName);
          }
          return false;
        }

        // Variable not in base - check if it's in exponent (would be non-linear)
        return !containsVar(exponent, varName);
      }

      default:
        // Transcendental functions (sin, cos, exp, ln, etc.) are non-linear
        return !containsVar(expr, varName);
    }
  }

  return true;
}

// Helper: Check if expression contains variable
function containsVar(expr: AstNode, varName: string): boolean {
  if (expr.kind === 'symbol') {
    const sym = expr.value as ASymbol;
    return sym.name === varName;
  }

  if (expr.kind === 'func' || expr.kind === 'eq') {
    const args = getArgs(expr);
    return args.some(arg => containsVar(arg, varName));
  }

  return false;
}

// solve(eq(?lhs, ?rhs), solved_for(?x)) => solve_linear(eq(?lhs, ?rhs), solved_for(?x))
// where linear_in(?lhs, ?x) or linear_in(?rhs, ?x)
// Matches linear equations and marks them for linear solving
export function ruleSolveLinearMatch(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];
  if (targetVar.kind !== 'symbol') return undefined;
  const targetSym = targetVar.value as ASymbol;
  const varName = targetSym.name;

  // Check if equation node is eq(?lhs, ?rhs)
  if (eqNode.kind !== 'eq') return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check if linear in the variable
  const lhsLinear = linear_in(lhs, varName);
  const rhsLinear = linear_in(rhs, varName);

  if (!lhsLinear && !rhsLinear) return undefined;

  // Return solve_linear wrapper to indicate this is a linear equation
  return {
    replace: AstNode.create('func', 'solve_linear', [eqNode, goalNode]),
    cost: 1 // Creates 1 new node
  };
}

// Base case: variable isolated on right
export function ruleSolveEqIsolatedRight(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];

  // Check first arg is eq(?lhs, ?x)
  if (!isFunc(eqNode, 'eq')) return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check if rhs matches the target variable
  if (rhs.kind === 'symbol' && targetVar.kind === 'symbol') {
    const rhsSym = rhs.value as ASymbol;
    const targetSym = targetVar.value as ASymbol;
    if (rhsSym.name === targetSym.name) {
      return {
        replace: lhs,
        cost: 0 // No new nodes, just unwrapping
      };
    }
  }

  return undefined;
}

// solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)
// Linear equation solver: k*x + c = 0  =>  x = -c/k
export function ruleSolveLinear(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];
  if (targetVar.kind !== 'symbol') return undefined;
  const targetSym = targetVar.value as ASymbol;

  // Check first arg is eq(sum(mul(?k, ?x), ?c), 0)
  if (!isFunc(eqNode, 'eq')) return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check rhs is 0
  if (!isNumber(rhs) || rhs.value !== 0) return undefined;

  // Check lhs is sum(mul(?k, ?x), ?c)
  if (!isFunc(lhs, 'sum')) return undefined;
  const sumArgs = getArgs(lhs);
  if (sumArgs.length !== 2) return undefined;

  const [term1, term2] = sumArgs;

  // Try both orders: mul(?k, ?x) + ?c or ?c + mul(?k, ?x)
  let k: AstNode | undefined;
  let c: AstNode | undefined;
  let x: AstNode | undefined;

  // Try term1 = mul(?k, ?x), term2 = ?c
  if (isFunc(term1, 'mul')) {
    const mulArgs = getArgs(term1);
    if (mulArgs.length === 2) {
      const [factor1, factor2] = mulArgs;

      // Check if factor1 is number and factor2 matches target var
      if (isNumber(factor1) && factor2.kind === 'symbol') {
        const factor2Sym = factor2.value as ASymbol;
        if (factor2Sym.name === targetSym.name && isNumber(term2)) {
          k = factor1;
          x = factor2;
          c = term2;
        }
      }
      // Or factor2 is number and factor1 matches target var
      if (isNumber(factor2) && factor1.kind === 'symbol') {
        const factor1Sym = factor1.value as ASymbol;
        if (factor1Sym.name === targetSym.name && isNumber(term2)) {
          k = factor2;
          x = factor1;
          c = term2;
        }
      }
    }
  }

  // Try term2 = mul(?k, ?x), term1 = ?c
  if (!k && isFunc(term2, 'mul')) {
    const mulArgs = getArgs(term2);
    if (mulArgs.length === 2) {
      const [factor1, factor2] = mulArgs;

      if (isNumber(factor1) && factor2.kind === 'symbol') {
        const factor2Sym = factor2.value as ASymbol;
        if (factor2Sym.name === targetSym.name && isNumber(term1)) {
          k = factor1;
          x = factor2;
          c = term1;
        }
      }
      if (isNumber(factor2) && factor1.kind === 'symbol') {
        const factor1Sym = factor1.value as ASymbol;
        if (factor1Sym.name === targetSym.name && isNumber(term1)) {
          k = factor2;
          x = factor1;
          c = term1;
        }
      }
    }
  }

  if (!k || !c || !x) return undefined;

  // Check k is nonzero
  const kVal = k.value as number;
  if (kVal === 0) return undefined;

  // Return -c/k (the solution)
  return {
    replace: AstNode.create('func', 'div', [
      AstNode.create('func', 'neg', [c]),
      k
    ]),
    cost: 2 // Creates 2 new nodes: div and neg
  };
}

// solve(eq(sum(?x, ?c), 0), solved_for(?x)) => neg(?c)
// Simple linear equation solver: x + c = 0  =>  x = -c
// Handles the case where the variable appears by itself (not multiplied by a coefficient)
export function ruleSolveSimpleLinear(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];
  if (targetVar.kind !== 'symbol') return undefined;
  const targetSym = targetVar.value as ASymbol;

  // Check first arg is eq(sum(?x, ?c), 0)
  if (!isFunc(eqNode, 'eq')) return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check rhs is 0
  if (!isNumber(rhs) || rhs.value !== 0) return undefined;

  // Check lhs is sum(?x, ?c) or sum(?c, ?x)
  if (!isFunc(lhs, 'sum')) return undefined;
  const sumArgs = getArgs(lhs);
  if (sumArgs.length !== 2) return undefined;

  const [term1, term2] = sumArgs;

  let x: AstNode | undefined;
  let c: AstNode | undefined;

  // Try term1 = ?x (symbol), term2 = ?c (number)
  if (term1.kind === 'symbol' && isNumber(term2)) {
    const term1Sym = term1.value as ASymbol;
    if (term1Sym.name === targetSym.name) {
      x = term1;
      c = term2;
    }
  }

  // Try term2 = ?x (symbol), term1 = ?c (number)
  if (!x && term2.kind === 'symbol' && isNumber(term1)) {
    const term2Sym = term2.value as ASymbol;
    if (term2Sym.name === targetSym.name) {
      x = term2;
      c = term1;
    }
  }

  if (!x || !c) return undefined;

  // Return -c (the solution)
  return {
    replace: AstNode.create('func', 'neg', [c]),
    cost: 1 // Creates 1 new node: neg
  };
}
