import type { AModelSymbolCache, ASymbol } from "./asymbol";

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
export type TokenRole = 'term' | 'operator' | 'sign';

/**
 * computed value
 */
export class ARef {
  /**
   * for digits - value, for variables - name
   */
  value: any;
  symbol: ASymbol | null;

  token?: AToken;
  arefs: ReadonlyArray<ARef>;
  compute?: () => number | null;
  refType: RefType;
  /** For expr type: which variables are contained (e.g., ['x', 'y'])
   * assume that names are sorted
  */
  variables?: string[];

  depth?: number;

  // Term information (set during parsing)
  /** Role of this token in the expression */
  role?: TokenRole;

  constructor(params: {
    token?: AToken;
    arefs?: ReadonlyArray<ARef>;
    value?: any;
    compute?: () => number | null;
    refType: RefType;
    variables?: string[];
    depth?: number;
    role?: TokenRole;
    symbol?: ASymbol;
  }) {
    this.token = params.token;
    this.arefs = params.arefs ?? [];
    this.value = params.value ?? null;
    this.compute = params.compute;
    this.refType = params.refType;
    this.variables = params.variables;
    this.depth = params.depth;
    this.role = params.role;
    this.symbol = params.symbol ?? null;
  }

  get isNumber(): boolean {
    return this.refType === 'number';
  }

  get isSymbol(): boolean {
    return this.refType === 'symbol';
  }

  isExp(): boolean {
    return this.arefs?.length >= 2 && this.arefs[1].token?.text === '^';
  }

  getVariableName(): string {
    return this.value as string;
  }

  getBase(): ARef {
    return (this.isExp()) ? this.arefs[0] : this;
  }
  getPower(): ARef {
    return (this.isExp()) ? this.arefs[2] : new ARef({
      token: createToken('1'),
      refType: 'number',
      value: 1
    });
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
 * Extract variable names from text
 */
export function extractVariables(text: string): string[] {
  const matches = text.match(/[a-zA-Z]/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Collect all variables from source refs
 */
export function collectVariables(refs: ARef[]): string[] {
  const vars = new Set<string>();
  for (const ref of refs) {
    if (ref.refType === 'symbol' && ref.symbol) {
      vars.add(ref.symbol);
    } else if (ref.variables) {
      ref.variables.forEach(v => vars.add(v));
    }
  }
  return [...vars];
}

// export function createAref(symbol: ASymbol, sourceArefs?: ARef[], value?: number | null): ARef {
//   const refType = inferRefType(symbol as string);
//   const variables = refType === 'symbol'
//     ? [symbol as string]
//     : undefined;

//   return new ARef({
//     arefs: sourceArefs ?? [],
//     value: value ?? null,
//     refType,
//     variables,
//     symbol: symbol as string
//   });
// }

export function createSymbolRef(
  cache: AModelSymbolCache,
  sourceRefs?: ARef[],
  value?: number | null,
  compute?: () => number | null
): ARef {
  const arefs = sourceRefs ?? []
  const symbol = cache.makeSymbol(arefs);

  return new ARef({
    arefs: arefs,
    value: value ?? null,
    refType: "symbol",
    symbol: symbol,
    compute: compute
  });
}

export function createOpRef(op: string): ARef {
  return new ARef({
    arefs: [],
    value: null,
    refType: "op"
  });
}

export function createNumberRef(val: number): ARef {
  return new ARef({
    arefs: [],
    value: val,
    refType: "number"
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

// Removed DelayedOp - using compute function instead

/**
 * Check if two refs are compatible for combining (addition/subtraction).
 * - Two digits are always compatible
 * - Two expressions with the same variables are compatible
 * - Variable and expr containing only that variable are compatible
 */
export function areRefsCompatible(a: ARef, b: ARef): boolean {
  // Both numbers - always compatible
  if (a.refType === 'number' && b.refType === 'number') {
    return true;
  }

  // Both symbols - compatible if same symbol
  if (a.refType === 'symbol' && b.refType === 'symbol') {
    return a.symbol === b.symbol;
  }

  // Get variables from both refs
  const aVars = a.variables ?? (a.refType === 'symbol' && a.symbol ? [a.symbol] : []);
  const bVars = b.variables ?? (b.refType === 'symbol' && b.symbol ? [b.symbol] : []);

  // If either has no variables and other has variables, not compatible
  if (aVars.length === 0 && bVars.length > 0) return false;
  if (bVars.length === 0 && aVars.length > 0) return false;

  // Compare variable sets - must be identical for compatibility
  if (aVars.length !== bVars.length) return false;
  const aSet = new Set(aVars);
  return bVars.every(v => aSet.has(v));
}

// Removed createDelayedRef - use createSymbolRef with compute parameter instead

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
