import { AstNode } from "../ast.js";
import { BoolVec, FEATURE_COUNT, FEATURE_INDEX, FeatureFn } from "./featurefn.js";
import { Goal } from "./plannercore.js";

export class FeatureExtractor implements FeatureFn {
  constructor(
    private readonly opts?: {
      largeThreshold?: number;  // default 60 nodes
      manyArgsThreshold?: number; // default 4
    }
  ) { }

  extract(root: AstNode, goal: Goal): BoolVec {
    const f = new Array<boolean>(FEATURE_COUNT).fill(false);

    const largeThreshold = this.opts?.largeThreshold ?? 60;
    const manyArgsThreshold = this.opts?.manyArgsThreshold ?? 4;

    const tgt = goal.kind === "solve_for" ? goal.sym : null;

    // stats gathered in one traversal
    const st: Stats = {
      nodeCount: 0,
      hasNum: false,
      hasSym: false,
      symbols: new Set<string>(),
      ops: new Set<string>(),
      maxNumericPow: 1,
      hasNumericPow: false,
      hasNonNumericPow: false,
      hasCrossTerm: false,
      targetMaxDeg: 0,
      targetPresent: false,
      targetInDenom: false,
      hasManyTermsSum: false,
      hasManyFactorsMul: false,
      hasEq: false,
      hasSolve: false,
      eqRhsZero: false,
      eqLhsZero: false,
    };

    // Walk whole tree
    walk(root, (n) => {
      st.nodeCount++;

      if (isNum(n)) st.hasNum = true;
      if (isSym(n)) {
        st.hasSym = true;
        const s = getSymName(n);
        if (s) st.symbols.add(s);
        if (tgt && s === tgt) st.targetPresent = true;
      }

      const op = getOp(n);
      if (op) {
        st.ops.add(op);

        if (op === "sum" || op === "add") {
          const args = getArgs(n);
          if (args.length >= manyArgsThreshold) st.hasManyTermsSum = true;
        }
        if (op === "mul" || op === "mul_" || op === "times") {
          const args = getArgs(n);
          if (args.length >= manyArgsThreshold) st.hasManyFactorsMul = true;

          // cross-term heuristic: >=2 distinct symbols in a single mul
          const syms = new Set<string>();
          for (const a of args) collectSyms(a, syms);
          if (syms.size >= 2) st.hasCrossTerm = true;
        }

        if (op === "pow" || op === "power" || op === "^") {
          const [base, exp] = getArgs(n);
          if (exp !== undefined) {
            if (isNum(exp)) {
              st.hasNumericPow = true;
              const k = Math.abs(getNumValue(exp));
              if (Number.isFinite(k)) st.maxNumericPow = Math.max(st.maxNumericPow, Math.floor(k));
              // target in denom via negative exponent: pow(x, -k)
              if (tgt && isTarget(base, tgt) && getNumValue(exp) < 0) st.targetInDenom = true;
            } else {
              st.hasNonNumericPow = true;
            }
          }
        }

        if (op === "div" || op === "/") {
          const args = getArgs(n);
          if (args.length >= 2 && tgt) {
            const denom = args[1];
            if (containsSym(denom, tgt)) st.targetInDenom = true;
          }
        }

        if (op === "eq") {
          st.hasEq = true;
          const [lhs, rhs] = getArgs(n);
          if (lhs !== undefined && isZero(lhs)) st.eqLhsZero = true;
          if (rhs !== undefined && isZero(rhs)) st.eqRhsZero = true;

          // Also compute target degree for solve contexts: look inside both sides
          if (tgt) {
            st.targetMaxDeg = Math.max(st.targetMaxDeg, estimateMaxDegree(lhs, tgt));
            st.targetMaxDeg = Math.max(st.targetMaxDeg, estimateMaxDegree(rhs, tgt));
          }
        }

        if (op === "solve") {
          st.hasSolve = true;
          // common solve form: solve(eq(...), solved_for(x)) — still just traverse;
          // degree is handled by eq above.
        }
      }
    });

    // Fill booleans
    f[FEATURE_INDEX.has_eq] = st.hasEq;
    f[FEATURE_INDEX.has_solve] = st.hasSolve;

    f[FEATURE_INDEX.has_sum] = hasAnyOp(st, ["sum", "add"]);
    f[FEATURE_INDEX.has_mul] = hasAnyOp(st, ["mul", "mul_", "times"]);
    f[FEATURE_INDEX.has_div] = hasAnyOp(st, ["div", "/"]);
    f[FEATURE_INDEX.has_neg] = hasAnyOp(st, ["neg", "uminus"]);
    f[FEATURE_INDEX.has_pow] = hasAnyOp(st, ["pow", "power", "^"]);
    f[FEATURE_INDEX.has_sqrt] = hasAnyOp(st, ["sqrt"]);
    f[FEATURE_INDEX.has_log] = hasAnyOp(st, ["log"]);
    f[FEATURE_INDEX.has_exp] = hasAnyOp(st, ["exp"]);

    f[FEATURE_INDEX.has_num] = st.hasNum;
    f[FEATURE_INDEX.has_sym] = st.hasSym;
    f[FEATURE_INDEX.has_many_terms_sum] = st.hasManyTermsSum;
    f[FEATURE_INDEX.has_many_factors_mul] = st.hasManyFactorsMul;

    f[FEATURE_INDEX.has_numeric_power] = st.hasNumericPow;
    f[FEATURE_INDEX.has_non_numeric_power] = st.hasNonNumericPow;
    f[FEATURE_INDEX.max_power_ge_2] = st.maxNumericPow >= 2;
    f[FEATURE_INDEX.max_power_ge_3] = st.maxNumericPow >= 3;

    f[FEATURE_INDEX.goal_solve_for] = goal.kind === "solve_for";
    f[FEATURE_INDEX.target_present] = !!tgt && st.targetPresent;

    if (tgt) {
      f[FEATURE_INDEX.target_linear] = st.targetMaxDeg === 1;
      f[FEATURE_INDEX.target_quadratic] = st.targetMaxDeg === 2;
      f[FEATURE_INDEX.target_degree_ge_3] = st.targetMaxDeg >= 3;
      f[FEATURE_INDEX.target_in_denominator] = st.targetInDenom;
    }

    f[FEATURE_INDEX.has_cross_term] = st.hasCrossTerm;

    f[FEATURE_INDEX.eq_rhs_is_zero] = st.eqRhsZero;
    f[FEATURE_INDEX.eq_lhs_is_zero] = st.eqLhsZero;

    f[FEATURE_INDEX.ast_large] = st.nodeCount >= largeThreshold;

    return f;
  }
}

