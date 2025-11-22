import { AToken, ARef, tokenEquals, isNumber, isVariable, getRefText, splice, createAref, AModel } from './token.js';
import { makeMultTerm } from './transform.js';
import {
  calculateAdditionCost,
  calculateMultiplicationCost,
  calculateSubtractionCost
} from './weight.js';

// ============================================================================
// Type definitions
// ============================================================================

interface VariablePowerResult {
  variable: ARef | null;
  power: number | null;
  endIndex: number;
}

// Action info interfaces for type safety
interface BaseActionInfo {
  type: string;
  originalTokens: ReadonlyArray<ARef>;
  actionName: string;
}

interface MultiplyCoeffVarActionInfo extends BaseActionInfo {
  type: 'multiply_coeff_var';
  position: number;
  leftToken: ARef;
  rightToken: ARef;
  pattern: 'number_variable' | 'variable_number';
  id: string;
}

interface MultiplySameVarActionInfo extends BaseActionInfo {
  type: 'multiply_same_var';
  position: number;
  variable: ARef;
  leftPower: number;
  rightPower: number;
  totalPower: number;
  leftEnd: number;
  rightEnd: number;
  id: string;
}

interface MultiplyNumbersActionInfo extends BaseActionInfo {
  type: 'multiply_numbers';
  position: number;
  leftToken: ARef;
  rightToken: ARef;
  id: string;
}

interface WrapMultActionInfo extends BaseActionInfo {
  type: 'wrap_mult';
  context: string;
}

interface ComputeSumActionInfo extends BaseActionInfo {
  type: 'compute_sum';
  operation: '+';
  position: number;
  leftToken: ARef;
  rightToken: ARef;
}

interface ComputeSubActionInfo extends BaseActionInfo {
  type: 'compute_sub';
  operation: '-';
  position: number;
  leftToken: ARef;
  rightToken: ARef;
}

interface CombineTermsActionInfo extends BaseActionInfo {
  type: 'combine_terms';
  position: number;
  startPos: number;
  endPos: number;
  variable: ARef;
  power: number;
  sourceTokens: ARef[];
  id: string;
}

interface SubtractLikeTermsActionInfo extends BaseActionInfo {
  type: 'subtract_like_terms';
  position: number;
  startPos: number;
  endPos: number;
  variable: ARef;
  power: number;
  sourceTokens: ARef[];
  id: string;
}

interface ReorderActionInfo extends BaseActionInfo {
  type: 'reorder';
  position: number;
  leftToken: ARef;
  rightToken: ARef;
  reorderPattern: 'number_first' | 'keep_order';
}

type ActionInfo =
  | MultiplyCoeffVarActionInfo
  | MultiplySameVarActionInfo
  | MultiplyNumbersActionInfo
  | WrapMultActionInfo
  | ComputeSumActionInfo
  | ComputeSubActionInfo
  | CombineTermsActionInfo
  | SubtractLikeTermsActionInfo
  | ReorderActionInfo;

// Type-safe action tuple interface (replaces Python tuple)
export interface Action {
  cost: number;
  name: string;
  actionType: string;
  actionInfo: ActionInfo;
}

// ============================================================================
// Helper functions
// ============================================================================

// TODO: implement in tokenattrs.ts
function getBoolAttr(token: ARef, attr: string, tokens: ReadonlyArray<ARef>): boolean {
  // Placeholder implementation
  if (attr === 'is_factor') {
    // Check if token is adjacent to a * operator
    const idx = tokens.indexOf(token);
    if (idx > 0 && tokenEquals(tokens[idx - 1], '*')) return true;
    if (idx < tokens.length - 1 && tokenEquals(tokens[idx + 1], '*')) return true;
    return false;
  }
  if (attr === 'is_term') {
    // A term is something that can be added/subtracted
    // Not adjacent to * operator
    const idx = tokens.indexOf(token);
    if (idx > 0 && tokenEquals(tokens[idx - 1], '*')) return false;
    if (idx < tokens.length - 1 && tokenEquals(tokens[idx + 1], '*')) return false;
    return true;
  }
  return false;
}

