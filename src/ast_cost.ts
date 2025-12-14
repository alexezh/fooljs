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
        break;

      default:
        // Default cost: sum of children costs plus base expression cost
        const childrenCost = args.reduce((sum, child) => sum + child.getCost(), 0);
        return childrenCost + COST.EXPR_COMBINE_COST;
    }
  }

  // Default for other node types
  return 1;
}

function calculateSumCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return 0;
  if (args.length === 1) return args[0].getCost();

  let cost = 0;

  // Check for special cases
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check if adding zero
    if (arg.kind === 'number' && arg.value === 0) {
      cost += COST.ADD_ZERO;
      continue;
    }

    // Check for variable cancellation (x + neg(x) = 0)
    if (i < args.length - 1) {
      const next = args[i + 1];
      if (areInverses(arg, next)) {
        cost += COST.VAR_CANCEL_REWARD;
        continue;
      }
    }

    // Check if number
    if (arg.kind === 'number') {
      const argNum = Math.abs(arg.value as number);
      const digits = argNum === 0 ? 1 : Math.floor(Math.log10(argNum)) + 1;

      if (digits === 1) {
        cost += COST.ADD_SINGLE_DIGIT;
      } else {
        cost += digits * COST.ADD_PER_DIGIT;
      }
    } else if (arg.kind === 'symbol') {
      // Variable operations
      cost += COST.VAR_BASE_COST;

      // Check for like terms (e.g., x + x)
      for (let j = i + 1; j < args.length; j++) {
        if (areEqual(arg, args[j])) {
          cost += COST.VAR_COMBINE_COST;
          break;
        }
      }
    } else {
      // Expression
      cost += arg.getCost() + COST.EXPR_COMBINE_COST;
    }
  }

  return cost;
}

function calculateMulCost(args: ReadonlyArray<AstNode>): number {
  if (args.length === 0) return 0;
  if (args.length === 1) return args[0].getCost();

  let cost = 0;

  // Check for special cases
  for (const arg of args) {
    // Check if multiplying by zero
    if (arg.kind === 'number' && arg.value === 0) {
      return COST.MUL_BY_ZERO;
    }

    // Check if multiplying by one
    if (arg.kind === 'number' && arg.value === 1) {
      cost += COST.MUL_BY_ONE;
      continue;
    }
  }

  // Calculate cost based on operands
  const numberArgs = args.filter(a => a.kind === 'number');
  const varArgs = args.filter(a => a.kind === 'symbol');
  const exprArgs = args.filter(a => a.kind !== 'number' && a.kind !== 'symbol');

  // Number multiplication
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

  // Coefficient * variable (e.g., 3 * x)
  if (numberArgs.length > 0 && varArgs.length > 0) {
    cost += COST.COEFF_VAR_MUL;
  }

  // Same variable multiplication (e.g., x * x)
  if (varArgs.length >= 2 && areEqual(varArgs[0], varArgs[1])) {
    cost += COST.SAME_VAR_MUL;
  }

  // Variable base cost
  cost += varArgs.length * COST.VAR_BASE_COST;

  // Expression costs
  cost += exprArgs.reduce((sum, expr) => sum + expr.getCost() + COST.EXPR_COMBINE_COST, 0);

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
