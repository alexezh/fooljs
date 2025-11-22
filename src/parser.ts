import { AToken, ARef, RefType, inferRefType } from './token.js';

type TokenLike = string | AToken | ARef;

let nextTokenId = 1;

function createToken(text: string): AToken {
  return { id: nextTokenId++, text };
}

function createRef(token: AToken, refType: RefType, value?: number): ARef {
  return { token, arefs: [], refType, value: value ?? null };
}

function createRefFromText(text: string, refType: RefType, value?: number): ARef {
  return createRef(createToken(text), refType, value);
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

function isNumber(token: TokenLike): boolean {
  const text = getTokenText(token);
  if (/^\d+$/.test(text)) {
    return true;
  }
  if (text.startsWith('-') && /^\d+$/.test(text.slice(1))) {
    return true;
  }
  return false;
}

function isVariable(token: TokenLike): boolean {
  const text = getTokenText(token);
  return text.length === 1 && /^[a-zA-Z]$/.test(text);
}

export function parseExpression(expr: string): ARef[] {
  const tokens: AToken[] = [];
  let i = 0;
  expr = expr.replace(/\s/g, ''); // Remove whitespace

  while (i < expr.length) {
    const char = expr[i];

    // Handle numbers (including multi-digit)
    if (/\d/.test(char)) {
      let numStr = '';
      while (i < expr.length && /\d/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push(createToken(numStr));
      continue;
    }

    // Handle variables (single letters)
    if (/[a-zA-Z]/.test(char)) {
      tokens.push(createToken(char));
      i++;
      continue;
    }

    // Handle operators and parentheses
    if ('+-*/^()'.includes(char)) {
      tokens.push(createToken(char));
      i++;
      continue;
    }

    // Skip unknown characters
    i++;
  }

  // Post-process to handle coefficient-variable combinations like "2x"
  const processed: ARef[] = [];
  i = 0;

  while (i < tokens.length) {
    if (
      i + 1 < tokens.length &&
      isNumber(tokens[i]) &&
      isVariable(tokens[i + 1])
    ) {
      // This is a coefficient-variable pair like "2x"
      const numberValue = parseInt(tokens[i].text, 10);
      processed.push(
        createRef(tokens[i], 'digit', numberValue),
        createRefFromText('*', 'op'),
        createRef(tokens[i + 1], 'variable')
      );
      i += 2;
    } else {
      // Set value for number tokens
      if (isNumber(tokens[i])) {
        const value = parseInt(tokens[i].text, 10);
        processed.push(createRef(tokens[i], 'digit', value));
      } else {
        processed.push(createRef(tokens[i], inferRefType(tokens[i].text)));
      }
      i++;
    }
  }

  return processed;
}