function getVariablePower(tokens: ReadonlyArray<ARef>, startIdx: number): VariablePowerResult {
  if (startIdx >= tokens.length) {
    return { variable: null, power: null, endIndex: startIdx };
  }

  if (isVariable(tokens[startIdx])) {
    const variable = tokens[startIdx];
    // Check if next tokens are ^ and number
    if (
      startIdx + 2 < tokens.length &&
      tokenEquals(tokens[startIdx + 1], '^') &&
      isNumber(tokens[startIdx + 2])
    ) {
      const power = parseInt(getRefText(tokens[startIdx + 2]), 10);
      return { variable, power, endIndex: startIdx + 3 };
    } else {
      return { variable, power: 1, endIndex: startIdx + 1 };
    }
  }
  return { variable: null, power: null, endIndex: startIdx };
}

function operationName(op: string): string {
  return op === '+' ? 'sum' : 'sub';
}

// ============================================================================
// Action generators
// ============================================================================

export function applyMul(tokens: ReadonlyArray<ARef>): Action[] {
  const actions: Action[] = [];

  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '*')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // Check if both operands are factors in multiplication
      const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
      const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

      if (!(leftIsFactor && rightIsFactor)) {
        continue;
      }

      // number * variable or variable * number
      if (isNumber(left) && isVariable(right)) {
        const actionInfo: MultiplyCoeffVarActionInfo = {
          type: 'multiply_coeff_var',
          position: i,
          leftToken: left,
          rightToken: right,
          pattern: 'number_variable',
          originalTokens: tokens,
          id: `multiply_coeff_var_${i}`,
          actionName: `multiply_coeff_var_${i}`
        };
        actions.push({
          cost: 2,
          name: `multiply_coeff_var_${i}`,
          actionType: 'action_multiply_coeff_var',
          actionInfo
        });
      } else if (isVariable(left) && isNumber(right)) {
        const actionInfo: MultiplyCoeffVarActionInfo = {
          type: 'multiply_coeff_var',
          position: i,
          leftToken: left,
          rightToken: right,
          pattern: 'variable_number',
          originalTokens: tokens,
          id: `multiply_coeff_var_${i}`,
          actionName: `multiply_coeff_var_${i}`
        };
        actions.push({
          cost: 2,
          name: `multiply_coeff_var_${i}`,
          actionType: 'action_multiply_coeff_var',
          actionInfo
        });
      }

      // Check for variable * variable patterns (including powers)
      const leftResult = getVariablePower(tokens, i - 1);
      const rightResult = getVariablePower(tokens, i + 1);

      if (leftResult.variable && rightResult.variable) {
        if (getRefText(leftResult.variable) === getRefText(rightResult.variable)) {
          // Same variable: x * x = x^2, x^2 * x^3 = x^5
          const totalPower = (leftResult.power ?? 0) + (rightResult.power ?? 0);
          const actionInfo: MultiplySameVarActionInfo = {
            type: 'multiply_same_var',
            position: i,
            variable: leftResult.variable,
            leftPower: leftResult.power ?? 1,
            rightPower: rightResult.power ?? 1,
            totalPower,
            leftEnd: leftResult.endIndex,
            rightEnd: rightResult.endIndex,
            originalTokens: tokens,
            id: `multiply_same_var_${i}`,
            actionName: `multiply_same_var_${i}`
          };
          actions.push({
            cost: 2,
            name: `multiply_same_var_${i}`,
            actionType: 'action_multiply_same_var',
            actionInfo
          });
        }
        // Different variables: x * y = x*y (already in correct form, no action needed)
      }

      // number * number
      if (isNumber(left) && isNumber(right)) {
        const leftValue = left.value ?? parseInt(getRefText(left), 10);
        const rightValue = right.value ?? parseInt(getRefText(right), 10);
        const cost = calculateMultiplicationCost(leftValue, rightValue);

        const actionInfo: MultiplyNumbersActionInfo = {
          type: 'multiply_numbers',
          position: i,
          leftToken: left,
          rightToken: right,
          originalTokens: tokens,
          id: `multiply_numbers_${i}`,
          actionName: `multiply_numbers_${i}`
        };
        actions.push({
          cost,
          name: `multiply_numbers_${i}`,
          actionType: 'action_multiply_numbers',
          actionInfo
        });
      }
    }
  }

  return actions;
}

