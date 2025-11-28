import { AToken, ARef, RefType, TokenRole, inferRefType, createDelayedRef, DelayedOp } from './token.js';

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
    sign?: '+' | '-';
    power?: number;
    variableName?: string;
  }
): ARef {
  return {
    token,
    arefs: [],
    refType,
    value: options?.value ?? null,
    role: options?.role,
    sign: options?.sign,
    power: options?.power,
    variableName: options?.variableName
  };
}

function createRefFromText(
  text: string,
  refType: RefType,
  options?: {
    value?: number;
    role?: TokenRole;
    sign?: '+' | '-';
    power?: number;
    variableName?: string;
  }
): ARef {
  return createRef(createToken(text), refType, options);
}

function getTokenText(token: TokenLike): string {
  if (typeof token === 'string') {
    return token;
  }
  if ('text' in token) {
    return token.text;
  }
  return token.token.text;
}

function isDigitToken(token: TokenLike): boolean {
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
export function parseExpression(expr: string): ARef[] {
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
    if (i + 1 < rawTokens.length && isDigitToken(token) && isVariableToken(rawTokens[i + 1])) {
      const value = parseInt(text, 10);
      refs.push(createRef(token, 'digit', { value }));
      refs.push(createRefFromText('*', 'op'));
      refs.push(createRef(rawTokens[i + 1], 'variable', { variableName: rawTokens[i + 1].text }));
      i += 2;
      continue;
    }

    // Insert implicit * between ) and ( or ) and number/variable
    if (text === ')' && i + 1 < rawTokens.length) {
      const nextText = rawTokens[i + 1].text;
      refs.push(createRef(token, 'op'));
      if (nextText === '(' || isDigitToken(rawTokens[i + 1]) || isVariableToken(rawTokens[i + 1])) {
        refs.push(createRefFromText('*', 'op'));
      }
      i++;
      continue;
    }

    // Insert implicit * between number/variable and (
    if ((isDigitToken(token) || isVariableToken(token)) && i + 1 < rawTokens.length && rawTokens[i + 1].text === '(') {
      if (isDigitToken(token)) {
        refs.push(createRef(token, 'digit', { value: parseInt(text, 10) }));
      } else {
        refs.push(createRef(token, 'variable', { variableName: text }));
      }
      refs.push(createRefFromText('*', 'op'));
      i++;
      continue;
    }

    // Regular token
    if (isDigitToken(token)) {
      refs.push(createRef(token, 'digit', { value: parseInt(text, 10) }));
    } else if (isVariableToken(token)) {
      refs.push(createRef(token, 'variable', { variableName: text }));
    } else {
      refs.push(createRef(token, inferRefType(text)));
    }
    i++;
  }

  assignDepth(refs);

  return assignRoles(refs);
}

/**
 * Assign depth to each ref based on parentheses nesting.
 * Depth starts at 0, +1 for each '(' opened, -1 for each ')' closed.
 */
function assignDepth(refs: ARef[]): void {
  let depth = 0;

  for (const ref of refs) {
    const text = ref.token.text;

    if (text === '(') {
      ref.depth = depth;
      depth++;
    } else if (text === ')') {
      depth--;
      ref.depth = depth;
    } else {
      ref.depth = depth;
    }
  }
}

/**
 * Pass 3: Assign roles and create delayed ops for signs and powers.
 * Returns a new array of refs where:
 * - Unary signs are removed and converted to delayed negate ops on the following term
 * - Power expressions (x^2) are collapsed into a single delayed pow ref
 */