// ============================================================
// Internal helpers
// ============================================================

type Stats = {
  nodeCount: number;
  hasNum: boolean;
  hasSym: boolean;
  symbols: Set<string>;
  ops: Set<string>;
  maxNumericPow: number;
  hasNumericPow: boolean;
  hasNonNumericPow: boolean;
  hasCrossTerm: boolean;

  targetMaxDeg: number;
  targetPresent: boolean;
  targetInDenom: boolean;

  hasManyTermsSum: boolean;
  hasManyFactorsMul: boolean;

  hasEq: boolean;
  hasSolve: boolean;
  eqRhsZero: boolean;
  eqLhsZero: boolean;
};

function hasAnyOp(st: Stats, names: string[]) {
  for (const n of names) if (st.ops.has(n)) return true;
  return false;
}

function walk(node: AstNode, fn: (n: AstNode) => void) {
  const stack: AstNode[] = [node];
  while (stack.length) {
    const n = stack.pop();
    fn(n!);

    const args = getArgs(n);
    for (let i = args.length - 1; i >= 0; i--) stack.push(args[i]);
  }
}

// --- duck typing ---
function isNum(n: any): boolean {
  if (typeof n === "number") return Number.isFinite(n);
  if (!n || typeof n !== "object") return false;
  const t = (n.type ?? n.kind ?? "").toString();
  return t === "num" || t === "number" || typeof n.value === "number";
}

