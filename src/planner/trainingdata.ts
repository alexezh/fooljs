import { VerbKind } from "./verb.js";

export type GenStage = 0 | 1 | 2;

export interface TrainingStep {
  verb: VerbKind;
  body: string; // "<match> [where ...] do ...; <final_expr>"
}

export interface SampleDataItem {
  kind: "sample";
  gen: GenStage;
  sample: string;
  expected: string;
  steps: TrainingStep[];
}

export interface GeneralizeDataItem {
  kind: "generalize";
  gen: GenStage;
  verb: VerbKind;
  examples: string[];
  expected: string[];
  notes?: string[];
}

export type TrainingDataItem = SampleDataItem | GeneralizeDataItem;

// ------------------------------------------------------------------
// Common bodies (now using calc(...) and fract(p,q))
// Assumptions:
// - is_num(...) is true for integers AND fract(p,q)
// - calc(...) is a distinct compute token (prevents recursive no-op)
// - Only reduce fract(p,q) when divisible(p,q) (your “simplest” rule)
// ------------------------------------------------------------------

const CALC_SUM2 = "sum(?a, ?b) where is_num(a), is_num(b) do calc(sum(?a, ?b))";
const CALC_SUM3 = "sum(?a, ?b, ?c) where is_num(a), is_num(b), is_num(c) do calc(sum(?a, ?b, ?c))";

// fractions: only compute when divisible
const CALC_FRACT = "fract(?p, ?q) where is_num(p), is_num(q), divisible(p, q) do calc(fract(?p, ?q))";
// optional “calc reduces fract” token rule (if you keep calc as wrapper)
const CALC_INNER_FRACT = "calc(fract(?p, ?q)) where divisible(p, q) do div(?p, ?q)";

// zero identities (no need for is_num guards)
const SUM_ZERO_L = "sum(0, ?b) do ?b";
const SUM_ZERO_R = "sum(?a, 0) do ?a";

// like-terms rules (keep structural; calc handles numeric later)
const X_PLUS_X = "sum(?x, ?x) do mul(2, ?x)";
const X_PLUS_KX = "sum(?x, mul(?k, ?x)) do mul(sum(1, ?k), ?x)";
const KX_PLUS_JX = "sum(mul(?k, ?x), mul(?j, ?x)) do mul(sum(?k, ?j), ?x)";

