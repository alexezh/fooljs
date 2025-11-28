/**
 * Type of reference content
 * - 'digit': pure numeric value (e.g., 5, 42, -3)
 * - 'variable': single variable (e.g., x, y)
 * - 'expr': expression containing variables (e.g., 2x, x+y, x^2)
 * - 'op': operator (+, -, *, /, ^)
 */
export type RefType = 'digit' | 'variable' | 'expr' | 'op';

/**
 * Role of a token in an expression - determined during parsing
 */
export type TokenRole = 'term' | 'factor' | 'exponent' | 'operator' | 'sign';

/**
 * computed value
 */
export class ARef {
  token: AToken;
  arefs: ReadonlyArray<ARef>;
  value: any;
  delayedOp?: DelayedOp;
  refType: RefType;
  /** For expr type: which variables are contained (e.g., ['x', 'y']) 
   * assume that names are sorted
  */
  variables?: string[];

  depth?: number;

  // Term information (set during parsing)
  /** Role of this token in the expression */
  role?: TokenRole;
  /** Sign preceding this term ('+' or '-'), only for terms */
  sign?: '+' | '-';
  /** Power/exponent if this is a variable with power (e.g., x^2 has power=2) */
  power?: number;
  /** Variable name for variable refs */
  variableName?: string;
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
    return 'digit';
  }
  // Single variable
  if (/^[a-zA-Z]$/.test(text)) {
    return 'variable';
  }
  // Everything else is an expression
  return 'expr';
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
    if (ref.refType === 'variable') {
      vars.add(getRefText(ref));
    } else if (ref.variables) {
      ref.variables.forEach(v => vars.add(v));
    }
  }
  return [...vars];
}

export function createAref(text: string, sourceArefs?: ARef[], value?: number | null): ARef {
  const refType = inferRefType(text);
  const variables = refType === 'variable'
    ? [text]
    : refType === 'expr'
      ? (sourceArefs ? collectVariables(sourceArefs) : extractVariables(text))
      : undefined;

  return {
    token: createToken(text),
    arefs: sourceArefs ?? [],
    value: value ?? null,
    refType,
    variables
  };
}

export function getRefText(ref: ARef): string {
  return ref.token.text;
}

export function isNumber(ref: ARef): boolean {
  return ref.refType === 'digit';
}

export function isVariable(ref: ARef): boolean {
  return ref.refType === 'variable';
}

export function isExpr(ref: ARef): boolean {
  return ref.refType === 'expr';
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
    refType: inferRefTypeForTokens(sourceTokens),
    value: null
  };
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

/**
 * Check if two refs are compatible for combining (addition/subtraction).
 * - Two digits are always compatible
 * - Two expressions with the same variables are compatible
 * - Variable and expr containing only that variable are compatible
 */
export function areRefsCompatible(a: ARef, b: ARef): boolean {
  // Both digits - always compatible
  if (a.refType === 'digit' && b.refType === 'digit') {
    return true;
  }

  // Both variables - compatible if same variable
  if (a.refType === 'variable' && b.refType === 'variable') {
    return getRefText(a) === getRefText(b);
  }

  // Get variables from both refs
  const aVars = a.variables ?? (a.refType === 'variable' ? [getRefText(a)] : []);
  const bVars = b.variables ?? (b.refType === 'variable' ? [getRefText(b)] : []);

  // If either has no variables and other has variables, not compatible
  if (aVars.length === 0 && bVars.length > 0) return false;
  if (bVars.length === 0 && aVars.length > 0) return false;

  // Compare variable sets - must be identical for compatibility
  if (aVars.length !== bVars.length) return false;
  const aSet = new Set(aVars);
  return bVars.every(v => aSet.has(v));
}

/**
 * Determine RefType for a delayed operation based on operands
 */
function inferRefTypeForTokens(sourceArefs: ARef[]): RefType {
  // If all sources are digits, result is digit
  const allDigits = sourceArefs.every(ref => ref.refType === 'digit');
  if (allDigits) {
    return 'digit';
  }
  // If any source has variables, result is expr
  return 'expr';
}

export function createDelayedRef(
  text: string,
  sourceArefs: ARef[],
  delayedOp: DelayedOp
): ARef {
  const refType = inferRefTypeForTokens(sourceArefs);
  const variables = refType === 'expr' ? collectVariables(sourceArefs) : undefined;

  return {
    token: createToken(text),
    arefs: sourceArefs,
    value: null,
    delayedOp,
    refType,
    variables
  };
}

/**
 * Get power from an ARef. Checks:
 * 1. If ref has a delayed 'pow' op, extracts exponent value
 * 2. Falls back to ref.power property
 * 3. Default is 1
 */
export function getPower(ref: ARef): number {
  // Check for delayed pow op
  if (ref.delayedOp && ref.delayedOp.kind === 'pow') {
    const expRef = ref.delayedOp.exponent;
    if (expRef.value !== null && typeof expRef.value === 'number') {
      return expRef.value;
    }
    // Try parsing from text
    const expText = getRefText(expRef);
    const parsed = parseInt(expText, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  // Fall back to power property or default 1
  return ref.power ?? 1;
}

/**
 * Get the base variable from an ARef. Handles:
 * 1. If ref has delayed 'pow' op, returns the base
 * 2. If ref is a variable, returns the ref itself
 * 3. Returns null if not a variable
 */
export function getBaseVariable(ref: ARef): ARef | null {
  if (ref.delayedOp && ref.delayedOp.kind === 'pow') {
    return ref.delayedOp.base;
  }
  if (ref.refType === 'variable') {
    return ref;
  }
  // Check if it's an expr with a variable name (from pow)
  if (ref.variableName) {
    return ref;
  }
  return null;
}

/**
 * Get variable name from an ARef
 */
export function getVariableName(ref: ARef): string | null {
  if (ref.variableName) {
    return ref.variableName;
  }
  if (ref.delayedOp && ref.delayedOp.kind === 'pow') {
    const base = ref.delayedOp.base;
    return base.variableName ?? getRefText(base);
  }
  if (ref.refType === 'variable') {
    return getRefText(ref);
  }
  return null;
}

/**
 * Check if ref represents a variable (possibly with power)
 */
export function isVariableRef(ref: ARef): boolean {
  if (ref.refType === 'variable') return true;
  if (ref.delayedOp && ref.delayedOp.kind === 'pow') return true;
  if (ref.variableName) return true;
  return false;
}
