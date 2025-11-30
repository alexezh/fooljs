import { AModel, createModel } from "./model.js";
import { COST } from "./terms.js";
import { createDelayedRef, createNumberRef, createSymbolRef, DelayedOp, splice, tokenEquals } from "./token.js";
import { toSymbol } from "./asymbol.js";

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
          const delayedOp: DelayedOp = { kind: 'div', left, right };
          const resultText = `(${left.symbol}/${right.symbol})`;
          const op = refs[i];
          const resultRef = createDelayedRef(toSymbol(resultText), [left, op, right], delayedOp);
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
          let resultRef;
          let delayedOp: DelayedOp;

          // Check if both powers are digit values that we can subtract
          if (leftPower.isNumber && rightPower.isNumber &&
            typeof leftPower.value === 'number' && typeof rightPower.value === 'number') {
            const powerDiff = leftPower.value - rightPower.value;

            let resultText: string;
            if (powerDiff === 0) {
              resultText = '1';
              delayedOp = { kind: 'div', left: leftBase, right: rightBase };
            } else if (powerDiff === 1) {
              resultText = leftVarName;
              delayedOp = { kind: 'pow', base: leftBase, exponent: createNumberRef(1) };
            } else if (powerDiff > 1) {
              resultText = `${leftVarName}^${powerDiff}`;
              delayedOp = { kind: 'pow', base: leftBase, exponent: createSymbolRef(model.cache, [], powerDiff) };
            } else {
              // Negative power: 1/x^n
              resultText = `1/${leftVarName}^${-powerDiff}`;
              delayedOp = { kind: 'div', left: createNumberRef(1), right: leftBase };
            }

            resultRef = createDelayedRef(toSymbol(resultText), [left, op, right], delayedOp);
          } else {
            // Powers are expressions - keep as division expression
            const resultText = `(${left.symbol}/${right.symbol})`;
            delayedOp = { kind: 'div', left, right };
            resultRef = createDelayedRef(toSymbol(resultText), [left, op, right], delayedOp);
          }

          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);
          yield createModel(model, `divide_vars_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }
    }
  }
}
