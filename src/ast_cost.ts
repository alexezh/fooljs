import type { AstNode, ASymbol } from "./ast.js";

// ============================================================================
// Cost constants - tunable parameters for model optimization
// ============================================================================

export const COST = {
  // Addition costs
  ADD_ZERO: 1,                    // Adding 0 to anything
  ADD_SINGLE_DIGIT: 1,            // Adding two single-digit numbers
  ADD_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit addition

  // Subtraction costs
  SUB_IDENTICAL: 1,               // Subtracting identical numbers (A - A = 0)
  SUB_DIFF_BY_ONE: 2,             // Subtracting numbers that differ by 1
  SUB_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit subtraction

  // Multiplication costs
  MUL_BY_ZERO: 1,                 // Multiplying by 0
  MUL_BY_ONE: 1,                  // Multiplying by 1
  MUL_SINGLE_DIGIT: 2,            // Multiplying two single-digit numbers
  MUL_DIGIT_EXPONENT: 2,          // Exponent for digit-based cost (cost = digits^exp)

  // Variable costs
  VAR_BASE_COST: 10,              // Base cost for operations involving variables
  VAR_COMBINE_COST: 3,            // Cost to combine like terms (x + x = 2x)
  VAR_CANCEL_REWARD: -5,          // Negative cost (reward) for cancelling terms (x - x = 0)

  // Expression costs
  EXPR_COMBINE_COST: 2,           // Cost to combine compatible expressions

  // Other operation costs
  COEFF_VAR_MUL: 2,               // Cost for coefficient * variable (3 * x = 3x)
  SAME_VAR_MUL: 2,                // Cost for same variable multiplication (x * x = x^2)
  DIV_COST: 2,                    // Base division cost

  // Power/exponentiation costs
  POW_BASE_COST: 5,               // Base cost for power operation
  POW_SMALL_EXP: 3,               // Cost for small integer exponents (0-10)
  POW_LARGE_EXP: 10,              // Cost for large exponents (>10)
  POW_RATIONAL_EXP: 8,            // Cost for rational/fractional exponents
  POW_VAR_EXP: 15,                // Cost when exponent is a variable

  // Evaluation costs
  EVAL_BASE_COST: 1,              // Base cost for eval wrapper (low because eval is just a wrapper)
  EVAL_COMPLETE: 0,               // Cost when eval is complete (result is a value)

  // Equation costs
  EQ_BASE_COST: 5,                // Base cost for having an equation
  EQ_SOLVED: 1,                   // Cost when equation is solved (x = value)
  EQ_UNSOLVED: 20,                // Cost for unsolved equation

  // Solve costs
  SOLVE_BASE_COST: 10,            // Base cost for solve operation
  SOLVE_LINEAR: 5,                // Cost for linear equation solving
  SOLVE_QUADRATIC: 15,            // Cost for quadratic equation solving
  SOLVE_HIGHER: 25,               // Cost for higher-degree equations

  // Transcendental function costs
  SQRT_COST: 4,                   // Cost for square root
  LOG_COST: 6,                    // Cost for logarithm
  EXP_COST: 6,                    // Cost for exponential
  TRIG_COST: 5,                   // Cost for trigonometric functions

  // Binary operation costs (add, sub as functions)
  ADD_COST: 1,                    // Cost for binary add function
  SUB_COST: 1,                    // Cost for binary sub function
} as const;

