import { AModel, createModel } from "./model.js";
import { COST } from "./terms.js";
import { createAref, createDelayedRef, DelayedOp, getRefText, splice, tokenEquals } from "./token.js";

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
        const rightVal = parseInt(getRefText(right), 10);
        const leftVal = parseInt(getRefText(left), 10);
        if (rightVal !== 0 && leftVal % rightVal === 0) {
          const delayedOp: DelayedOp = { kind: 'div', left, right };
          const resultText = `(${getRefText(left)}/${getRefText(right)})`;
          const op = refs[i];
          const resultRef = createDelayedRef(resultText, [left, op, right], delayedOp);
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
              delayedOp = { kind: 'pow', base: leftBase, exponent: createAref('1', [], 1) };
            } else if (powerDiff > 1) {
              resultText = `${leftVarName}^${powerDiff}`;
              delayedOp = { kind: 'pow', base: leftBase, exponent: createAref(String(powerDiff), [], powerDiff) };
            } else {
              // Negative power: 1/x^n
              resultText = `1/${leftVarName}^${-powerDiff}`;
              delayedOp = { kind: 'div', left: createAref('1', [], 1), right: leftBase };
            }

            resultRef = createDelayedRef(resultText, [left, op, right], delayedOp);
          } else {
            // Powers are expressions - keep as division expression
            const resultText = `(${getRefText(left)}/${getRefText(right)})`;
            delayedOp = { kind: 'div', left, right };
            resultRef = createDelayedRef(resultText, [left, op, right], delayedOp);
          }

          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);
          yield createModel(model, `divide_vars_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }
    }
  }
}
