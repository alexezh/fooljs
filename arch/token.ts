import type { ASymbolCache } from "./asymbol";

export type ASymbol = string & {
  __tag_symbol: never
}

export function toSymbol(s: string): ASymbol {
  return s as ASymbol;
}

/**
 * Type of reference content
 * - 'digit': pure numeric value (e.g., 5, 42, -3)
 * - 'variable': single variable (e.g., x, y)
 * - 'expr': expression containing variables (e.g., 2x, x+y, x^2)
 * - 'op': operator (+, -, *, /, ^)
 */
export type RefType = 'number' | 'symbol' | 'op';

/**
 * Role of a token in an expression - determined during parsing
 */
export type TokenRole = 'term' | 'operator';

/**
 * computed value
 */
export class ARef {
  /**
   * for digits - value, for variables - name
   */
  value: any;

  /**
   * either real symbol or computed symbol
   */
  symbol: ASymbol | null;

  arefs: ReadonlyArray<ARef>;
  compute?: () => boolean;
  refType: RefType;

  /**
   * optional token from source
   */
  token?: AToken;

  /** Original ref before compute transformation */
  orig?: ARef;

  constructor(params: {
    token?: AToken;
    arefs?: ReadonlyArray<ARef>;
    value?: any;
    compute?: () => boolean;
    refType: RefType;
    role?: TokenRole;
    symbol?: ASymbol;
    orig?: ARef;
  }) {
    this.token = params.token;
    this.arefs = params.arefs ?? [];
    this.value = params.value ?? null;
    this.compute = params.compute;
    this.refType = params.refType;
    this.symbol = params.symbol ?? null;
    this.orig = params.orig;
  }

  get isNumber(): boolean {
    return this.refType === 'number';
  }

  get isOp(): boolean {
    return this.refType === 'op';
  }

  get isTerm(): boolean {
    return this.refType !== 'op';
  }

  get isSymbol(): boolean {
    return this.refType === 'symbol';
  }

  isExp(): boolean {
    return this.arefs?.length >= 2 && this.arefs[1].token?.text === '^';
  }

  isInternalSymbol(): boolean {
    return (this.symbol && this.symbol[0] === "?") ? true : false;
  }

  isPublicVariable(): boolean {
    return (this.symbol && this.symbol[0] !== "?") ? true : false;
  }

  getVariableName(): string {
    return this.value as string;
  }

  getBase(): ARef {
    return (this.isExp()) ? this.arefs[0] : this;
  }

  getPower(): ARef {
    return (this.isExp()) ? this.arefs[2] : createNumberRef(1);
  }
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

/**
 * Determine the RefType from text content
 */
export function inferRefType(text: string): RefType {
  // Operators
  if (['+', '-', '*', '/', '^', '(', ')'].includes(text)) {
    return 'op';
  }
  // Pure number (including negative)
  if (/^-?\d+$/.test(text)) {
    return 'number';
  }
  // Everything else (variables, expressions, symbols)
  return 'symbol';
}

/**
 * Create a compute function that updates the ref in place.
 * Returns a function that:
 * - Calls the value-computing function
 * - If result is not null and different, stores original in orig and updates ref
 * - Returns true if updated, false otherwise
 */
export function makeComputeFunction(computeValue: () => number | null): () => boolean {
  return function (this: ARef): boolean {
    const result = computeValue();

    if (result !== null && result !== this.value) {
      // Store original state in orig
      this.orig = new ARef({
        arefs: this.arefs,
        value: this.value,
        token: this.token,
        refType: this.refType,
        symbol: this.symbol ?? undefined,
        compute: this.compute,
      });

      // Update to computed value
      this.value = result;
      this.arefs = [];
      this.symbol = null;
      this.compute = undefined;
      this.refType = 'number';

      return true;
    }

    return false;
  };
}

export function createSymbolRef(
  cache: ASymbolCache,
  sourceRefs?: ARef[],
  value?: number | null,
  compute?: () => boolean,
  token?: AToken
): ARef {
  const arefs = sourceRefs ?? []
  const symbol = cache.makeSymbol(arefs);

  return new ARef({
    arefs: arefs,
    value: value ?? null,
    token: token,
    refType: "symbol",
    symbol: symbol,
    compute: compute
  });
}

export function createOpRef(op: string, token?: AToken): ARef {
  return new ARef({
    arefs: [],
    value: null,
    refType: "op",
    token,
    symbol: toSymbol(op)
  });
}

export function createNumberRef(val: number, token?: AToken): ARef {
  return new ARef({
    arefs: [],
    value: val,
    refType: "number",
    token,
  });
}

export function tokenEquals(token: ARef, str: string): boolean {
  return token.symbol === str;
}

export function splice(tokens: ReadonlyArray<ARef>, start: number, end: number, replacement: ARef[]): ARef[] {
  return [...tokens.slice(0, start), ...replacement, ...tokens.slice(end)];
}

export function createRefWithSources(text: string, sourceTokens: ARef[]): ARef {
  return new ARef({
    token: createToken(text),
    arefs: sourceTokens,
    refType: 'symbol',
    value: null
  });
}

// ============================================================================
// Type definitions
// ============================================================================

export interface VariablePowerResult {
  variable: ARef | null;
  power: number | null;
  endIndex: number;
}

/**
 * Check if ref represents a variable (symbol with single letter name)
 */
export function isVariableRef(ref: ARef): boolean {
  if (ref.refType === 'symbol' && ref.symbol) {
    return ref.symbol.length === 1 && /^[a-zA-Z]$/.test(ref.symbol);
  }
  return false;
}

/**
 * Get variable name from an ARef
 */
export function getVariableName(ref: ARef): string | null {
  if (ref.refType === 'symbol') {
    return ref.symbol;
  }
  return null;
}

/**
 * Get power from an ARef as a number
 */
export function getPower(ref: ARef): number {
  const powerRef = ref.getPower();
  if (powerRef.isNumber && typeof powerRef.value === 'number') {
    return powerRef.value;
  }
  return 1;
}

/**
 * Get the base variable from an ARef
 */
export function getBaseVariable(ref: ARef): ARef | null {
  return ref.getBase();
}
