import { AstNode } from "../ast";
import { LlmClient, Orchestrator } from "../orchestrator";
import { parse, parseEquation } from "../parser";
import { Goal } from "./plannercore";
import { requestGeneralize } from "./traingeneralize";
import { Verb, VerbKind } from "./verb";

// 3.2 Training set
const trainingProblems = [
  // Basic x + c = 0 (tests move addend, discharge isolated)
  "eq(sum(x, 7), 0)",

  // Simple kx + c = 0 (tests move addend, divide both sides, discharge)
  "eq(sum(mul(2, x), 4), 0)",
  "eq(sum(mul(3, x), 9), 0)",

  // Combining like terms (3x + 2x + 5 = 0 => 5x + 5 = 0)
  "eq(sum(mul(3, x), mul(2, x), 5), 0)",

  // Equation normalization (a = b => a - b = 0)
  "eq(sum(x, 3), 5)",
  "eq(mul(2, x), 10)",

  // Subtraction to sum conversion
  "eq(sub(x, 5), 0)",
  "eq(sub(mul(3, x), 6), 0)",

  // Simplification cases
  "eq(sum(x, 0, 7), 0)",  // Dropping zeros
  "eq(sum(mul(2, x), 3, 2), 0)",  // Combining numbers (3 + 2)
  "eq(neg(neg(sum(x, 5))), 0)",  // Double negation

  // Equation symmetry (variable on right side)
  "eq(0, sum(x, 4))",
  "eq(8, mul(2, x))",

  // Grouping same terms with more complex expressions
  "eq(sum(mul(2, x), mul(3, x), mul(4, x), 9), 0)",

  // Factoring common divisor from constants
  "eq(sum(mul(2, x), 6, 4), 0)",  // 2x + 6 + 4 = 0 => 2x + 10 = 0
];

// Generate reasonable focus candidates for equations: root + lhs subtree
function defaultFocusCandidates(expr: AstNode): number[][] {
  // root
  const focuses: number[][] = [[]];
  // if expr is eq(lhs, rhs) then lhs is child 0 in your AST
  focuses.push([0]);
  return focuses;
}

// A small "verification set" used to test LLM proposals.
// In practice: include random linear combos and a few edge cases.
function makeVerifySet(): AstNode[] {
  return [
    parse("eq(sum(x, 7), 0)"),
    parse("eq(sum(mul(2, x), 4), 0)"),
    parse("eq(sum(mul(3, x), 9), 0)"),
    parse("eq(sum(mul(5, x), 1), 0)"),
    parse("eq(sum(mul(2, x), mul(3, x), 5), 0)"),
    parse("eq(sum(mul(7, x), 4), 2)"),
    parse("eq(sub(x, 3), 0)"),
    parse("eq(mul(4, x), 12)"),
    parse("eq(0, sum(x, 5))"),
    parse("eq(sum(x, 0, 6), 0)"),
  ];
}

async function trainVerb(orchestrator: Orchestrator<Verb>, expr: string, verbKind: VerbKind, match: string): Promise<void> {

  console.log("=== TRAINING ===");
  for (const p of trainingProblems) {
    const expr = parseEquation(p);
    const goal: Goal = { kind: "solve_for", sym: "x" };
    const focusCandidates = defaultFocusCandidates(expr);

    const verifySet = makeVerifySet();
    const out = await orchestrator.solveOne({
      expr,
      goal,
      focusCandidates,
      testSetForVerify: verifySet,
    });

    console.log("problem:", p);
    console.log("result:", out.result);
    console.log("traceId:", out.trace.traceId, "success:", out.trace.success);
    console.log("steps:", out.trace.steps.length);
    console.log("---");
  }
}

export async function trainVerbs(orchestrator: Orchestrator<Verb>, llmClient: LlmClient): Promise<void> {
  await trainSumVerb(orchestrator, llmClient);
}

export async function trainSumVerb(orchestrator: Orchestrator<Verb>, llmClient: LlmClient): Promise<void> {
  // ============================================================
  // BLOCK 1: evaluate (SEED, no varargs)
  // ============================================================

  trainVerb(
    orchestrator,
    "sum(1, 1)",
    "evaluate",
    "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)"
  );

  trainVerb(
    orchestrator,
    "sum(1, 2, 3)",
    "evaluate",
    "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)"
  );

  // ---- Generalize checkpoint ----
  await requestGeneralize(
    llmClient,
    "evaluate",
    [
      "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
      "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
    ],
  );

  // ============================================================
  // BLOCK 2: collect constants into one sub-sum (SEED, arity-3 only)
  // Required output shape: sum(sum(.), ^...)
  // ============================================================

  trainVerb(
    orchestrator,
    "sum(1, 2, x)",
    "collect",
    "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)"
  );

  trainVerb(
    orchestrator,
    "sum(1, x, 2)",
    "collect",
    "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)"
  );

  trainVerb(
    orchestrator,
    "sum(x, 1, 2)",
    "collect",
    "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)"
  );

  // Optional guards if you want them in the statement itself:
  trainVerb(
    orchestrator,
    "sum(1, x, y)", // teaches “don’t collect if <2 constants”
    "check",
    "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); len(.) < 2"
  );

  // ---- Generalize checkpoint ----
  requestGeneralize(
    llmClient,
    "collect",
    [
      "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)",
    ],
  );
}