import { AToken, ARef } from './math';

type TokenLike = string | AToken | ARef;

let nextTokenId = 1;

function createToken(text: string): AToken {
  return { id: nextTokenId++, text };
}

function createRef(token: AToken, value?: number): ARef {
  return { token, arefs: [], value: value ?? null };
}

function createRefFromText(text: string, value?: number): ARef {
  return createRef(createToken(text), value);
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
        createRef(tokens[i], numberValue),
        createRefFromText('*'),
        createRef(tokens[i + 1])
      );
      i += 2;
    } else {
      // Set value for number tokens
      const value = isNumber(tokens[i]) ? parseInt(tokens[i].text, 10) : undefined;
      processed.push(createRef(tokens[i], value));
      i++;
    }
  }

  return processed;
}
