/**
 * computed value
 */
export interface ARef {
  token: AToken;
  arefs: ReadonlyArray<ARef>;
  value: any;
  delayedOp?: DelayedOp;
}

export interface AToken {
  id: number;
  text: string;
}

export interface AModel {
  parent?: AModel;
  transform: string;
  tokens: ARef[];
  approxCost: number;
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

export function splice(tokens: ReadonlyArray<ARef>, start: number, end: number, replacement: ARef[]): ARef[] {
  return [...tokens.slice(0, start), ...replacement, ...tokens.slice(end)];
}

export function createRefWithSources(text: string, sourceTokens: ARef[]): ARef {
  return {
    token: createToken(text),
    arefs: sourceTokens,
    value: null
  };
}

export function tokensToKey(tokens: ARef[]): string {
  return tokens.map(t => getRefText(t)).join('|');
}

export function modelToKey(model: AModel): string {
  return tokensToKey(model.tokens);
}

/**
 * Create initial model from tokens
 */
export function createInitialModel(tokens: ARef[]): AModel {
  return {
    parent: undefined,
    transform: 'initial',
    tokens,
    approxCost: 0
  };
}

/**
 * Get the path from root to this model
 */
export function getModelPath(model: AModel): AModel[] {
  const path: AModel[] = [];
  let current: AModel | undefined = model;
  while (current) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

// ============================================================================
// Type definitions
// ============================================================================

export interface VariablePowerResult {
  variable: ARef | null;
  power: number | null;
  endIndex: number;
}

// Operation types for delayed evaluation
export type DelayedOp =
  | { kind: 'add'; left: ARef; right: ARef }
  | { kind: 'sub'; left: ARef; right: ARef }
  | { kind: 'mul'; left: ARef; right: ARef }
  | { kind: 'div'; left: ARef; right: ARef }
  | { kind: 'pow'; base: ARef; exponent: ARef }
  | { kind: 'combine'; terms: ARef[]; op: string }
  | { kind: 'wrap'; terms: ARef[] };

export function createDelayedRef(
  text: string,
  sourceArefs: ARef[],
  delayedOp: DelayedOp
): ARef {
  return {
    token: createToken(text),
    arefs: sourceArefs,
    value: null,
    delayedOp
  };
}

export function createModel(
  parent: AModel,
  transform: string,
  tokens: ARef[],
  cost: number
): AModel {
  return {
    parent,
    transform,
    tokens,
    approxCost: parent.approxCost + cost
  };
}
