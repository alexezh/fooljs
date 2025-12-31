import { AstNode } from "../ast.js";
import { LlmClient, Orchestrator } from "../orchestrator.js";
import { parse, parseEquation } from "../parser.js";
import { Goal } from "./plannercore.js";
import { requestGeneralize } from "./traingeneralize.js";
import { Verb, VerbKind } from "./verb.js";

// Training result interface (per train.md spec)
export interface TrainVerbResult {
  decisionFound: boolean;
  predictedVerb?: VerbKind;
  expectedVerb: VerbKind;
  success: boolean;
  traceId: string;
  exprStr: string;
  reason?: string;
}

// Evaluation report interface (per train.md spec)
export interface BlockReport {
  blockId: string;
  trainedExamples: number;
  decisionFoundRate: number;
  verbAccuracy?: number;
  semanticPassRate?: number;
  failures: Array<{ exprStr: string; reason: string }>;
}

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

async function trainVerb(
  orchestrator: Orchestrator<Verb>,
  exprStr: string,
  verbKind: VerbKind,
  match: string
): Promise<TrainVerbResult> {
  const expr = parseEquation(exprStr);

  // Use appropriate goal: simplify/eval for sum, solve_for(x) for equations
  const goal: Goal = exprStr.includes("eq(")
    ? { kind: "solve_for", sym: "x" }
    : { kind: "simplify" };

  const focusCandidates = defaultFocusCandidates(expr);
  const verifySet = makeVerifySet();

  try {
    const out = await orchestrator.solveOne({
      expr,
      goal,
      focusCandidates,
      testSetForVerify: verifySet,
    });

    // Locate first decision point where:
    // - focused node matches the statement's match
    // - statement where holds
    // TODO: Implement actual decision point detection
    const decisionFound = out.trace.steps.length > 0;

    // TODO: Get predictedVerb from policy before update
    const predictedVerb: VerbKind | undefined = undefined;

    // TODO: Perform online update to verb policy using supervision
    // expectedVerb = verbKind (passed in)

    console.log("trainVerb:", exprStr, "->", verbKind);
    console.log("  result:", out.result);
    console.log("  traceId:", out.trace.traceId, "success:", out.trace.success);
    console.log("  steps:", out.trace.steps.length);

    return {
      decisionFound,
      predictedVerb,
      expectedVerb: verbKind,
      success: out.trace.success,
      traceId: out.trace.traceId,
      exprStr,
    };
  } catch (error) {
    console.error("trainVerb error:", exprStr, error);
    return {
      decisionFound: false,
      expectedVerb: verbKind,
      success: false,
      traceId: "error",
      exprStr,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Evaluate policy on verify set after a training block
 * Per train.md spec section 2
 */
async function evalSumBlock(
  orchestrator: Orchestrator<Verb>,
  blockId: string,
  verifySet: Array<{ exprStr: string; expectedVerb: VerbKind }>,
  trainedCount: number
): Promise<BlockReport> {
  const failures: Array<{ exprStr: string; reason: string }> = [];
  let decisionFoundCount = 0;
  let verbCorrectCount = 0;
  let semanticPassCount = 0;

  for (const item of verifySet) {
    try {
      const expr = parse(item.exprStr);
      const goal: Goal = { kind: "simplify" };
      const focusCandidates = defaultFocusCandidates(expr);

      const out = await orchestrator.solveOne({
        expr,
        goal,
        focusCandidates,
        testSetForVerify: [],
      });

      // A) Verb-choice accuracy
      // TODO: Extract predictedVerb from decision point
      const decisionFound = out.trace.steps.length > 0;
      if (decisionFound) {
        decisionFoundCount++;
        // TODO: Compare predictedVerb with expectedVerb
        // For now, assume it matches if successful
        if (out.trace.success) {
          verbCorrectCount++;
        }
      }

      // B) Semantic effect checks
      if (item.expectedVerb === "evaluate") {
        // Output should be numeric or fully reduced
        const isNumeric = out.result?.kind === "number";
        if (isNumeric) {
          semanticPassCount++;
        } else {
          failures.push({
            exprStr: item.exprStr,
            reason: "evaluate: output not numeric",
          });
        }
      } else if (item.expectedVerb === "collect") {
        // TODO: Check that numeric leaves decreased and terms preserved
        semanticPassCount++;
      } else {
        // Other verbs - basic success check
        if (out.trace.success) {
          semanticPassCount++;
        }
      }
    } catch (error) {
      failures.push({
        exprStr: item.exprStr,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const decisionFoundRate =
    verifySet.length > 0 ? decisionFoundCount / verifySet.length : 0;
  const verbAccuracy =
    decisionFoundCount > 0 ? verbCorrectCount / decisionFoundCount : undefined;
  const semanticPassRate =
    verifySet.length > 0 ? semanticPassCount / verifySet.length : 0;

  const report: BlockReport = {
    blockId,
    trainedExamples: trainedCount,
    decisionFoundRate,
    verbAccuracy,
    semanticPassRate,
    failures,
  };

  console.log(`\n=== Block ${blockId} Evaluation ===`);
  console.log(`  Trained examples: ${trainedCount}`);
  console.log(`  Decision found rate: ${(decisionFoundRate * 100).toFixed(1)}%`);
  console.log(
    `  Verb accuracy: ${verbAccuracy !== undefined ? (verbAccuracy * 100).toFixed(1) + "%" : "N/A"}`
  );
  console.log(`  Semantic pass rate: ${(semanticPassRate * 100).toFixed(1)}%`);
  console.log(`  Failures: ${failures.length}`);

  return report;
}

/**
 * Accept generalized statements based on evaluation
 * Per train.md spec section 3 & 4
 */
async function acceptGeneralizations(
  orchestrator: Orchestrator<Verb>,
  generalized: string[],
  verifySet: Array<{ exprStr: string; expectedVerb: VerbKind }>,
  baselineReport: BlockReport
): Promise<string[]> {
  const accepted: string[] = [];
  const rejected: Array<{ stmt: string; reason: string }> = [];

  for (const stmt of generalized) {
    try {
      // 1. Parse statement
      const stmtAst = parse(stmt);

      // 2. Validate constraints
      // TODO: Check for varargs, allowed constructs
      const hasVarargs = stmt.includes("...");
      if (hasVarargs) {
        rejected.push({ stmt, reason: "varargs not permitted in this phase" });
        continue;
      }

      // 3. Dry-run evaluation
      // TODO: Temporarily add statement to orchestrator
      // TODO: Run verify set with this statement
      // TODO: Check if metrics improve or maintain

      // For now, accept if it parses correctly
      accepted.push(stmt);
    } catch (error) {
      rejected.push({
        stmt,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`\n=== Generalization Filter ===`);
  console.log(`  Candidates: ${generalized.length}`);
  console.log(`  Accepted: ${accepted.length}`);
  console.log(`  Rejected: ${rejected.length}`);
  if (rejected.length > 0) {
    console.log(`  Rejection reasons:`);
    rejected.forEach((r) => console.log(`    - ${r.reason}: ${r.stmt}`));
  }

  return accepted;
}

export async function trainVerbs(orchestrator: Orchestrator<Verb>, llmClient: LlmClient): Promise<void> {
  await trainSumVerb(orchestrator, llmClient);
}

export async function trainSumVerb(
  orchestrator: Orchestrator<Verb>,
  llmClient: LlmClient
): Promise<void> {
  // Verify set for evaluation
  const verifySet: Array<{ exprStr: string; expectedVerb: VerbKind }> = [
    { exprStr: "sum(1, 1)", expectedVerb: "evaluate" },
    { exprStr: "sum(2, 3)", expectedVerb: "evaluate" },
    { exprStr: "sum(5, 7, 2)", expectedVerb: "evaluate" },
    { exprStr: "sum(1, 2, x)", expectedVerb: "collect" },
    { exprStr: "sum(x, 3, 4)", expectedVerb: "collect" },
    { exprStr: "sum(1, x, y)", expectedVerb: "check" },
  ];

  // ============================================================
  // BLOCK 1: evaluate (SEED, no varargs)
  // ============================================================
  console.log("\n=== BLOCK 1: evaluate (SEED) ===");

  const seedStmts1 = [
    "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
    "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
  ];

  // Seed training (sequential with await)
  const results1: TrainVerbResult[] = [];
  results1.push(
    await trainVerb(orchestrator, "sum(1, 1)", "evaluate", seedStmts1[0])
  );
  results1.push(
    await trainVerb(orchestrator, "sum(1, 2, 3)", "evaluate", seedStmts1[1])
  );

  // Evaluate policy after seeds
  const report1 = await evalSumBlock(
    orchestrator,
    "block1-evaluate",
    verifySet.filter((v) => v.expectedVerb === "evaluate"),
    results1.length
  );

  // Generalize based on seed statements
  const gen1 = await requestGeneralize(llmClient, "evaluate", seedStmts1);

  // Filter candidates using eval + constraints
  const accepted1 = await acceptGeneralizations(
    orchestrator,
    gen1.generalized || [],
    verifySet.filter((v) => v.expectedVerb === "evaluate"),
    report1
  );

  // Train on accepted generalizations
  for (const stmt of accepted1) {
    // TODO: pickExprFor(stmt) - auto-generate expression consistent with stmt.match
    console.log("Would train on generalized statement:", stmt);
  }

  // ============================================================
  // BLOCK 2: collect constants into one sub-sum (SEED, arity-3 only)
  // Required output shape: sum(sum(.), ^...)
  // ============================================================
  console.log("\n=== BLOCK 2: collect (SEED) ===");

  const seedStmts2 = [
    "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); sum(sum(.), ^...)",
  ];

  // Seed training (sequential with await)
  const results2: TrainVerbResult[] = [];
  results2.push(
    await trainVerb(orchestrator, "sum(1, 2, x)", "collect", seedStmts2[0])
  );
  results2.push(
    await trainVerb(orchestrator, "sum(1, x, 2)", "collect", seedStmts2[0])
  );
  results2.push(
    await trainVerb(orchestrator, "sum(x, 1, 2)", "collect", seedStmts2[0])
  );

  // Optional guards
  results2.push(
    await trainVerb(
      orchestrator,
      "sum(1, x, y)",
      "check",
      "sum(?a, ?b, ?c) do select([?a, ?b, ?c], is_number); len(.) < 2"
    )
  );

  // Evaluate policy after seeds
  const report2 = await evalSumBlock(
    orchestrator,
    "block2-collect",
    verifySet.filter((v) => v.expectedVerb === "collect" || v.expectedVerb === "check"),
    results2.length
  );

  // Generalize
  const gen2 = await requestGeneralize(llmClient, "collect", seedStmts2);

  // Filter candidates
  const accepted2 = await acceptGeneralizations(
    orchestrator,
    gen2.generalized || [],
    verifySet.filter((v) => v.expectedVerb === "collect"),
    report2
  );

  // Train on accepted generalizations
  for (const stmt of accepted2) {
    console.log("Would train on generalized statement:", stmt);
  }

  console.log("\n=== trainSumVerb completed ===");
}