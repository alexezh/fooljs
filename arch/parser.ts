import type { ASymbolCache } from './asymbol.js';
import { AToken, ARef, RefType, TokenRole, createSymbolRef, createOpRef, createNumberRef, toSymbol, makeComputeFunction } from './token.js';

type TokenLike = string | AToken | ARef;

let nextTokenId = 1;

function createToken(text: string): AToken {
  return { id: nextTokenId++, text };
}

function createRef(
  token: AToken,
  refType: RefType,
  options?: {
    value?: number;
    role?: TokenRole;
  }
): ARef {
  return new ARef({
    token,
    arefs: [],
    refType,
    value: options?.value ?? null,
    role: options?.role
  });
}

// function createRefFromText(
//   text: string,
//   refType: RefType,
//   options?: {
//     value?: number;
//     role?: TokenRole;
//   }
// ): ARef {
//   return createRef(createToken(text), refType, options);
// }

function getTokenText(token: TokenLike): string {
  if (typeof token === 'string') {
    return token;
  }
  if ('text' in token) {
    return token.text;
  }
  return token.token!.text;
}

function isNumberToken(token: TokenLike): boolean {
  const text = getTokenText(token);
  return /^\d+$/.test(text);
}

function isVariableToken(token: TokenLike): boolean {
  const text = getTokenText(token);
  return text.length === 1 && /^[a-zA-Z]$/.test(text);
}

function isAddSubOp(text: string): boolean {
  return text === '+' || text === '-';
}

function isMulDivOp(text: string): boolean {
  return text === '*' || text === '/';
}

/**
 * Parse an expression string into ARef tokens with role, sign, and power information.
 *
 * Pass 1: Tokenize into raw tokens
 * Pass 2: Convert to ARef with implicit multiplication (2x -> 2 * x)
 * Pass 3: Assign roles (term, factor, exponent, operator) and signs
 */
export function parseExpression(cache: ASymbolCache, expr: string): ARef[] {
  expr = expr.replace(/\s/g, ''); // Remove whitespace

  // ============================================================================
  // Pass 1: Tokenize
  // ============================================================================
  const rawTokens: AToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (/\d/.test(char)) {
      let numStr = '';
      while (i < expr.length && /\d/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      rawTokens.push(createToken(numStr));
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      rawTokens.push(createToken(char));
      i++;
      continue;
    }

    if ('+-*/^()'.includes(char)) {
      rawTokens.push(createToken(char));
      i++;
      continue;
    }

    i++; // Skip unknown
  }

  // ============================================================================
  // Pass 2: Convert to ARef with implicit multiplication
  // ============================================================================
  const refs: ARef[] = [];
  i = 0;

  while (i < rawTokens.length) {
    const token = rawTokens[i];
    const text = token.text;

    // Insert implicit * between number and variable (2x -> 2 * x)
    if (i + 1 < rawTokens.length && isNumberToken(token) && isVariableToken(rawTokens[i + 1])) {
      const value = parseInt(text, 10);
      refs.push(createNumberRef(value, token));
      refs.push(createOpRef('*'));
      const varToken = rawTokens[i + 1];
      refs.push(new ARef({
        token: varToken,
        arefs: [],
        refType: 'symbol',
        value: varToken.text,
        symbol: toSymbol(varToken.text)
      }));
      i += 2;
      continue;
    }

    // Insert implicit * between ) and ( or ) and number/variable
    if (text === ')' && i + 1 < rawTokens.length) {
      const nextText = rawTokens[i + 1].text;
      refs.push(createOpRef(')', token));
      if (nextText === '(' || isNumberToken(rawTokens[i + 1]) || isVariableToken(rawTokens[i + 1])) {
        refs.push(createOpRef('*'));
      }
      i++;
      continue;
    }

    // Insert implicit * between number/variable and (
    if ((isNumberToken(token) || isVariableToken(token)) && i + 1 < rawTokens.length && rawTokens[i + 1].text === '(') {
      if (isNumberToken(token)) {
        refs.push(createNumberRef(parseInt(text, 10), token));
      } else {
        refs.push(new ARef({
          token,
          arefs: [],
          refType: 'symbol',
          value: text,
          symbol: toSymbol(text)
        }));
      }
      refs.push(createOpRef('*'));
      i++;
      continue;
    }

    // Regular token
    if (isNumberToken(token)) {
      refs.push(createNumberRef(parseInt(text, 10), token));
    } else if (isVariableToken(token)) {
      refs.push(new ARef({
        token,
        arefs: [],
        refType: 'symbol',
        value: text,
        symbol: toSymbol(text)
      }));
    } else {
      // Operator
      refs.push(createOpRef(text, token));
    }
    i++;
  }

  return buildTermTree(cache, refs);
}

/**
 * Build a term tree from refs.
 * Top level contains addition/subtraction operations (terms).
 * Multiplication, division, power, and parentheses create nested tree nodes.
 */
function buildTermTree(cache: ASymbolCache, refs: ARef[]): ARef[] {
  // First pass: handle parentheses
  const withoutParens = collapseParentheses(cache, refs);

  // Second pass: handle power (highest precedence after parens)
  const withoutPower = collapsePower(cache, withoutParens);

  // Third pass: handle multiplication/division
  const withoutMulDiv = collapseMulDiv(cache, withoutPower);

  // Fourth pass: assign roles and signs for addition/subtraction
  return assignTermRoles(cache, withoutMulDiv);
}

/**
 * Collapse parentheses into tree nodes
 */
