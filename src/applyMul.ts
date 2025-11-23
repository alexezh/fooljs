import { createModel } from "./model.js";
import { calculateMultiplicationCost, COST } from "./terms.js";
import { AModel, ARef, createAref, createDelayedRef, DelayedOp, getBaseVariable, getPower, getRefText, getVariableName, isNumber, isVariable, isVariableRef, splice, tokenEquals } from "./token.js";


/**
 * Apply multiplication operations - yields AModel with delayed ops
 */
export function* applyMul(model: AModel): Generator<AModel> {
  const tokens = model.refs;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // number * variable -> coefficient-variable with delayed op
      if (isNumber(left) && isVariableRef(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const varName = getVariableName(right) ?? getRefText(right);
        const power = getPower(right);
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${getRefText(left)}${varName}${powerStr}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        resultRef.variableName = varName;
        resultRef.power = power;
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      } else if (isVariableRef(left) && isNumber(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left: right, right: left };
        const varName = getVariableName(left) ?? getRefText(left);
        const power = getPower(left);
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${getRefText(right)}${varName}${powerStr}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        resultRef.variableName = varName;
        resultRef.power = power;
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      }

      // variable * variable (same variable) -> power with delayed op
      if (isVariableRef(left) && isVariableRef(right)) {
        const leftVarName = getVariableName(left);
        const rightVarName = getVariableName(right);

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const leftPower = getPower(left);
          const rightPower = getPower(right);
          const totalPower = leftPower + rightPower;

          const baseRef = getBaseVariable(left) ?? left;
          const delayedOp: DelayedOp = { kind: 'pow', base: baseRef, exponent: createAref(String(totalPower), [], totalPower) };
          const resultText = totalPower === 1
            ? leftVarName
            : `${leftVarName}^${totalPower}`;
          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          resultRef.variableName = leftVarName;
          resultRef.power = totalPower;
          const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

          yield createModel(model, `multiply_same_var_${i}`, newTokens, COST.SAME_VAR_MUL, resultRef);
        }
      }

      // number * number -> delayed multiplication
      if (isNumber(left) && isNumber(right)) {
        const leftValue = left.value ?? parseInt(getRefText(left), 10);
        const rightValue = right.value ?? parseInt(getRefText(right), 10);
        const cost = calculateMultiplicationCost(leftValue, rightValue);

        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const resultText = `(${getRefText(left)}*${getRefText(right)})`;
        const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_numbers_${i}`, newTokens, cost, resultRef);
      }
    }
  }
}
