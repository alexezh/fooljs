import { AModel, createModel } from "./model.js";
import { COST } from "./terms.js";
import { createDelayedRef, DelayedOp, getBaseVariable, getPower, getRefText, getVariableName, isVariableRef, splice, tokenEquals } from "./token.js";

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
          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);

          yield createModel(model, `divide_numbers_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }

      // variable / variable (using new helper functions)
      if (isVariableRef(left) && isVariableRef(right)) {
        const leftVarName = getVariableName(left);
        const rightVarName = getVariableName(right);

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const leftPower = getPower(left);
          const rightPower = getPower(right);
          const powerDiff = leftPower - rightPower;

          const leftBase = getBaseVariable(left) ?? left;
          const rightBase = getBaseVariable(right) ?? right;
          const delayedOp: DelayedOp = { kind: 'div', left: leftBase, right: rightBase };

          let resultText: string;
          if (powerDiff === 0) {
            resultText = '1';
          } else if (powerDiff === 1) {
            resultText = leftVarName;
          } else if (powerDiff > 1) {
            resultText = `${leftVarName}^${powerDiff}`;
          } else {
            // Negative power: 1/x^n
            resultText = `1/${leftVarName}^${-powerDiff}`;
          }

          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          if (powerDiff > 0) {
            resultRef.variableName = leftVarName;
            resultRef.power = powerDiff;
          }
          const newTokens = splice(refs, i - 1, i + 2, [resultRef]);

          yield createModel(model, `divide_vars_${i}`, newTokens, COST.DIV_COST, resultRef);
        }
      }
    }
  }
}
