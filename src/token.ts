/**
 * computed value
 */
export interface ARef {
  token: AToken;
  arefs: ReadonlyArray<ARef>;
  value: any;
}

export interface AToken {
  id: number;
  text: string;
}

export type TokenLike = string | AToken | ARef;

let nextTokenId = 1;

export function createToken(text: string): AToken {
  return { id: nextTokenId++, text };
}

export function createAref(text: string, sourceArefs?: ARef[], value?: number | null): ARef {
  return {
    token: createToken(text),
    arefs: sourceArefs ?? [],
    value: value ?? null
  };
}

export function getRefText(ref: ARef): string {
  return ref.token.text;
}

export function isNumber(token: TokenLike): boolean {
  const text = typeof token === 'string'
    ? token
    : 'text' in token
      ? token.text
      : token.token.text;
  if (/^\d+$/.test(text)) return true;
  if (text.startsWith('-') && /^\d+$/.test(text.slice(1))) return true;
  return false;
}

export function isVariable(token: TokenLike): boolean {
  const text = typeof token === 'string'
    ? token
    : 'text' in token
      ? token.text
      : token.token.text;
  return text.length === 1 && /^[a-zA-Z]$/.test(text);
}

export function tokenEquals(token: ARef, str: string): boolean {
  return getRefText(token) === str;
}

export function splice(tokens: ARef[], start: number, end: number, replacement: ARef[]): ARef[] {
  return [...tokens.slice(0, start), ...replacement, ...tokens.slice(end)];
}

export function createRefWithSources(text: string, sourceTokens: ARef[]): ARef {
  return {
    token: createToken(text),
    arefs: sourceTokens,
    value: null
  };
}

