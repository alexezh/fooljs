import { AModel, createModel } from "./model.js";
import { calculateMultiplicationCost, COST } from "./terms.js";
import { ARef, createDelayedRef, createSymbolRef, DelayedOp, splice, tokenEquals } from "./token.js";
import { toSymbol } from "./asymbol.js";


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
        const varName = right.symbol || '';
        const powerRef = right.getPower();
        const power = powerRef.isNumber && typeof powerRef.value === 'number' ? powerRef.value : 1;
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${left.symbol}${varName}${powerStr}`;
        const op = tokens[i];
        const resultRef = createDelayedRef(toSymbol(combinedText), [left, op, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      } else if (left.isSymbol && right.isNumber) {
        const delayedOp: DelayedOp = { kind: 'mul', left: right, right: left };
        const varName = left.symbol || '';
        const powerRef = left.getPower();
        const power = powerRef.isNumber && typeof powerRef.value === 'number' ? powerRef.value : 1;
        const powerStr = power > 1 ? `^${power}` : '';
        const combinedText = `${right.symbol}${varName}${powerStr}`;
        const op = tokens[i];
        const resultRef = createDelayedRef(toSymbol(combinedText), [left, op, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_coeff_var_${i}`, newTokens, COST.COEFF_VAR_MUL, resultRef);
      }

      // symbol * symbol (same variable) -> power with delayed op
      if (left.isSymbol && right.isSymbol) {
        const leftVarName = left.symbol;
        const rightVarName = right.symbol;

        if (leftVarName && rightVarName && leftVarName === rightVarName) {
          const leftPowerRef = left.getPower();
          const rightPowerRef = right.getPower();
          const leftPower = leftPowerRef.isNumber && typeof leftPowerRef.value === 'number' ? leftPowerRef.value : 1;
          const rightPower = rightPowerRef.isNumber && typeof rightPowerRef.value === 'number' ? rightPowerRef.value : 1;
          const totalPower = leftPower + rightPower;

          const baseRef = left.getBase();
          const delayedOp: DelayedOp = { kind: 'pow', base: baseRef, exponent: createSymbolRef(model.cache, [], totalPower) };
          const resultText = totalPower === 1
            ? leftVarName
            : `${leftVarName}^${totalPower}`;
          const op = tokens[i];
          const resultRef = createDelayedRef(toSymbol(resultText), [left, op, right], delayedOp);
          const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

          yield createModel(model, `multiply_same_var_${i}`, newTokens, COST.SAME_VAR_MUL, resultRef);
        }
      }

      // number * number -> delayed multiplication
      if (left.isNumber && right.isNumber) {
        const leftValue = left.value ?? parseInt(left.symbol || '0', 10);
        const rightValue = right.value ?? parseInt(right.symbol || '0', 10);
        const cost = calculateMultiplicationCost(leftValue, rightValue);

        const delayedOp: DelayedOp = { kind: 'mul', left, right };
        const resultText = `(${left.symbol}*${right.symbol})`;
        const resultRef = createDelayedRef(toSymbol(resultText), [left, right], delayedOp);
        const newTokens = splice(tokens, i - 1, i + 2, [resultRef]);

        yield createModel(model, `multiply_numbers_${i}`, newTokens, cost, resultRef);
      }
    }
  }
}
