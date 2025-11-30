import { AModel, createModel } from "./model.js";
import { COST } from "./terms.js";
import { createNumberRef, createSymbolRef, splice, tokenEquals, makeComputeFunction } from "./token.js";

/**
 * Apply division operations - yields AModel with delayed ops
*/
export function* applyDiv(model: AModel): Generator<AModel> {
  const refs = model.refs;

  for (let i = 1; i < refs.length - 1; i++) {
    if (tokenEquals(refs[i], '/')) {
      const left = refs[i - 1];
      const right = refs[i + 1];

      // number / number
      if (left.isNumber && right.isNumber) {
        const rightVal = parseInt(right.symbol || '0', 10);
        const leftVal = parseInt(left.symbol || '0', 10);
        if (rightVal !== 0 && leftVal % rightVal === 0) {
          const op = refs[i];
          const computeValue = (): number | null => {
            const lval = left.value;
            const rval = right.value;
            if (typeof lval === 'number' && typeof rval === 'number' && rval !== 0) {
              return lval / rval;
            }
            return null;
          };
          const resultRef = createSymbolRef(model.cache, [left, op, right], undefined, makeComputeFunction(computeValue));
          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);

          yield createModel(model, `divide_numbers_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }

      // variable / variable
      if (left.isSymbol && right.isSymbol) {
        const leftBase = left.getBase();
        const rightBase = right.getBase();
        const leftVarName = leftBase.getVariableName();
        const rightVarName = rightBase.getVariableName();

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const leftPower = left.getPower();
          const rightPower = right.getPower();

          const op = refs[i];
          const computeValue = (): number | null => {
            const lval = left.value;
            const rval = right.value;
            if (typeof lval === 'number' && typeof rval === 'number' && rval !== 0) {
              return lval / rval;
            }
            return null;
          };

          const resultRef = createSymbolRef(model.cache, [left, op, right], undefined, makeComputeFunction(computeValue));
          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);
          yield createModel(model, `divide_vars_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }
    }
  }
}
