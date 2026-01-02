import { VerbKind } from "./verb.js";

/**
 * Training item kinds:
 * - "sample": a concrete expression + expected final result, plus one-or-more verb choices (steps).
 * - "generalize": a checkpoint requesting LLM generalization, with expected generalized statements.
 *
 * gen:
 *  0 = seed phase (no varargs)
 *  1 = after first generalization pass (still no varargs)
 *  2 = varargs/general patterns allowed
 */

export type GenStage = 0 | 1 | 2;

export interface TrainingStep {
  verb: VerbKind;
  body: string; // single-statement DSL: "<match> [where ...] do ...; <final_expr>"
}

export interface SampleDataItem {
  kind: "sample";
  gen: GenStage;
  sample: string;    // expression to run
  expected: string;  // expected final simplified expression
  steps: TrainingStep[];
}

export interface GeneralizeDataItem {
  kind: "generalize";
  gen: GenStage;
  verb: VerbKind;
  examples: string[];   // bodies we trained in this block for this verb
  expected: string[];   // expected generalized bodies (LLM output should match/contain these)
  notes?: string[];
}

export type TrainingDataItem = SampleDataItem | GeneralizeDataItem;

// ------------------------------------------------------------
// SumVerb training curriculum
//   - 10 numeric-only simplifications (gen 0)
//   - generalize checkpoint (evaluate/collect constants) → gen 1
//   - 20 simplifications with variables (gen 1)
//   - generalize checkpoint (like-terms + constants-anywhere) → gen 2
// ------------------------------------------------------------
export const trainingData: TrainingDataItem[] = [
  // ============================================================
  // GEN 0 — 10 basic numeric simplifications (no varargs)
  // ============================================================

  {
    kind: "sample",
    gen: 0,
    sample: "sum(1, 1)",
    expected: "2",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(2, 3)",
    expected: "5",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(10, -3)",
    expected: "7",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(1, 2, 3)",
    expected: "6",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(7, 8, -5)",
    expected: "10",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(sum(1, 2), 3)",
    expected: "6",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_sum(a), is_number(b) do sum(eval(?a), ?b)",
      },
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(1, sum(2, 3))",
    expected: "6",
    steps: [
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_sum(b) do sum(?a, eval(?b))",
      },
      {
        verb: "evaluate",
        body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(sum(1, 1), sum(2, 3))",
    expected: "7",
    steps: [
      { verb: "evaluate", body: "sum(?a, ?b) where is_sum(a), is_sum(b) do sum(eval(?a), eval(?b))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(0, 5)",
    expected: "5",
    steps: [
      {
        verb: "simplify",
        body: "sum(?a, ?b) where is_number(a), a == 0 do ?b",
      },
    ],
  },
  {
    kind: "sample",
    gen: 0,
    sample: "sum(5, 0)",
    expected: "5",
    steps: [
      {
        verb: "simplify",
        body: "sum(?a, ?b) where is_number(b), b == 0 do ?a",
      },
    ],
  },

  // ---- Generalize checkpoint after GEN 0 seeds ----
  {
    kind: "generalize",
    gen: 0,
    verb: "evaluate",
    examples: [
      "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
    ],
    expected: [
      // still no varargs at this stage; expected outcome is “cover both arities consistently”
      "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
    ],
    notes: [
      "Do not introduce ?args... at gen=0. Just normalize parameter naming / conditions.",
    ],
  },

  // ============================================================
  // GEN 1 — 20 simplifications with variables (still no varargs)
  // Includes x + 5x + 10x cases.
  // ============================================================

  // 1) Identity zeros with symbols
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, 0)",
    expected: "x",
    steps: [{ verb: "simplify", body: "sum(?a, ?b) where is_symbol(a), is_number(b), b == 0 do ?a" }],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(0, x)",
    expected: "x",
    steps: [{ verb: "simplify", body: "sum(?a, ?b) where is_number(a), a == 0, is_symbol(b) do ?b" }],
  },

  // 2) Two like terms
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, x)",
    expected: "mul(2, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_symbol(a), is_symbol(b), a == b do mul(2, ?a)" },
    ],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(2, x), x)",
    expected: "mul(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), sym_of(a) == b do mul(sum(num_of(a), 1), ?b)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, mul(5, x))",
    expected: "mul(6, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do mul(sum(1, num_of(b)), ?a)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 3) Two mul(k,x) like terms
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(2, x), mul(3, x))",
    expected: "mul(5, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 4) x + 5x + 10x (three terms) — multiple steps
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, mul(5, x), mul(10, x))",
    expected: "mul(16, x)",
    steps: [
      // fold x + 5x -> 6x
      { verb: "collect", body: "sum(?a, ?b, ?c) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do sum(mul(sum(1, num_of(b)), a), ?c)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      // then 6x + 10x -> 16x
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 5) same but shuffled order
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(10, x), x, mul(5, x))",
    expected: "mul(16, x)",
    steps: [
      { verb: "reorder", body: "sum(?a, ?b, ?c) where exists_symbol([a,b,c]) do sum(sort_sum_args([?a, ?b, ?c])...)" },
      { verb: "collect", body: "sum(?a, ?b, ?c) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do sum(mul(sum(1, num_of(b)), a), ?c)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 6) constants + like terms mixed
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(2, x), 3, mul(4, x), 5)",
    expected: "sum(mul(6, x), 8)",
    steps: [
      // collect like x terms (2x + 4x -> 6x), keep constants
      { verb: "collect", body: "sum(?a, ?b, ?c, ?d) do select([?a, ?b, ?c, ?d], is_like_x_term); sum(sum(.), ^...)" },
      // evaluate the coefficients/constant groupings as they appear
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 7) pure constants inside variable sum (3-arity)
  {
    kind: "sample",
    gen: 1,
    sample: "sum(1, 2, x)",
    expected: "sum(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(1, x, 2)",
    expected: "sum(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "reorder", body: "sum(?a, ?b) where is_number(a), is_symbol(b) do sum(?a, ?b)" },
    ],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, 1, 2)",
    expected: "sum(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "reorder", body: "sum(?a, ?b) where is_number(a), is_symbol(b) do sum(?a, ?b)" },
    ],
  },

  // 8) different symbols: no like-term collect, but reorder/group may apply
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, y)",
    expected: "sum(x, y)",
    steps: [
      { verb: "check", body: "sum(?a, ?b) where is_symbol(a), is_symbol(b), a != b do sum(?a, ?b)" },
    ],
  },
  {
    kind: "sample",
    gen: 1,
    sample: "sum(y, x)",
    expected: "sum(x, y)",
    steps: [
      { verb: "reorder", body: "sum(?a, ?b) where is_symbol(a), is_symbol(b), a > b do sum(?b, ?a)" },
    ],
  },

  // 9) mix: constant + two different symbols
  {
    kind: "sample",
    gen: 1,
    sample: "sum(2, x, y)",
    expected: "sum(2, x, y)",
    steps: [
      { verb: "reorder", body: "sum(?a, ?b, ?c) where is_number(a), is_symbol(b), is_symbol(c) do sum(?a, sort_sum_args([?b, ?c])...)" },
    ],
  },

  // 10) nested like terms
  {
    kind: "sample",
    gen: 1,
    sample: "sum(sum(x, x), mul(3, x))",
    expected: "mul(5, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_sum(a), is_mul_num_sym(b) do sum(eval(?a), ?b)" },
      { verb: "collect", body: "sum(?a, ?b) where is_symbol(a), is_symbol(b), a == b do mul(2, ?a)" },
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 11) coefficient zero
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(0, x), x)",
    expected: "x",
    steps: [
      { verb: "simplify", body: "mul(?k, ?x) where is_number(k), k == 0 do 0" },
      { verb: "simplify", body: "sum(?a, ?b) where is_number(a), a == 0 do ?b" },
    ],
  },

  // 12) negative coefficients
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(-2, x), mul(5, x))",
    expected: "mul(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 13) constants + like terms: 2x + x + 7
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(2, x), x, 7)",
    expected: "sum(mul(3, x), 7)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) where is_mul_num_sym(a), is_symbol(b), sym_of(a) == b do sum(mul(sum(num_of(a), 1), b), ?c)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 14) x + x + x (3-arity)
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, x, x)",
    expected: "mul(3, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) where is_symbol(a), is_symbol(b), is_symbol(c), a == b, b == c do mul(3, ?a)" },
    ],
  },

  // 15) 5x + 10x + 0
  {
    kind: "sample",
    gen: 1,
    sample: "sum(mul(5, x), mul(10, x), 0)",
    expected: "mul(15, x)",
    steps: [
      { verb: "simplify", body: "sum(?a, ?b, ?c) where is_number(c), c == 0 do sum(?a, ?b)" },
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 16) constant folding inside larger: (1+2)+x
  {
    kind: "sample",
    gen: 1,
    sample: "sum(sum(1, 2), x)",
    expected: "sum(3, x)",
    steps: [
      { verb: "evaluate", body: "sum(?a, ?b) where is_sum(a), is_symbol(b) do sum(eval(?a), ?b)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 17) x + (2+3)
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, sum(2, 3))",
    expected: "sum(5, x)",
    steps: [
      { verb: "evaluate", body: "sum(?a, ?b) where is_symbol(a), is_sum(b) do sum(?a, eval(?b))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "reorder", body: "sum(?a, ?b) where is_symbol(a), is_number(b) do sum(?b, ?a)" },
    ],
  },

  // 18) y + 2y + 3y
  {
    kind: "sample",
    gen: 1,
    sample: "sum(y, mul(2, y), mul(3, y))",
    expected: "mul(6, y)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b, ?c) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do sum(mul(sum(1, num_of(b)), a), ?c)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 19) x + 5x + 10x again, but nested
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, sum(mul(5, x), mul(10, x)))",
    expected: "mul(16, x)",
    steps: [
      { verb: "collect", body: "sum(?a, ?b) where is_symbol(a), is_sum(b) do sum(?a, eval(?b))" },
      { verb: "collect", body: "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
      { verb: "collect", body: "sum(?a, ?b) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do mul(sum(1, num_of(b)), a)" },
      { verb: "evaluate", body: "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)" },
    ],
  },

  // 20) x + y + 0
  {
    kind: "sample",
    gen: 1,
    sample: "sum(x, y, 0)",
    expected: "sum(x, y)",
    steps: [
      { verb: "simplify", body: "sum(?a, ?b, ?c) where is_number(c), c == 0 do sum(?a, ?b)" },
      { verb: "reorder", body: "sum(?a, ?b) where is_symbol(a), is_symbol(b), a > b do sum(?b, ?a)" },
    ],
  },

  // ---- Generalize checkpoint after GEN 1 variable coverage ----
  {
    kind: "generalize",
    gen: 1,
    verb: "collect",
    examples: [
      "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)",
      "sum(?a, ?b) where is_mul_num_sym(a), is_mul_num_sym(b), sym_of(a) == sym_of(b) do mul(sum(num_of(a), num_of(b)), sym_of(a))",
      "sum(?a, ?b) where is_symbol(a), is_mul_num_sym(b), sym_of(b) == a do mul(sum(1, num_of(b)), ?a)",
    ],
    expected: [
      // gen=1 still forbids varargs; expected: unify patterns + maybe introduce a 3-arity “like-term fold”
      "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)",
      "sum(?a, ?b) where is_like_term_pair(a, b) do mul(sum(coeff(a), coeff(b)), sym_of_like(a))",
    ],
    notes: [
      "At gen=1, do not introduce ?args.... You may introduce helper predicates like is_like_term_pair/coeff/sym_of_like if your system supports them.",
      "At gen=2 (later), the expected next step is lifting select([..]) to select(?args, ..) + varargs.",
    ],
  },
];