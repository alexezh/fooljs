// =============================================================================
// Simplification rules - Algebraic simplifications for solving
// =============================================================================

import { AstNode, ASymbol, isNumber } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// Helper: Check if two nodes are the same symbol
function sameSymbol(a: AstNode, b: AstNode): boolean {
  if (a.kind !== 'symbol' || b.kind !== 'symbol') return false;
  const aSymbol = a.value as ASymbol;
  const bSymbol = b.value as ASymbol;
  return aSymbol.name === bSymbol.name;
}

// =============================================================================
// Like terms - Combine coefficients of same variable
// =============================================================================

// eval(sum(?rest..., mul(?a, ?x), mul(?b, ?x), ?more...)) => eval(sum(?rest..., mul(sum(?a, ?b), ?x), ?more...))
// Combines adjacent like terms
export function ruleCombineLikeTerms(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sum')) return undefined;

  const sumArgs = getArgs(inner);
  if (sumArgs.length < 2) return undefined;

  // Look for pattern: mul(?a, ?x), mul(?b, ?x) anywhere in the sum
  for (let i = 0; i < sumArgs.length; i++) {
    for (let j = i + 1; j < sumArgs.length; j++) {
      const term1 = sumArgs[i];
      const term2 = sumArgs[j];

      // Check if both are mul with same variable
      if (isFunc(term1, 'mul') && isFunc(term2, 'mul')) {
        const mul1Args = getArgs(term1);
        const mul2Args = getArgs(term2);

        if (mul1Args.length === 2 && mul2Args.length === 2) {
          // Try matching mul(?a, ?x) and mul(?b, ?x)
          const [a1, x1] = mul1Args;
          const [a2, x2] = mul2Args;

          if (isNumber(a1) && isNumber(a2) && sameSymbol(x1, x2)) {
            // Found like terms: mul(a1, x) and mul(a2, x)
            const newCoeff = AstNode.create('func', 'sum', [a1, a2]);
            const combinedTerm = AstNode.create('func', 'mul', [newCoeff, x1]);

            // Build new sum with combined term
            const newTerms = [
              ...sumArgs.slice(0, i),
              ...sumArgs.slice(i + 1, j),
              combinedTerm,
              ...sumArgs.slice(j + 1)
            ];

            if (newTerms.length === 1) {
              return AstNode.create('func', 'eval', [newTerms[0]]);
            }

            return AstNode.create('func', 'eval', [
              AstNode.create('func', 'sum', newTerms)
            ]);
          }

          // Try reverse order: mul(?x, ?a)
          if (isNumber(x1) && isNumber(x2) && sameSymbol(a1, a2)) {
            const newCoeff = AstNode.create('func', 'sum', [x1, x2]);
            const combinedTerm = AstNode.create('func', 'mul', [a1, newCoeff]);

            const newTerms = [
              ...sumArgs.slice(0, i),
              ...sumArgs.slice(i + 1, j),
              combinedTerm,
              ...sumArgs.slice(j + 1)
            ];

            if (newTerms.length === 1) {
              return AstNode.create('func', 'eval', [newTerms[0]]);
            }

            return AstNode.create('func', 'eval', [
              AstNode.create('func', 'sum', newTerms)
            ]);
          }
        }
      }
    }
  }

  return undefined;
}

// =============================================================================
// Subtraction expansion rules
// =============================================================================

// eval(sub(sum(?terms...), ?b)) => eval(sum(?terms..., neg(?b)))
// Expands subtraction of sum to add negation
export function ruleSubExpandSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sub')) return undefined;

  const subArgs = getArgs(inner);
  if (subArgs.length !== 2) return undefined;

  const [a, b] = subArgs;

  // If a is sum, expand: sub(sum(...), b) => sum(..., neg(b))
  if (isFunc(a, 'sum')) {
    const sumArgs = getArgs(a);
    const newTerms = [...sumArgs, AstNode.create('func', 'neg', [b])];
    return AstNode.create('func', 'eval', [
      AstNode.create('func', 'sum', newTerms)
    ]);
  }

  return undefined;
}

// eval(sum(?rest..., ?a, ?b, ?more...)) => eval(sum(?rest..., sum(?a, ?b), ?more...))
// where ?a and ?b are numbers
// Combines any two numbers in a sum
export function ruleCombineNumbers(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sum')) return undefined;

  const sumArgs = getArgs(inner);
  if (sumArgs.length < 2) return undefined;

  // Find any pair of numbers (not just adjacent)
  for (let i = 0; i < sumArgs.length; i++) {
    for (let j = i + 1; j < sumArgs.length; j++) {
      if (isNumber(sumArgs[i]) && isNumber(sumArgs[j])) {
        // Found two numbers, combine them
        const newTerms = [
          ...sumArgs.slice(0, i),
          ...sumArgs.slice(i + 1, j),
          AstNode.create('func', 'sum', [sumArgs[i], sumArgs[j]]),
          ...sumArgs.slice(j + 1)
        ];

        if (newTerms.length === 1) {
          return AstNode.create('func', 'eval', [newTerms[0]]);
        }

        return AstNode.create('func', 'eval', [
          AstNode.create('func', 'sum', newTerms)
        ]);
      }
    }
  }

  return undefined;
}