export function getCost(ast: AstNode): number {

  // Base cases
  if (ast.kind === 'number') {
    // Cost based on number of digits
    const numValue = Math.abs(ast.value as number);
    const digits = numValue === 0 ? 1 : Math.floor(Math.log10(numValue)) + 1;
    return digits;
  }

  if (ast.kind === 'symbol' || ast.kind === 'patvar') {
    return COST.VAR_BASE_COST;
  }

  if (ast.kind === 'list' || ast.kind === 'tuple' || ast.kind === 'spread') {
    // Cost is sum of children costs
    const childrenCost = (ast.children ?? []).reduce((sum, child) => sum + child.getCost(), 0);
    return childrenCost;
  }

  // Function calls - calculate based on operation type
  if (ast.kind === 'func') {
    const funcName = ast.value as string;
    const args = ast.children ?? [];

    switch (funcName) {
      case 'sum':
        return calculateSumCost(args);
        break;

      case 'mul':
        return calculateMulCost(args);
        break;

      case 'div':
        return calculateDivCost(args);
        break;

      case 'neg':
        return args.length > 0 ? args[0].getCost() + 1 : 1;
        break;

      case 'paren':
        return args.length > 0 ? args[0].getCost() : 0;

      case 'add':
        return calculateAddCost(args);

      case 'sub':
        return calculateSubCost(args);

      case 'pow':
        return calculatePowCost(args);

      case 'sqrt':
        return calculateSqrtCost(args);

      case 'log':
        return calculateLogCost(args);

      case 'exp':
        return calculateExpCost(args);

      case 'eval':
        return calculateEvalCost(args);

      case 'solve':
        return calculateSolveCost(args);

      case 'solved_for':
      case 'holds':
      case 'step':
        // Meta-functions - just sum of children costs
        return args.reduce((sum, child) => sum + child.getCost(), 0);

      default:
        // Default cost: sum of children costs plus base expression cost
        const childrenCost = args.reduce((sum, child) => sum + child.getCost(), 0);
        return childrenCost + COST.EXPR_COMBINE_COST;
    }
  }

  // Handle 'eq' kind
  if (ast.kind === 'eq') {
    return calculateEqCost(ast.children ?? []);
  }

  // Default for other node types
  return 1;
}

function calculateSumCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return 0;
  if (args.length === 1) return args[0].getCost();

  // Start with the cost of all children
  let cost = args.reduce((sum, child) => sum + child.getCost(), 0);

  // Add operation costs based on the types of operands
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check if adding zero (very cheap operation)
    if (arg.kind === 'number' && arg.value === 0) {
      cost += COST.ADD_ZERO;
      continue;
    }

    // Check for variable cancellation (x + neg(x) = 0) - reward!
    if (i < args.length - 1) {
      const next = args[i + 1];
      if (areInverses(arg, next)) {
        cost += COST.VAR_CANCEL_REWARD;
        continue;
      }
    }

    // Add operation cost based on type
    if (arg.kind === 'number') {
      const argNum = Math.abs(arg.value as number);
      const digits = argNum === 0 ? 1 : Math.floor(Math.log10(argNum)) + 1;

      if (digits === 1) {
        cost += COST.ADD_SINGLE_DIGIT;
      } else {
        cost += digits * COST.ADD_PER_DIGIT;
      }
    } else if (arg.kind === 'symbol') {
      // Check for like terms (e.g., x + x) - opportunity to simplify
      for (let j = i + 1; j < args.length; j++) {
        if (areEqual(arg, args[j])) {
          cost += COST.VAR_COMBINE_COST;
          break;
        }
      }
    } else {
      // Complex expression - cost to combine
      cost += COST.EXPR_COMBINE_COST;
    }
  }

  return cost;
}

function calculateMulCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return 0;
  if (args.length === 1) return args[0].getCost();

  // Check for multiply by zero first (everything becomes zero)
  for (const arg of args) {
    if (arg.kind === 'number' && arg.value === 0) {
      return COST.MUL_BY_ZERO;
    }
  }

  // Start with the cost of all children
  let cost = args.reduce((sum, child) => sum + child.getCost(), 0);

  // Check for multiply by one (very cheap)
  for (const arg of args) {
    if (arg.kind === 'number' && arg.value === 1) {
      cost += COST.MUL_BY_ONE;
    }
  }

  // Calculate operation cost based on operands
  const numberArgs = args.filter(a => a.kind === 'number');
  const varArgs = args.filter(a => a.kind === 'symbol');
  const exprArgs = args.filter(a => a.kind !== 'number' && a.kind !== 'symbol');

  // Number multiplication operation cost
  if (numberArgs.length >= 2) {
    const num1 = Math.abs(numberArgs[0].value as number);
    const num2 = Math.abs(numberArgs[1].value as number);
    const digits1 = num1 === 0 ? 1 : Math.floor(Math.log10(num1)) + 1;
    const digits2 = num2 === 0 ? 1 : Math.floor(Math.log10(num2)) + 1;

    if (digits1 === 1 && digits2 === 1) {
      cost += COST.MUL_SINGLE_DIGIT;
    } else {
      cost += Math.pow(digits1 * digits2, COST.MUL_DIGIT_EXPONENT);
    }
  }

  // Coefficient * variable operation cost (e.g., 3 * x)
  if (numberArgs.length > 0 && varArgs.length > 0) {
    cost += COST.COEFF_VAR_MUL;
  }

  // Same variable multiplication (e.g., x * x = x^2)
  if (varArgs.length >= 2 && areEqual(varArgs[0], varArgs[1])) {
    cost += COST.SAME_VAR_MUL;
  }

  // Expression combination costs
  cost += exprArgs.length * COST.EXPR_COMBINE_COST;

  return cost;
}

function calculateDivCost(args: ReadonlyArray<AstNode>): number {
  if (args.length !== 2) return COST.DIV_COST;

  const [dividend, divisor] = args;
  let cost = COST.DIV_COST;

  // Add cost of operands
  cost += dividend.getCost();
  cost += divisor.getCost();

  // Division by 1 is cheap
  if (divisor.kind === 'number' && divisor.value === 1) {
    return 1;
  }

  // Self division (x / x = 1) is cheap
  if (areEqual(dividend, divisor)) {
    return 1;
  }

  return cost;
}

function calculateAddCost(args: ReadonlyArray<AstNode>): number {
  if (args.length !== 2) return COST.ADD_COST;

  // Binary add: cost of operands plus operation cost
  return args[0].getCost() + args[1].getCost() + COST.ADD_COST;
}

function calculateSubCost(args: ReadonlyArray<AstNode>): number {
  if (args.length !== 2) return COST.SUB_COST;

  const [left, right] = args;

  // Self subtraction (x - x = 0) is cheap
  if (areEqual(left, right)) {
    return COST.SUB_IDENTICAL;
  }

  // Binary sub: cost of operands plus operation cost
  return left.getCost() + right.getCost() + COST.SUB_COST;
}

function calculatePowCost(args: ReadonlyArray<AstNode>): number {
  if (args.length !== 2) return COST.POW_BASE_COST;

  const [base, exponent] = args;
  let cost = base.getCost() + exponent.getCost() + COST.POW_BASE_COST;

  // Different costs based on exponent type
  if (exponent.kind === 'number') {
    const expValue = exponent.value as number;

    // Small integer exponents are easier
    if (Number.isInteger(expValue) && expValue >= 0 && expValue <= 10) {
      cost += COST.POW_SMALL_EXP;
    }
    // Large exponents are harder
    else if (Number.isInteger(expValue) && expValue > 10) {
      cost += COST.POW_LARGE_EXP;
    }
    // Rational/fractional exponents
    else {
      cost += COST.POW_RATIONAL_EXP;
    }
  }
  // Variable exponent is most complex
  else if (exponent.kind === 'symbol') {
    cost += COST.POW_VAR_EXP;
  }

  return cost;
}

function calculateSqrtCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return COST.SQRT_COST;
  return args[0].getCost() + COST.SQRT_COST;
}

function calculateLogCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return COST.LOG_COST;
  return args.reduce((sum, child) => sum + child.getCost(), 0) + COST.LOG_COST;
}

function calculateExpCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return COST.EXP_COST;
  return args[0].getCost() + COST.EXP_COST;
}

function calculateEvalCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return COST.EVAL_BASE_COST;

  const innerExpr = args[0];

  // If eval contains a simple value (number or symbol), it's complete
  if (innerExpr.kind === 'number' || innerExpr.kind === 'symbol') {
    return innerExpr.getCost() + COST.EVAL_COMPLETE;
  }

  // Otherwise, eval adds a small wrapper cost
  return innerExpr.getCost() + COST.EVAL_BASE_COST;
}

function calculateSolveCost(args: ReadonlyArray<AstNode>): number {
  if (args.length < 2) return COST.SOLVE_BASE_COST;

  const [equation, goal] = args;
  let cost = equation.getCost() + goal.getCost() + COST.SOLVE_BASE_COST;

  // Try to determine complexity based on the equation
  if (equation.kind === 'eq') {
    const eqArgs = equation.children ?? [];
    if (eqArgs.length === 2) {
      const [left, right] = eqArgs;

      // Check if it looks linear (simple)
      const isLinear = !containsPower(left) && !containsPower(right);
      if (isLinear) {
        cost += COST.SOLVE_LINEAR;
      }
      // Check if it looks quadratic
      else if (hasMaxPower(left, 2) && hasMaxPower(right, 2)) {
        cost += COST.SOLVE_QUADRATIC;
      }
      // Higher degree equations
      else {
        cost += COST.SOLVE_HIGHER;
      }
    }
  }

  return cost;
}

function calculateEqCost(args: ReadonlyArray<AstNode>): number {
  if (args.length !== 2) return COST.EQ_BASE_COST;

  const [left, right] = args;
  let cost = left.getCost() + right.getCost() + COST.EQ_BASE_COST;

  // If it's in solved form (variable = value or value = variable), it's cheaper
  const isSolved =
    (left.kind === 'symbol' && (right.kind === 'number' || right.kind === 'symbol')) ||
    (right.kind === 'symbol' && (left.kind === 'number' || left.kind === 'symbol'));

  if (isSolved) {
    cost += COST.EQ_SOLVED;
  } else {
    cost += COST.EQ_UNSOLVED;
  }

  return cost;
}

// Helper: Check if expression contains a power function
function containsPower(node: AstNode): boolean {
  if (node.kind === 'func' && node.value === 'pow') {
    return true;
  }
  if (node.children) {
    return node.children.some(child => containsPower(child));
  }
  return false;
}

// Helper: Get maximum power degree in an expression
function hasMaxPower(node: AstNode, maxDegree: number): boolean {
  if (node.kind === 'func' && node.value === 'pow') {
    const args = node.children ?? [];
    if (args.length === 2 && args[1].kind === 'number') {
      const degree = args[1].value as number;
      if (degree > maxDegree) {
        return false;
      }
    }
  }
  if (node.children) {
    return node.children.every(child => hasMaxPower(child, maxDegree));
  }
  return true;
}

function areEqual(a: AstNode, b: AstNode): boolean {
  if (a.kind !== b.kind) return false;

  if (a.kind === 'number' && b.kind === 'number') {
    return a.value === b.value;
  }

  if (a.kind === 'symbol' && b.kind === 'symbol') {
    const aSym = a.value as ASymbol;
    const bSym = b.value as ASymbol;
    return aSym.name === bSym.name;
  }

  // For other types, use string comparison as fallback
  return a.toString() === b.toString();
}

function areInverses(a: AstNode, b: AstNode): boolean {
  // Check if b is neg(a)
  if (b.kind === 'func' && b.value === 'neg' && b.children && b.children.length === 1) {
    return areEqual(a, b.children[0]);
  }

  // Check if a is neg(b)
  if (a.kind === 'func' && a.value === 'neg' && a.children && a.children.length === 1) {
    return areEqual(a.children[0], b);
  }

  return false;
}