export function* applySum(model: AModel): Iterable<AModel> {
  const actions: Action[] = [];

  // Check if there are any multiplication terms in the expression
  let hasMultiplications = false;
  for (const token of tokens) {
    if (getBoolAttr(token, 'is_factor', tokens)) {
      hasMultiplications = true;
      break;
    }
  }

  // Generate single wrap action for all multiplications if any exist
  if (hasMultiplications) {
    const actionInfo: WrapMultActionInfo = {
      type: 'wrap_mult',
      originalTokens: tokens,
      context: 'wrap_all_multiplications',
      actionName: 'wrap_all_mult'
    };
    actions.push({
      cost: 1,
      name: 'wrap_all_mult',
      actionType: 'action_wrap_mult',
      actionInfo
    });
  }

  // Look for addition/subtraction operations
  for (let i = 1; i < tokens.length - 1; i++) {
    const op = getRefText(tokens[i]);
    if (op === '+' || op === '-') {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // Check if both operands are terms that can be added/subtracted
      const leftIsTerm = getBoolAttr(left, 'is_term', tokens);
      const rightIsTerm = getBoolAttr(right, 'is_term', tokens);

      if (!(leftIsTerm && rightIsTerm)) {
        continue;
      }

      // number +/- number - offer computation
      if (isNumber(left) && isNumber(right)) {
        const actionType = `action_compute_${operationName(op)}`;
        const actionName = `compute_${operationName(op)}_${i}`;

        const leftValue = left.value ?? parseInt(getRefText(left), 10);
        const rightValue = right.value ?? parseInt(getRefText(right), 10);

        const cost = op === '+'
          ? calculateAdditionCost(leftValue, rightValue)
          : calculateSubtractionCost(leftValue, rightValue);

        if (op === '+') {
          const actionInfo: ComputeSumActionInfo = {
            type: 'compute_sum',
            operation: '+',
            position: i,
            leftToken: left,
            rightToken: right,
            originalTokens: tokens,
            actionName
          };
          actions.push({ cost, name: actionName, actionType, actionInfo });
        } else {
          const actionInfo: ComputeSubActionInfo = {
            type: 'compute_sub',
            operation: '-',
            position: i,
            leftToken: left,
            rightToken: right,
            originalTokens: tokens,
            actionName
          };
          actions.push({ cost, name: actionName, actionType, actionInfo });
        }
      }

      // Handle pure variables with powers (produce separate tokens) - only for addition
      if (op === '+') {
        const leftResult = getVariablePower(tokens, i - 1);
        const rightResult = getVariablePower(tokens, i + 1);

        if (
          leftResult.variable &&
          rightResult.variable &&
          getRefText(leftResult.variable) === getRefText(rightResult.variable) &&
          leftResult.power === rightResult.power
        ) {
          const actionInfo: CombineTermsActionInfo = {
            type: 'combine_terms',
            position: i,
            startPos: i - 1,
            endPos: rightResult.endIndex,
            variable: leftResult.variable,
            power: leftResult.power ?? 1,
            sourceTokens: tokens.slice(i - 1, rightResult.endIndex),
            originalTokens: tokens,
            id: `combine_like_terms_${i}`,
            actionName: `combine_like_terms_${i}`
          };
          actions.push({
            cost: 3,
            name: `combine_like_terms_${i}`,
            actionType: 'action_combine_terms',
            actionInfo
          });
        }
      }

      // variable + number or number + variable (reorder) - only for addition
      if (op === '+' && isVariable(left) && isNumber(right)) {
        const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
        const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

        if (!(leftIsFactor || rightIsFactor)) {
          const actionInfo: ReorderActionInfo = {
            type: 'reorder',
            position: i,
            leftToken: left,
            rightToken: right,
            reorderPattern: 'number_first',
            originalTokens: tokens,
            actionName: `reorder_${i}`
          };
          actions.push({
            cost: 4,
            name: `reorder_${i}`,
            actionType: 'action_reorder',
            actionInfo
          });
        }
      }

      if (op === '+' && isNumber(left) && isVariable(right)) {
        const leftIsFactor = getBoolAttr(left, 'is_factor', tokens);
        const rightIsFactor = getBoolAttr(right, 'is_factor', tokens);

        if (!(leftIsFactor || rightIsFactor)) {
          const actionInfo: ReorderActionInfo = {
            type: 'reorder',
            position: i,
            leftToken: left,
            rightToken: right,
            reorderPattern: 'keep_order',
            originalTokens: tokens,
            actionName: `reorder_${i}`
          };
          actions.push({
            cost: 4,
            name: `reorder_${i}`,
            actionType: 'action_reorder',
            actionInfo
          });
        }
      }

      // Handle subtraction-specific operations
      if (op === '-') {
        const leftResult = getVariablePower(tokens, i - 1);
        const rightResult = getVariablePower(tokens, i + 1);

        if (
          leftResult.variable &&
          rightResult.variable &&
          getRefText(leftResult.variable) === getRefText(rightResult.variable) &&
          leftResult.power === rightResult.power
        ) {
          const actionInfo: SubtractLikeTermsActionInfo = {
            type: 'subtract_like_terms',
            position: i,
            startPos: i - 1,
            endPos: rightResult.endIndex,
            variable: leftResult.variable,
            power: leftResult.power ?? 1,
            sourceTokens: tokens.slice(i - 1, rightResult.endIndex),
            originalTokens: tokens,
            id: `subtract_like_terms_${i}`,
            actionName: `subtract_like_terms_${i}`
          };
          actions.push({
            cost: 3,
            name: `subtract_like_terms_${i}`,
            actionType: 'action_subtract_like_terms',
            actionInfo
          });
        }
      }
    }
  }

  return actions;
}

