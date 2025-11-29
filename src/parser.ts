import { AToken, ARef, RefType, TokenRole, inferRefType, createDelayedRef, DelayedOp, getRefText } from './token.js';

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

function createRefFromText(
  text: string,
  refType: RefType,
  options?: {
    value?: number;
    role?: TokenRole;
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
    if (i + 1 < rawTokens.length && isNumberToken(token) && isVariableToken(rawTokens[i + 1])) {
      const value = parseInt(text, 10);
      refs.push(createRef(token, 'number', { value }));
      refs.push(createRefFromText('*', 'op'));
      refs.push(createRef(rawTokens[i + 1], 'symbol'));
      i += 2;
      continue;
    }

    // Insert implicit * between ) and ( or ) and number/variable
    if (text === ')' && i + 1 < rawTokens.length) {
      const nextText = rawTokens[i + 1].text;
      refs.push(createRef(token, 'op'));
      if (nextText === '(' || isNumberToken(rawTokens[i + 1]) || isVariableToken(rawTokens[i + 1])) {
        refs.push(createRefFromText('*', 'op'));
      }
      i++;
      continue;
    }

    // Insert implicit * between number/variable and (
    if ((isNumberToken(token) || isVariableToken(token)) && i + 1 < rawTokens.length && rawTokens[i + 1].text === '(') {
      if (isNumberToken(token)) {
        refs.push(createRef(token, 'number', { value: parseInt(text, 10) }));
      } else {
        refs.push(createRef(token, 'symbol'));
      }
      refs.push(createRefFromText('*', 'op'));
      i++;
      continue;
    }

    // Regular token
    if (isNumberToken(token)) {
      refs.push(createRef(token, 'number', { value: parseInt(text, 10) }));
    } else if (isVariableToken(token)) {
      refs.push(createRef(token, 'symbol'));
    } else {
      refs.push(createRef(token, inferRefType(text)));
    }
    i++;
  }

  return buildTermTree(refs);
}

/**
 * Build a term tree from refs.
 * Top level contains addition/subtraction operations (terms).
 * Multiplication, division, power, and parentheses create nested tree nodes.
 */
function buildTermTree(refs: ARef[]): ARef[] {
  // First pass: handle parentheses
  const withoutParens = collapseParentheses(refs);

  // Second pass: handle power (highest precedence after parens)
  const withoutPower = collapsePower(withoutParens);

  // Third pass: handle multiplication/division
  const withoutMulDiv = collapseMulDiv(withoutPower);

  // Fourth pass: assign roles and signs for addition/subtraction
  return assignTermRoles(withoutMulDiv);
}

/**
 * Collapse parentheses into tree nodes
 */
function collapseParentheses(refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];

    if (ref.token.text === '(') {
      // Find matching closing paren
      let depth = 1;
      let j = i + 1;

      while (j < refs.length && depth > 0) {
        if (refs[j].token.text === '(') depth++;
        else if (refs[j].token.text === ')') depth--;
        j++;
      }

      // Extract content between parens (exclusive)
      const innerRefs = refs.slice(i + 1, j - 1);

      // Recursively process inner content
      const processedInner = buildTermTree(innerRefs);

      // Create a node for the parenthesized expression
      const parenNode = createRefFromText(`(...)`, 'expr');
      parenNode.arefs = processedInner;
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
function collapsePower(refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];
    const nextRef = refs[i + 1];
    const expRef = refs[i + 2];

    // Check for power pattern: <base> ^ <exponent>
    if (nextRef && nextRef.token.text === '^' && expRef) {
      const varName = getRefText(ref);
      const power = expRef.refType === 'number' ? (expRef.value as number) : 2;

      // Create delayed pow op - include operator in arefs
      const delayedOp: DelayedOp = { kind: 'pow', base: ref, exponent: expRef };
      const powerNode = createDelayedRef(`${varName}^${power}`, [ref, nextRef, expRef], delayedOp);

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
function collapseMulDiv(refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];

    // Skip if this is an add/sub operator - those stay at top level
    if (ref.token.text === '+' || ref.token.text === '-') {
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
      if (opRef.token.text === '+' || opRef.token.text === '-') {
        break;
      }

      // Check for mul/div operator
      if (isMulDivOp(opRef.token.text)) {
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
      // Create expression node containing the factors
      const exprNode = createRefFromText('(...)', 'expr');

      // Interleave factors and operators
      const children: ARef[] = [];
      for (let k = 0; k < factors.length; k++) {
        children.push(factors[k]);
        if (k < ops.length) {
          children.push(ops[k]);
        }
      }

      exprNode.arefs = children;
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
 */
function assignTermRoles(refs: ARef[]): ARef[] {
  const result: ARef[] = [];
  let currentSign: '+' | '-' = '+';
  let i = 0;

  while (i < refs.length) {
    const ref = refs[i];
    const text = ref.token.text;

    // Handle add/sub operators
    if (isAddSubOp(text)) {
      // Check if this is a unary sign (at start or after operator)
      if (result.length === 0 || result[result.length - 1].refType === 'op') {
        currentSign = text as '+' | '-';
        i++;
        continue;
      } else {
        // Binary operator - keep it
        const opRef = createRefFromText(text, 'op', { role: 'operator' });
        result.push(opRef);
        currentSign = text as '+' | '-';
        i++;
        continue;
      }
    }

    // For all other refs (terms), apply the current sign
    let termRef = ref;

    // Apply sign to create term
    if (currentSign === '-' && ref.refType !== 'op') {
      // Negate the term
      if (ref.refType === 'number') {
        const origValue = ref.value as number;
        const negValue = -origValue;
        termRef = createRefFromText(String(negValue), 'number', {
          value: negValue,
          role: 'term'
        });
        // Store original ref in arefs
        termRef.arefs = [ref];
      } else {
        // Create negate delayed op with -1 * ref
        const refText = getRefText(ref);
        const minusOne = createRefFromText('-1', 'number', { value: -1 });
        const mulOp = createRefFromText('*', 'op');
        const delayedOp: DelayedOp = {
          kind: 'mul',
          left: minusOne,
          right: ref
        };
        termRef = createDelayedRef(`(-${refText})`, [minusOne, mulOp, ref], delayedOp);
        termRef.role = 'term';
      }
      currentSign = '+';
    } else {
      // Positive term
      termRef.role = 'term';
    }

    result.push(termRef);
    i++;
  }

  return result;
}