function assignRoles(refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let currentSign: '+' | '-' = '+';
  let prevWasMulDiv = false;
  let prevWasAddSub = true; // Start as true to handle leading sign
  let prevWasOpenParen = false;
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];
    const text = ref.token.text;
    const nextRef = refs[i + 1];

    if (ref.refType === 'op') {
      if (isAddSubOp(text)) {
        // Check if unary (sign) or binary (operator)
        const isUnary = result.length === 0 || prevWasAddSub || prevWasOpenParen;

        if (isUnary) {
          // This is a sign - capture for next term, don't emit
          currentSign = text as '+' | '-';
          prevWasAddSub = true;
          i++;
          continue;
        } else {
          // Binary operator - emit it
          const opRef = createRefFromText(text, 'op', { role: 'operator' });
          result.push(opRef);
          currentSign = text as '+' | '-';
          prevWasAddSub = true;
          prevWasMulDiv = false;
        }
      }
      else if (isMulDivOp(text)) {
        const opRef = createRefFromText(text, 'op', { role: 'operator' });
        result.push(opRef);
        prevWasMulDiv = true;
        prevWasAddSub = false;
      }
      else if (text === '^') {
        // Power operator - will be handled when we see the variable
        // Skip it here, it's consumed with the variable
        const opRef = createRefFromText(text, 'op', { role: 'operator' });
        result.push(opRef);
        prevWasMulDiv = false;
        prevWasAddSub = false;
      }
      else if (text === '(') {
        const opRef = createRefFromText(text, 'op', { role: 'operator' });
        result.push(opRef);
        prevWasOpenParen = true;
        prevWasAddSub = true;
        prevWasMulDiv = false;
      }
      else if (text === ')') {
        const opRef = createRefFromText(text, 'op', { role: 'operator' });
        result.push(opRef);
        prevWasOpenParen = false;
        prevWasAddSub = false;
        prevWasMulDiv = false;
      }
      i++;
      continue;
    }

    // Handle digit
    if (ref.refType === 'digit') {
      let newRef: ARef;

      // Check if this is an exponent (preceded by ^)
      const prevResult = result[result.length - 1];
      if (prevResult && prevResult.token.text === '^') {
        // This is an exponent - mark it
        newRef = createRefFromText(text, 'digit', {
          value: ref.value as number,
          role: 'exponent'
        });
      } else if (prevWasMulDiv) {
        // Factor in multiplication
        newRef = createRefFromText(text, 'digit', {
          value: ref.value as number,
          role: 'factor'
        });
      } else {
        // Term - apply sign if negative
        if (currentSign === '-') {
          // Create delayed negate op
          const delayedOp: DelayedOp = { kind: 'mul', left: createRefFromText('-1', 'digit', { value: -1 }), right: ref };
          newRef = createDelayedRef(`(-${text})`, [ref], delayedOp);
          newRef.role = 'term';
          newRef.sign = '-';
        } else {
          newRef = createRefFromText(text, 'digit', {
            value: ref.value as number,
            role: 'term',
            sign: '+'
          });
        }
        currentSign = '+';
      }

      result.push(newRef);
      prevWasAddSub = false;
      prevWasMulDiv = false;
      prevWasOpenParen = false;
      i++;
      continue;
    }

    // Handle variable
    if (ref.refType === 'variable') {
      const varName = ref.variableName ?? text;

      // Check if followed by ^ for power
      let power = 1;
      let skipCount = 1; // How many tokens to skip

      if (nextRef && nextRef.token.text === '^') {
        const expRef = refs[i + 2];
        if (expRef && expRef.refType === 'digit') {
          power = expRef.value as number;
          skipCount = 3; // Skip variable, ^, and exponent
        }
      }

      let newRef: ARef;
      const prevResult = result[result.length - 1];

      // Determine role
      const isFactor = prevWasMulDiv || (prevResult && prevResult.refType === 'digit' && prevResult.role === 'factor');

      if (power > 1) {
        // Create delayed pow op: x^2 -> pow(x, 2)
        const baseRef = createRefFromText(varName, 'variable', { variableName: varName, power: 1 });
        const expRef = createRefFromText(String(power), 'digit', { value: power });
        const delayedOp: DelayedOp = { kind: 'pow', base: baseRef, exponent: expRef };

        const resultText = `${varName}^${power}`;
        newRef = createDelayedRef(resultText, [baseRef, expRef], delayedOp);
        newRef.variableName = varName;
        newRef.power = power;
        newRef.role = isFactor ? 'factor' : 'term';

        if (!isFactor) {
          if (currentSign === '-') {
            // Wrap in negate
            const negDelayedOp: DelayedOp = { kind: 'mul', left: createRefFromText('-1', 'digit', { value: -1 }), right: newRef };
            const negRef = createDelayedRef(`(-${resultText})`, [newRef], negDelayedOp);
            negRef.role = 'term';
            negRef.sign = '-';
            negRef.variableName = varName;
            negRef.power = power;
            newRef = negRef;
          } else {
            newRef.sign = '+';
          }
          currentSign = '+';
        }

        // Remove the ^ operator we already added
        if (result.length > 0 && result[result.length - 1].token.text === '^') {
          result.pop();
        }
      } else {
        // Simple variable
        newRef = createRefFromText(varName, 'variable', {
          variableName: varName,
          power: 1,
          role: isFactor ? 'factor' : 'term'
        });

        if (!isFactor) {
          if (currentSign === '-') {
            // Create delayed negate
            const delayedOp: DelayedOp = { kind: 'mul', left: createRefFromText('-1', 'digit', { value: -1 }), right: newRef };
            const negRef = createDelayedRef(`(-${varName})`, [newRef], delayedOp);
            negRef.role = 'term';
            negRef.sign = '-';
            negRef.variableName = varName;
            newRef = negRef;
          } else {
            newRef.sign = '+';
          }
          currentSign = '+';
        }
      }

      result.push(newRef);
      prevWasAddSub = false;
      prevWasMulDiv = false;
      prevWasOpenParen = false;
      i += skipCount;
      continue;
    }

    // Fallback - just copy the ref
    result.push(ref);
    i++;
  }

  return result;
}