// ============================================================================
// Action executors
// ============================================================================

export function actionWrapMult(actionInfo: WrapMultActionInfo): ARef[] {
  const tokens = actionInfo.originalTokens;

  function detectAllMultTerms(tokens: ARef[]): Array<{ start: number; end: number }> {
    const multTerms: Array<{ start: number; end: number }> = [];
    let i = 0;

    while (i < tokens.length) {
      if (getBoolAttr(tokens[i], 'is_factor', tokens)) {
        const start = i;
        let end = i + 1;

        while (end < tokens.length) {
          if (tokenEquals(tokens[end], '*')) {
            end++;
            if (end < tokens.length && getBoolAttr(tokens[end], 'is_factor', tokens)) {
              end++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        multTerms.push({ start, end });
        i = end;
      } else {
        i++;
      }
    }
    return multTerms;
  }

  const multTerms = detectAllMultTerms(tokens);
  let newTokens = [...tokens];

  // Process from right to left to maintain correct indices
  for (let j = multTerms.length - 1; j >= 0; j--) {
    const { start, end } = multTerms[j];
    const multTokens = newTokens.slice(start, end);
    const multTerm = makeMultTerm(multTokens);
    newTokens = splice(newTokens, start, end, [multTerm]);
  }

  return newTokens;
}

export function actionComputeSum(actionInfo: ComputeSumActionInfo): ARef[] {
  const { originalTokens: tokens, position, leftToken, rightToken } = actionInfo;

  const leftValue = leftToken.value as number;
  const rightValue = rightToken.value as number;
  const resultValue = leftValue + rightValue;

  const resultAref = createAref(String(resultValue), [leftToken, rightToken], resultValue);
  return splice(tokens, position - 1, position + 2, [resultAref]);
}

export function actionComputeSub(actionInfo: ComputeSubActionInfo): ARef[] {
  const { originalTokens: tokens, position, leftToken, rightToken } = actionInfo;

  const leftValue = leftToken.value as number;
  const rightValue = rightToken.value as number;
  const resultValue = leftValue - rightValue;

  const resultAref = createAref(String(resultValue), [leftToken, rightToken], resultValue);
  return splice(tokens, position - 1, position + 2, [resultAref]);
}

export function actionCombineTerms(actionInfo: CombineTermsActionInfo): ARef[] {
  const { originalTokens: tokens, startPos, endPos, variable, power, sourceTokens } = actionInfo;

  if (power === 1) {
    // x + x = 2*x
    const twoAref = createAref('2', sourceTokens);
    const multAref = createAref('*');
    return splice(tokens, startPos, endPos, [twoAref, multAref, variable]);
  } else {
    // x^2 + x^2 = 2*x^2
    const twoAref = createAref('2', sourceTokens);
    const multAref = createAref('*');
    const caretAref = createAref('^');
    const powerAref = createAref(String(power));
    return splice(tokens, startPos, endPos, [twoAref, multAref, variable, caretAref, powerAref]);
  }
}

export function actionReorder(actionInfo: ReorderActionInfo): ARef[] {
  const { originalTokens: tokens, position, leftToken, rightToken, reorderPattern } = actionInfo;

  let combinedText: string;
  if (reorderPattern === 'number_first') {
    combinedText = getRefText(rightToken) + '+' + getRefText(leftToken);
  } else {
    combinedText = getRefText(leftToken) + '+' + getRefText(rightToken);
  }

  const newAref = createAref(combinedText, [leftToken, rightToken]);
  return splice(tokens, position - 1, position + 2, [newAref]);
}

export function actionMultiplyCoeffVar(actionInfo: MultiplyCoeffVarActionInfo): ARef[] {
  const { originalTokens: tokens, position, leftToken, rightToken, pattern } = actionInfo;

  let combinedText: string;
  if (pattern === 'number_variable') {
    combinedText = parseInt(getRefText(leftToken), 10) + getRefText(rightToken);
  } else {
    combinedText = parseInt(getRefText(rightToken), 10) + getRefText(leftToken);
  }

  const newAref = createAref(combinedText, [leftToken, rightToken]);
  return splice(tokens, position - 1, position + 2, [newAref]);
}

export function actionMultiplySameVar(actionInfo: MultiplySameVarActionInfo): ARef[] {
  const { originalTokens: tokens, position, variable, totalPower, rightEnd } = actionInfo;

  if (totalPower === 1) {
    return splice(tokens, position - 1, rightEnd, [variable]);
  } else {
    const caretAref = createAref('^');
    const powerAref = createAref(String(totalPower), [tokens[position - 1], tokens[position + 1]]);
    return splice(tokens, position - 1, rightEnd, [variable, caretAref, powerAref]);
  }
}

export function actionMultiplyNumbers(actionInfo: MultiplyNumbersActionInfo): ARef[] {
  const { originalTokens: tokens, position, leftToken, rightToken } = actionInfo;

  const leftValue = leftToken.value ?? parseInt(getRefText(leftToken), 10);
  const rightValue = rightToken.value ?? parseInt(getRefText(rightToken), 10);
  const resultValue = leftValue * rightValue;

  const resultAref = createAref(String(resultValue), [leftToken, rightToken], resultValue);
  return splice(tokens, position - 1, position + 2, [resultAref]);
}

export function actionSubtractLikeTerms(actionInfo: SubtractLikeTermsActionInfo): ARef[] {
  const { originalTokens: tokens, startPos, endPos, sourceTokens } = actionInfo;

  const zeroAref = createAref('0', sourceTokens, 0);
  return splice(tokens, startPos, endPos, [zeroAref]);
}

// ============================================================================
// Direct apply functions (return modified tokens or null)
// ============================================================================

export function applyDiv(tokens: ReadonlyArray<ARef>): ARef[] | null {
  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokenEquals(tokens[i], '/')) {
      const left = tokens[i - 1];
      const right = tokens[i + 1];

      // number / number
      if (isNumber(left) && isNumber(right)) {
        const rightVal = parseInt(getRefText(right), 10);
        const leftVal = parseInt(getRefText(left), 10);
        if (rightVal !== 0 && leftVal % rightVal === 0) {
          const resultValue = Math.floor(leftVal / rightVal);
          const resultAref = createAref(String(resultValue), [left, right]);
          return splice(tokens, i - 1, i + 2, [resultAref]);
        }
      }

      // Check for variable / variable patterns (including powers)
      const leftResult = getVariablePower(tokens, i - 1);
      const rightResult = getVariablePower(tokens, i + 1);

      if (
        leftResult.variable &&
        rightResult.variable &&
        getRefText(leftResult.variable) === getRefText(rightResult.variable)
      ) {
        const powerDiff = (leftResult.power ?? 1) - (rightResult.power ?? 1);

        if (powerDiff === 0) {
          const sourceArefs = tokens.slice(i - 1, rightResult.endIndex);
          const oneAref = createAref('1', sourceArefs);
          return splice(tokens, i - 1, rightResult.endIndex, [oneAref]);
        } else if (powerDiff === 1) {
          return splice(tokens, i - 1, rightResult.endIndex, [leftResult.variable]);
        } else {
          const sourceArefs = tokens.slice(i - 1, rightResult.endIndex);
          const powerAref = createAref(String(powerDiff), sourceArefs);
          const caretAref = createAref('^');
          return splice(tokens, i - 1, rightResult.endIndex, [
            leftResult.variable,
            caretAref,
            powerAref
          ]);
        }
      }
    }
  }
  return null;
}

export function applyCancel(tokens: ARef[]): ARef[] | null {
  function isPartOfMultiplication(tokens: ARef[], index: number): boolean {
    if (index > 0 && tokenEquals(tokens[index - 1], '*')) return true;
    if (index + 1 < tokens.length && tokenEquals(tokens[index + 1], '*')) return true;
    return false;
  }

  // Look for addition and subtraction of the same term to cancel out
  for (let i = 0; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '+') && i + 1 < tokens.length) {
      const addTerm = tokens[i + 1];
      if (isPartOfMultiplication(tokens, i + 1)) continue;

      for (let j = i + 2; j < tokens.length; j++) {
        if (
          tokenEquals(tokens[j], '-') &&
          j + 1 < tokens.length &&
          getRefText(tokens[j + 1]) === getRefText(addTerm) &&
          !isPartOfMultiplication(tokens, j + 1)
        ) {
          let newTokens = splice(tokens, j, j + 2, []);
          newTokens = splice(newTokens, i, i + 2, []);
          return newTokens;
        }
      }
    }
  }

  // Also look for subtraction followed by addition of the same term
  for (let i = 0; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '-') && i + 1 < tokens.length) {
      const subTerm = tokens[i + 1];
      if (isPartOfMultiplication(tokens, i + 1)) continue;

      for (let j = i + 2; j < tokens.length; j++) {
        if (
          tokenEquals(tokens[j], '+') &&
          j + 1 < tokens.length &&
          getRefText(tokens[j + 1]) === getRefText(subTerm) &&
          !isPartOfMultiplication(tokens, j + 1)
        ) {
          let newTokens = splice(tokens, j, j + 2, []);
          newTokens = splice(newTokens, i, i + 2, []);
          return newTokens;
        }
      }
    }
  }

  // Handle case where first term is implicitly positive
  if (
    tokens.length >= 3 &&
    !tokenEquals(tokens[0], '+') &&
    !tokenEquals(tokens[0], '-')
  ) {
    const firstTerm = tokens[0];
    if (!isPartOfMultiplication(tokens, 0)) {
      for (let i = 1; i < tokens.length; i++) {
        if (
          i + 1 < tokens.length &&
          tokenEquals(tokens[i], '-') &&
          getRefText(tokens[i + 1]) === getRefText(firstTerm) &&
          !isPartOfMultiplication(tokens, i + 1)
        ) {
          return splice(splice(tokens, i, i + 2, []), 0, 1, []);
        }
      }
    }
  }

  return null;
}