export const trainingData: TrainingDataItem[] = [
  // ============================================================
  // GEN 0 — numeric-only simplifications (no varargs)
  // ============================================================

  { kind: "sample", gen: 0, sample: "sum(1, 1)", expected: "2", steps: [{ verb: "evaluate", body: CALC_SUM2 }] },
  { kind: "sample", gen: 0, sample: "sum(2, 3)", expected: "5", steps: [{ verb: "evaluate", body: CALC_SUM2 }] },
  { kind: "sample", gen: 0, sample: "sum(10, -3)", expected: "7", steps: [{ verb: "evaluate", body: CALC_SUM2 }] },

  { kind: "sample", gen: 0, sample: "sum(1, 2, 3)", expected: "6", steps: [{ verb: "evaluate", body: CALC_SUM3 }] },
  { kind: "sample", gen: 0, sample: "sum(7, 8, -5)", expected: "10", steps: [{ verb: "evaluate", body: CALC_SUM3 }] },

  // open nested sums structurally, then calc
  {
    kind: "sample",
    gen: 0,
    sample: "sum(sum(1, 2), 3)",
    expected: "6",
    steps: [
      { verb: "normalize", body: "sum(sum(?a, ?b), ?c) do sum(?a, ?b, ?c)" },
      { verb: "evaluate", body: CALC_SUM3 },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(1, sum(2, 3))",
    expected: "6",
    steps: [
      { verb: "normalize", body: "sum(?a, sum(?b, ?c)) do sum(?a, ?b, ?c)" },
      { verb: "evaluate", body: CALC_SUM3 },
    ],
  },

  { kind: "sample", gen: 0, sample: "sum(0, 5)", expected: "5", steps: [{ verb: "simplify", body: SUM_ZERO_L }] },
  { kind: "sample", gen: 0, sample: "sum(5, 0)", expected: "5", steps: [{ verb: "simplify", body: SUM_ZERO_R }] },

  // --- Fractions (still gen=0; demonstrates “is_num(fract)=true, but only calc if divisible”)
  {
    kind: "sample",
    gen: 0,
    sample: "fract(4, 2)",
    expected: "2",
    steps: [
      { verb: "evaluate", body: CALC_FRACT },
      // optional: if calc wraps and you need to unwrap to div for downstream ops
      { verb: "evaluate", body: CALC_INNER_FRACT },
    ],
  },

  // ---- Generalize checkpoint (GEN 0) ----
  {
    kind: "generalize",
    gen: 0,
    verb: "evaluate",
    examples: [CALC_SUM2, CALC_SUM3],
    expected: [CALC_SUM2, CALC_SUM3],
    notes: ["gen=0: keep arity-specific; do not introduce ?args..."],
  },

  // ============================================================
  // GEN 1 — variables + coefficients (still no varargs)
  // ============================================================

  { kind: "sample", gen: 1, sample: "sum(x, 0)", expected: "x", steps: [{ verb: "simplify", body: SUM_ZERO_R }] },
  { kind: "sample", gen: 1, sample: "sum(0, x)", expected: "x", steps: [{ verb: "simplify", body: SUM_ZERO_L }] },

  { kind: "sample", gen: 1, sample: "sum(x, x)", expected: "mul(2, x)", steps: [{ verb: "collect", body: X_PLUS_X }] },

  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, mul(5, x))",
    expected: "mul(6, x)",
    steps: [
      { verb: "collect", body: X_PLUS_KX },     // builds mul(sum(1,5), x)
      { verb: "evaluate", body: CALC_SUM2 },    // calc(sum(1,5))
    ],
  },

  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(2, x), mul(3, x))",
    expected: "mul(5, x)",
    steps: [
      { verb: "collect", body: KX_PLUS_JX },    // builds mul(sum(2,3), x)
      { verb: "evaluate", body: CALC_SUM2 },
    ],
  },

  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, mul(5, x), mul(10, x))",
    expected: "mul(16, x)",
    steps: [
      { verb: "collect", body: "sum(?x, mul(?k, ?x), ?r) do sum(mul(sum(1, ?k), ?x), ?r)" },
      { verb: "evaluate", body: CALC_SUM2 },
      { verb: "collect", body: "sum(mul(?k, ?x), mul(?j, ?x)) do mul(sum(?k, ?j), ?x)" },
      { verb: "evaluate", body: CALC_SUM2 },
    ],
  },

  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, sum(mul(5, x), mul(10, x)))",
    expected: "mul(16, x)",
    steps: [
      { verb: "normalize", body: "sum(?t, sum(?a, ?b)) do sum(?t, ?a, ?b)" },
      { verb: "collect", body: "sum(mul(?k, ?x), mul(?j, ?x), ?r) do sum(mul(sum(?k, ?j), ?x), ?r)" },
      { verb: "evaluate", body: CALC_SUM2 },
      { verb: "collect", body: "sum(?x, mul(?k, ?x)) do mul(sum(1, ?k), ?x)" },
      { verb: "evaluate", body: CALC_SUM2 },
    ],
  },

  // ---- Generalize checkpoint (GEN 1) ----
  {
    kind: "generalize",
    gen: 1,
    verb: "collect",
    examples: [X_PLUS_X, X_PLUS_KX, KX_PLUS_JX],
    expected: [X_PLUS_X, X_PLUS_KX, KX_PLUS_JX],
    notes: [
      "gen=1: keep rules structural (no selection/search logic in a single body).",
      "numeric reduction is always via calc(sum(...)) and the evaluate verb.",
    ],
  },

  // ============================================================
  // GEN 2 — allow varargs/general patterns
  // ============================================================

  {
    kind: "generalize",
    gen: 2,
    verb: "evaluate",
    examples: [CALC_SUM2, CALC_SUM3],
    expected: [
      // arity-lift for calc-wrapping
      "sum(?args...) where all_num(?args) do calc(sum(?args...))",
    ],
    notes: ["gen=2: allow varargs; is_num(true) for fract, but only reduce fract if divisible(p,q)."],
  },
];