import { isGoal } from './goal.js';
import { ARef } from './token.js';
import { COST } from './terms.js';

// Re-export cost calculation functions from terms.ts
export {
  calculateAdditionCost,
  calculateMultiplicationCost,
  calculateSubtractionCost,
  COST
} from './terms.js';

export function heuristic(tokens: ARef[]): number {
  // Heuristic: prefer fewer tokens, but account for goal structure
  // Goal structures with multiple variables are acceptable
  if (isGoal(tokens)) {
    return 0;
  }
  // Simple heuristic: number of tokens left
  return tokens.length;
}
