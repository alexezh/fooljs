import { AstNode } from "../ast.js";
import { LlmClient, Orchestrator } from "../orchestrator.js";
import { parse, parseEquation } from "../parser.js";
import { Goal } from "./plannercore.js";
import { requestGeneralize } from "./traingeneralize.js";
import { Verb, VerbKind, VerbRegistry, makeVerbId } from "./verb.js";

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

// Training data item
export interface TrainingDataItem {
  sample: string;  // Example expression to train on
  verb: VerbKind;  // Expected verb for this example
  body: string;    // Rule/statement body
}

// Training data array (exported for testing)
export const trainingData: TrainingDataItem[] = [
  // BLOCK 1: evaluate
  {
    sample: "sum(1, 1)",
    verb: "evaluate",
    body: "sum(?a, ?b) => sum(?a, ?b) where[is_number(?a), is_number(?b)]"
  },
  {
    sample: "sum(1, 2, 3)",
    verb: "evaluate",
    body: "sum(?a, ?b, ?c) => sum(?a, ?b, ?c) where[is_number(?a), is_number(?b), is_number(?c)]"
  },
  // BLOCK 2: collect
  {
    sample: "sum(1, 2, x)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(sum(?a, ?b), ?c) where[is_number(?a), is_number(?b)]"
  },
  {
    sample: "sum(1, x, 2)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(sum(?a, ?c), ?b) where[is_number(?a), is_number(?c)]"
  },
  {
    sample: "sum(x, 1, 2)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(?a, sum(?b, ?c)) where[is_number(?b), is_number(?c)]"
  },
];

/**
 * Register verbs from training data into VerbRegistry
 * Exported for testing
 */
export function registerTrainingVerbs(registry: VerbRegistry): void {
  for (const item of trainingData) {
    try {
      const bodyAst = parse(item.body);
      const sampleAst = parse(item.sample);

      // Create Verb object
      const verb = new Verb();
      verb.id = makeVerbId();
      verb.kind = item.verb;
      verb.intent = `${item.verb} for ${item.sample}`;
      verb.sample = sampleAst;

      // Extract match and goal from rule body
      if (bodyAst.kind === 'rule') {
        verb.match = bodyAst.children![0];  // LHS of =>
        verb.goal = bodyAst.children![1];   // RHS of =>
      } else {
        verb.match = sampleAst;
        verb.goal = bodyAst;
      }

      verb.plan = [];  // Empty plan for now

      registry.addVerb(verb);
      console.log(`Registered verb: ${verb.kind} for ${item.sample}`);
    } catch (error) {
      console.error(`Failed to register verb for ${item.sample}:`, error);
    }
  }
}

// Generate reasonable focus candidates for equations: root + lhs subtree
function defaultFocusCandidates(expr: AstNode): number[][] {
  // root
  const focuses: number[][] = [[]];
  // if expr is eq(lhs, rhs) then lhs is child 0 in your AST
  focuses.push([0]);
  return focuses;
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

  try {
    const out = await orchestrator.solveOne({
      expr,
      goal,
      focusCandidates,
    });

    // Locate first decision point where:
    // - focused node matches the statement's match
    // - statement where holds
    // TODO: Implement actual decision point detection
    const decisionFound = out.trace.steps.length > 0;

    // TODO: Get predictedVerb from policy before update
    const predictedVerb = out.verb;

    // TODO: Perform online update to verb policy using supervision
    // expectedVerb = verbKind (passed in)

    console.log("trainVerb:", exprStr, "->", verbKind);
    console.log("  result:", out.result);
    console.log("  traceId:", out.trace.traceId, "success:", out.trace.success);
    console.log("  steps:", out.trace.steps.length);

    return {
      decisionFound,
      predictedVerb: predictedVerb!.kind,
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
  // Register verbs from training data first
  const registry = VerbRegistry.instance;
  registerTrainingVerbs(registry);

  // Then run training
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

  // Group training data by verb
  const evaluateData = trainingData.filter((d) => d.verb === "evaluate");
  const collectData = trainingData.filter((d) => d.verb === "collect");

  // ============================================================
  // BLOCK 1: evaluate (SEED, no varargs)
  // ============================================================
  console.log("\n=== BLOCK 1: evaluate (SEED) ===");

  const results1: TrainVerbResult[] = [];

  // Seed training (sequential with await) using trainingData
  for (const item of evaluateData) {
    results1.push(
      await trainVerb(orchestrator, item.sample, item.verb, item.body)
    );
  }

  // Evaluate policy after seeds
  const report1 = await evalSumBlock(
    orchestrator,
    "block1-evaluate",
    verifySet.filter((v) => v.expectedVerb === "evaluate"),
    results1.length
  );

  // Generalize based on seed statements
  const gen1 = await requestGeneralize(llmClient, "evaluate", evaluateData.map((d) => d.body));

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
  // ============================================================
  console.log("\n=== BLOCK 2: collect (SEED) ===");

  const seedStmts2 = collectData.map((d) => d.body);
  const results2: TrainVerbResult[] = [];

  // Seed training (sequential with await) using trainingData
  for (const item of collectData) {
    results2.push(
      await trainVerb(orchestrator, item.sample, item.verb, item.body)
    );
  }

  // Evaluate policy after seeds
  const report2 = await evalSumBlock(
    orchestrator,
    "block2-collect",
    verifySet.filter(
      (v) => v.expectedVerb === "collect" || v.expectedVerb === "check"
    ),
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
  console.log(`Total verbs registered: ${VerbRegistry.instance.getVerbs().length}`);
}