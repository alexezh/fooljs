import { isGoal } from './goal.js';
import { ARef } from './token.js';

function countDigits(value: number): number {
  return Math.abs(value).toString().length;
}

export function calculateAdditionCost(leftValue: number, rightValue: number): number {
  // Add of 0 - cost 1
  if (leftValue === 0 || rightValue === 0) {
    return 1;
  }

  // Single digit numbers - cost 1
  if (countDigits(leftValue) === 1 && countDigits(rightValue) === 1) {
    return 1;
  }

  // More than single digit - cost N where N is max number of digits
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits;
}

export function calculateMultiplicationCost(leftValue: number, rightValue: number): number {
  // Multiply by 0 - cost 1
  if (leftValue === 0 || rightValue === 0) {
    return 1;
  }

  // Single digit numbers - cost 2
  if (countDigits(leftValue) === 1 && countDigits(rightValue) === 1) {
    return 2;
  }

  // More than single digit - cost N^2 where N is max number of digits
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits ** 2;
}

export function calculateSubtractionCost(leftValue: number, rightValue: number): number {
  // Subtract same number - cost 1
  if (leftValue === rightValue) {
    return 1;
  }

  // Subtract numbers different by 1 - cost 2
  if (Math.abs(leftValue - rightValue) === 1) {
    return 2;
  }

  // More complex subtraction - cost N where N is max number of digits
  const maxDigits = Math.max(countDigits(leftValue), countDigits(rightValue));
  return maxDigits;
}

export function heuristic(tokens: ARef[]): number {
  // Heuristic: prefer fewer tokens, but account for goal structure
  // Goal structures with multiple variables are acceptable
  if (isGoal(tokens)) {
    return 0;
  }
  // Simple heuristic: number of tokens left
  return tokens.length;
}
