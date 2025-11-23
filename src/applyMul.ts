import { getBoolAttr, getVariablePower, calculateMultiplicationCost, COST } from "./terms.js";
import { AModel, ARef, createAref, createDelayedRef, createModel, DelayedOp, getRefText, isNumber, isVariable, splice, tokenEquals } from "./token.js";

/**
 * Apply multiplication operations - yields AModel with delayed ops
 */
export function* applyMul(model: AModel): Generator<AModel> {
  const tokens = model.refs;

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
      const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

      if (!(leftIsFactor && rightIsFactor)) {
        continue;
      }

      // number * variable -> coefficient-variable with delayed op
      if (isNumber(left) && isVariable(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const combinedText = `${getRefText(left)}${getRefText(right)}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      } else if (isVariable(left) && isNumber(right)) {
        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const combinedText = `${getRefText(right)}${getRefText(left)}`;
        const resultRef = createDelayedRef(combinedText, [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      }

      // variable * variable (same variable) -> power with delayed op
      const leftResult = getVariablePower(tokens, i - 1);
      const rightResult = getVariablePower(tokens, i + 1);

      if (leftResult.variable && rightResult.variable) {
        if (getRefText(leftResult.variable) === getRefText(rightResult.variable)) {
          const totalPower = (leftResult.power ?? 1) + (rightResult.power ?? 1);
          const delayedOp: DelayedOp = { kind: 'pow', base: leftResult.variable, exponent: createAref(String(totalPower)) };
          const resultText = totalPower === 1
            ? getRefText(leftResult.variable)
            : `${getRefText(leftResult.variable)}^${totalPower}`;
          const resultRef = createDelayedRef(resultText, [left, right], delayedOp);
          const newTokens = splice(tokens, i - 1, rightResult.endIndex, [resultRef]);

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