export function applySubToAdd(tokens: ARef[]): ARef[] | null {
  for (let i = 1; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '-') && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      if (isNumber(nextToken)) {
        const plusAref = createAref('+');
        const negativeAref = createAref('-' + getRefText(nextToken), [nextToken]);
        return splice(tokens, i, i + 2, [plusAref, negativeAref]);
      }
    }
  }
  return null;
}

export function applyCleanup(tokens: ARef[]): ARef[] | null {
  if (tokens.length === 0) return null;

  // Remove leading + operator
  if (tokenEquals(tokens[0], '+')) {
    return splice(tokens, 0, 1, []);
  }

  // Remove leading - operator and negate the first term if it's a number
  if (tokenEquals(tokens[0], '-') && tokens.length > 1) {
    if (isNumber(tokens[1])) {
      const negativeAref = createAref('-' + getRefText(tokens[1]), [tokens[1]]);
      return splice(tokens, 0, 2, [negativeAref]);
    } else {
      return tokens;
    }
  }

  return null;
}

export function applyParenthesis(tokens: ARef[]): ARef[] | null {
  for (let i = 0; i < tokens.length; i++) {
    if (tokenEquals(tokens[i], '(')) {
      for (let j = i + 2; j < tokens.length; j++) {
        if (tokenEquals(tokens[j], ')')) {
          const subexpr = tokens.slice(i + 1, j);
          if (subexpr.length === 1) {
            return splice(tokens, i, j + 1, subexpr);
          }
        }
      }
    }
  }
  return null;
}