function collapseParentheses(cache: ASymbolCache, refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];

    if (ref.symbol === '(') {
      // Find matching closing paren
      let depth = 1;
      let j = i + 1;

      while (j < refs.length && depth > 0) {
        if (refs[j].symbol === '(') depth++;
        else if (refs[j].symbol === ')') depth--;
        j++;
      }

      // Extract content between parens (exclusive)
      const innerRefs = refs.slice(i + 1, j - 1);

      // Recursively process inner content
      const processedInner = buildTermTree(cache, innerRefs);

      // Create a node for the parenthesized expression with compute function
      const computeValue = (): number | null => {
        // Sum all term values (ignoring operators)
        let sum = 0;
        let hasValue = false;
        for (const ref of processedInner) {
          if (!ref.isOp && typeof ref.value === 'number') {
            sum += ref.value;
            hasValue = true;
          }
        }
        return hasValue ? sum : null;
      };
      const parenNode = createSymbolRef(cache, processedInner, undefined, makeComputeFunction(computeValue));
      result.push(parenNode);

      i = j;
    } else {
      result.push(ref);
      i++;
    }
  }

  return result;
}

/**
 * Collapse power operations into tree nodes
 */
function collapsePower(cache: ASymbolCache, refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];
    const nextRef = refs[i + 1];
    const expRef = refs[i + 2];

    // Check for power pattern: <base> ^ <exponent>
    if (nextRef && nextRef.symbol === '^' && expRef) {
      // Create compute function for power operation
      const computeValue = (): number | null => {
        const baseVal = ref.value;
        const expVal = expRef.value;
        if (typeof baseVal === 'number' && typeof expVal === 'number') {
          return Math.pow(baseVal, expVal);
        }
        return null;
      };
      const powerNode = createSymbolRef(cache, [ref, nextRef, expRef], undefined, makeComputeFunction(computeValue));

      result.push(powerNode);
      i += 3;
    } else {
      result.push(ref);
      i++;
    }
  }

  return result;
}

/**
 * Collapse multiplication/division into tree nodes
 */
function collapseMulDiv(cache: ASymbolCache, refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];

    // Skip if this is an add/sub operator - those stay at top level
    if (ref.symbol === '+' || ref.symbol === '-') {
      result.push(ref);
      i++;
      continue;
    }

    // Collect a sequence of multiplication/division operations
    const factors: ARef[] = [ref];
    const ops: ARef[] = [];
    let j = i + 1;

    while (j < refs.length) {
      const opRef = refs[j];

      // Stop at add/sub operators
      if (opRef.symbol === '+' || opRef.symbol === '-') {
        break;
      }

      // Check for mul/div operator
      if (opRef.symbol && isMulDivOp(opRef.symbol)) {
        const nextFactor = refs[j + 1];
        if (nextFactor) {
          ops.push(opRef);
          factors.push(nextFactor);
          j += 2;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // If we collected mul/div operations, create a tree node
    if (factors.length > 1) {

      // Interleave factors and operators
      const children: ARef[] = [];
      for (let k = 0; k < factors.length; k++) {
        children.push(factors[k]);
        if (k < ops.length) {
          children.push(ops[k]);
        }
      }

      // Create compute function for mul/div chain
      const computeValue = (): number | null => {
        // Start with first factor
        const firstVal = factors[0].value;
        if (typeof firstVal !== 'number') {
          return null;
        }

        let result = firstVal;

        // Apply each operation
        for (let k = 0; k < ops.length; k++) {
          const op = ops[k].symbol;
          const factorVal = factors[k + 1].value;

          if (typeof factorVal !== 'number') {
            return null;
          }

          if (op === '*') {
            result *= factorVal;
          } else if (op === '/') {
            if (factorVal === 0) {
              return null;
            }
            result /= factorVal;
          }
        }

        return result;
      };

      const exprNode = createSymbolRef(cache, children, undefined, makeComputeFunction(computeValue));

      result.push(exprNode);
      i = j;
    } else {
      result.push(ref);
      i++;
    }
  }

  return result;
}

/**
 * Assign term roles and signs to top-level addition/subtraction
 * Always uses + as operator, and creates negate compute operations for subtraction
 */
function assignTermRoles(cache: ASymbolCache, refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let currentSign: '+' | '-' = '+';
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];
    const symbol = ref.symbol;

    // Handle add/sub operators
    if (symbol && isAddSubOp(symbol)) {
      // Check if this is a unary sign (at start or after operator)
      if (result.length === 0 || result[result.length - 1].refType === 'op') {
        currentSign = symbol as '+' | '-';
        i++;
        continue;
      } else {
        // Binary operator - always use + and track the sign
        result.push(createOpRef('+'));
        currentSign = symbol as '+' | '-';
        i++;
        continue;
      }
    }

    // For all other refs (terms), apply the current sign
    let termRef = ref;

    // Apply sign to create term with negate compute if needed
    if (currentSign === '-' && ref.refType !== 'op') {
      // Create negate compute operation for both numbers and variables
      const minusOne = createNumberRef(-1);
      const mulOp = createOpRef('*');
      const computeValue = (): number | null => {
        const leftVal = minusOne.value;
        const rightVal = ref.value;
        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
          return leftVal * rightVal;
        }
        return null;
      };
      termRef = createSymbolRef(cache, [minusOne, mulOp, ref], undefined, makeComputeFunction(computeValue));
      currentSign = '+';
    }

    result.push(termRef);
    i++;
  }

  return result;
}