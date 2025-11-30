import { AModel, createModel } from "./model.js";
import { calculateMultiplicationCost, COST } from "./terms.js";
import { ARef, createSymbolRef, splice, tokenEquals } from "./token.js";


/**
 * Apply multiplication operations - yields AModel with delayed ops
 */
export function* applyMul(model: AModel): Generator<AModel> {
  const tokens = model.refs;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // number * symbol -> coefficient-variable with compute
      if (left.isNumber && right.isSymbol) {
        const op = tokens[i];
        const compute = () => {
          const leftVal = left.value;
          const rightVal = right.value;
          if (typeof leftVal === 'number' && typeof rightVal === 'number') {
            return leftVal * rightVal;
          }
          return null;
        };
        const resultRef = createSymbolRef(model.cache, [left, op, right], undefined, compute);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      } else if (left.isSymbol && right.isNumber) {
        const op = tokens[i];
        const compute = () => {
          const leftVal = left.value;
          const rightVal = right.value;
          if (typeof leftVal === 'number' && typeof rightVal === 'number') {
            return leftVal * rightVal;
          }
          return null;
        };
        const resultRef = createSymbolRef(model.cache, [left, op, right], undefined, compute);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      }

      // symbol * symbol (same variable) -> power with compute
      if (left.isSymbol && right.isSymbol) {
        const leftVarName = left.symbol;
        const rightVarName = right.symbol;

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const op = tokens[i];
          const compute = () => {
            const leftVal = left.value;
            const rightVal = right.value;
            if (typeof leftVal === 'number' && typeof rightVal === 'number') {
              return Math.pow(leftVal, 2);
            }
            return null;
          };
          const resultRef = createSymbolRef(model.cache, [left, op, right], undefined, compute);
          const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

          yield createModel(model, `multiply_same_var_${i}`, newTokens, COST.SAME_VAR_MUL, resultRef);
        }
      }

      // number * number -> multiplication with compute
      if (left.isNumber && right.isNumber) {
        const leftValue = left.value ?? parseInt(left.symbol || '0', 10);
        const rightValue = right.value ?? parseInt(right.symbol || '0', 10);
        const cost = calculateMultiplicationCost(leftValue, rightValue);

        const compute = () => {
          const lval = left.value;
          const rval = right.value;
          if (typeof lval === 'number' && typeof rval === 'number') {
            return lval * rval;
          }
          return null;
        };
        const resultRef = createSymbolRef(model.cache, [left, right], undefined, compute);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_numbers_${i}`, newTokens, cost, resultRef);
      }
    }
  }
}
