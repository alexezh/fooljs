import { AModel, createModel } from "./model.js";
import { calculateMultiplicationCost, COST } from "./terms.js";
import { ARef, createAref, createDelayedRef, DelayedOp, getRefText, splice, tokenEquals } from "./token.js";


/**
 * Apply multiplication operations - yields AModel with delayed ops
 */
export function* applyMul(model: AModel): Generator<AModel> {
  const tokens = model.refs;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // number * symbol -> coefficient-variable with delayed op
      if (left.isNumber && right.isSymbol) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const varName = getRefText(right);
        const powerRef = right.getPower();
        const power = powerRef.isNumber && typeof powerRef.value === 'number' ? powerRef.value : 1;
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${getRefText(left)}${varName}${powerStr}`;
        const op = tokens[i];
        const resultRef = createDelayedRef(combinedText, [left, op, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      } else if (left.isSymbol && right.isNumber) {
        const delayedOp: DelayedOp = { kind: 'mul', left: right, right: left };
        const varName = getRefText(left);
        const powerRef = left.getPower();
        const power = powerRef.isNumber && typeof powerRef.value === 'number' ? powerRef.value : 1;
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${getRefText(right)}${varName}${powerStr}`;
        const op = tokens[i];
        const resultRef = createDelayedRef(combinedText, [left, op, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      }

      // symbol * symbol (same variable) -> power with delayed op
      if (left.isSymbol && right.isSymbol) {
        const leftVarName = getRefText(left);
        const rightVarName = getRefText(right);

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const leftPowerRef = left.getPower();
          const rightPowerRef = right.getPower();
          const leftPower = leftPowerRef.isNumber && typeof leftPowerRef.value === 'number' ? leftPowerRef.value : 1;
          const rightPower = rightPowerRef.isNumber && typeof rightPowerRef.value === 'number' ? rightPowerRef.value : 1;
          const totalPower = leftPower + rightPower;

          const baseRef = left.getBase();
          const delayedOp: DelayedOp = { kind: 'pow', base: baseRef, exponent: createAref(String(totalPower), [], totalPower) };
          const resultText = totalPower === 1
            ? leftVarName
            : `${leftVarName}^${totalPower}`;
          const op = tokens[i];
          const resultRef = createDelayedRef(resultText, [left, op, right], delayedOp);
          const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

          yield createModel(model, `multiply_same_var_${i}`, newTokens, COST.SAME_VAR_MUL, resultRef);
        }
      }

      // number * number -> delayed multiplication
      if (left.isNumber && right.isNumber) {
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