// ============================================================================
// Action executor
// ============================================================================

export function executeAction(action: Action): ARef[] {
  const { actionType, actionInfo } = action;

  switch (actionType) {
    case 'action_wrap_mult':
      return actionWrapMult(actionInfo as WrapMultActionInfo);
    case 'action_compute_sum':
      return actionComputeSum(actionInfo as ComputeSumActionInfo);
    case 'action_compute_sub':
      return actionComputeSub(actionInfo as ComputeSubActionInfo);
    case 'action_combine_terms':
      return actionCombineTerms(actionInfo as CombineTermsActionInfo);
    case 'action_reorder':
      return actionReorder(actionInfo as ReorderActionInfo);
    case 'action_multiply_coeff_var':
      return actionMultiplyCoeffVar(actionInfo as MultiplyCoeffVarActionInfo);
    case 'action_multiply_same_var':
      return actionMultiplySameVar(actionInfo as MultiplySameVarActionInfo);
    case 'action_multiply_numbers':
      return actionMultiplyNumbers(actionInfo as MultiplyNumbersActionInfo);
    case 'action_subtract_like_terms':
      return actionSubtractLikeTerms(actionInfo as SubtractLikeTermsActionInfo);
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

// Legacy function for backwards compatibility
export function applyMulLegacy(tokens: ARef[]): ARef[] | null {
  const actions = applyMul(tokens);
  if (actions.length > 0) {
    actions.sort((a, b) => a.cost - b.cost);
    return executeAction(actions[0]);
  }
  return null;
}