function getNumValue(n: any): number {
  if (typeof n === "number") return n;
  if (n && typeof n.value === "number") return n.value;
  return NaN;
}

function isZero(n: any): boolean {
  return isNum(n) && getNumValue(n) === 0;
}

function isSym(n: any): boolean {
  if (typeof n === "string") return true; // treat bare strings as symbols
  if (!n || typeof n !== "object") return false;
  const t = (n.type ?? n.kind ?? "").toString();
  return t === "sym" || t === "symbol" || typeof n.name === "string";
}

function getSymName(n: any): string | null {
  if (typeof n === "string") return n;
  if (n && typeof n.name === "string") return n.name;
  return null;
}

function getOp(n: any): string | null {
  if (!n || typeof n !== "object") return null;
  const t = (n.type ?? n.kind ?? "").toString();
  if (t === "call" || t === "app" || t === "op") return (n.op ?? n.name ?? null);
  // allow direct {op:"sum", args:[...]}
  if (typeof n.op === "string") return n.op;
  if (typeof n.name === "string" && Array.isArray(n.args)) return n.name;
  return null;
}

function getArgs(n: any): AstNode[] {
  if (!n || typeof n !== "object") return [];
  if (Array.isArray(n.args)) return n.args;
  // allow {items:[...]} for n-ary nodes (optional)
  if (Array.isArray(n.items)) return n.items;
  return [];
}

function isTarget(n: AstNode, sym: string): boolean {
  return isSym(n) && getSymName(n) === sym;
}

function containsSym(node: AstNode, sym: string): boolean {
  let found = false;
  walk(node, (n) => {
    if (isSym(n) && getSymName(n) === sym) found = true;
  });
  return found;
}

function collectSyms(node: AstNode, out: Set<string>) {
  walk(node, (n) => {
    if (isSym(n)) {
      const s = getSymName(n);
      if (s) out.add(s);
    }
  });
}

// Approximate max degree of `sym` in an expression.
// Handles:
// - sym -> degree 1
// - pow(sym, k) with numeric k -> degree k
// - mul(...) -> sum degrees across factors
// - sum(...) -> max degree across terms
// - div(a,b) -> degree(a) (and marks denom elsewhere)
// - neg(x) -> degree(x)
// - everything else -> max of children
function estimateMaxDegree(node: AstNode | undefined, sym: string): number {
  if (node === undefined) return 0;
  if (isNum(node)) return 0;
  if (isSym(node)) return getSymName(node) === sym ? 1 : 0;

  const op = getOp(node);
  const args = getArgs(node);

  if (!op) {
    // unknown node shape: recurse into args if any
    let m = 0;
    for (const a of args) m = Math.max(m, estimateMaxDegree(a, sym));
    return m;
  }

  switch (op) {
    case "pow":
    case "power":
    case "^": {
      const base = args[0];
      const exp = args[1];
      const baseDeg = estimateMaxDegree(base, sym);
      if (baseDeg === 0) return 0;
      if (exp && isNum(exp)) return Math.max(0, Math.floor(Math.abs(getNumValue(exp))));
      // non-numeric exponent: treat as ">=2" only if base has sym; but keep 2 as conservative
      return 2;
    }
    case "mul":
    case "mul_":
    case "times": {
      // sum degrees across factors (monomial approximation)
      let sum = 0;
      for (const a of args) sum += estimateMaxDegree(a, sym);
      return sum;
    }
    case "sum":
    case "add": {
      let m = 0;
      for (const a of args) m = Math.max(m, estimateMaxDegree(a, sym));
      return m;
    }
    case "div":
    case "/": {
      // degree from numerator only (denominator tracked separately)
      return args[0] ? estimateMaxDegree(args[0], sym) : 0;
    }
    case "neg":
    case "uminus": {
      return args[0] ? estimateMaxDegree(args[0], sym) : 0;
    }
    default: {
      let m = 0;
      for (const a of args) m = Math.max(m, estimateMaxDegree(a, sym));
      return m;
    }
  }
}