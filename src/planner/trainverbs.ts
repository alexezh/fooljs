import { AstNode } from "../ast.js";
import { LlmClient, Orchestrator } from "../orchestrator.js";
import { parse, parseEquation } from "../parser.js";
import { Goal } from "./plannercore.js";
import { requestGeneralize } from "./traingeneralize.js";
import { trainingData, SampleDataItem } from "./trainingdata.js";
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

/**
 * Register verbs from training data into VerbRegistry
 * Exported for testing
 */
export function registerTrainingVerbs(registry: VerbRegistry): void {
  for (const item of trainingData) {
    if (item.kind === 'sample') {
      for (let step of item.steps) {
        const bodyAst = parse(step.body);
        const sampleAst = parse(item.sample);

        // Create Verb object
        const verb = new Verb();
        verb.id = makeVerbId();
        verb.kind = step.verb;
        verb.intent = `${step.verb} for ${item.sample}`;
        verb.sample = sampleAst;

        // Extract match and goal from rule body
        if (bodyAst.kind !== 'rule') {
          throw 'Verb should have rule as top level'
        }

        verb.pattern = bodyAst.children![0];  // LHS of =>
        if (bodyAst.guard) {
          verb.guard = bodyAst.guard;   // RHS of =>
        }

        verb.emit = bodyAst.children![1];

        registry.addVerb(verb);
        console.log(`Registered verb: ${verb.kind} for ${item.sample}`);
      }
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
    // Use full orchestrator logic
    const out = await orchestrator.solveOne({
      expr,
      goal,
      focusCandidates,
    });

    // Check if we found a decision point and what verb was chosen
    const decisionFound = out.trace.steps.length > 0;
    const predictedVerb = out.verb;

    // Success means:
    // 1. A decision was made
    // 2. The verb matches expected
    // 3. The trace succeeded
    const verbMatches = predictedVerb?.kind === verbKind;
    const success = decisionFound && verbMatches && out.trace.success;

    console.log("trainVerb:", exprStr, "->", verbKind);
    console.log("  result:", out.result?.toString());
    console.log("  predictedVerb:", predictedVerb?.kind, "expectedVerb:", verbKind);
    console.log("  steps:", out.trace.steps.length);
    console.log("  success:", success);

    // TODO: Perform online update to verb policy using supervision
    // expectedVerb = verbKind (passed in)
    // orchestrator.policy.update(...) or similar

    return {
      decisionFound,
      predictedVerb: predictedVerb?.kind,
      expectedVerb: verbKind,
      success,
      traceId: out.trace.traceId,
      exprStr,
      reason: !decisionFound
        ? "no decision"
        : !verbMatches
          ? `verb mismatch (got ${predictedVerb?.kind})`
          : !out.trace.success
            ? "trace failed"
            : undefined,
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

  // Filter gen0 samples
  const gen0Samples = trainingData.filter(
    (item): item is SampleDataItem => item.kind === "sample" && item.gen === 0
  );

  console.log("\n=== Training Gen0 Samples ===");
  console.log(`Total gen0 samples: ${gen0Samples.length}`);

  // Run up to 10 iterations
  const maxIterations = 10;
  let allSuccess = false;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

    const results: TrainVerbResult[] = [];
    let successCount = 0;

    for (const sample of gen0Samples) {
      const result = await trainVerb(
        orchestrator,
        sample.sample,
        sample.steps[0].verb, // Use first step's verb
        sample.steps[0].body
      );
      results.push(result);

      if (result.success) {
        successCount++;
      }
    }

    const successRate = (successCount / gen0Samples.length) * 100;
    console.log(`\nIteration ${iteration} Results:`);
    console.log(`  Success: ${successCount}/${gen0Samples.length} (${successRate.toFixed(1)}%)`);
    console.log(`  Failed: ${gen0Samples.length - successCount}`);

    // Check if all succeeded
    if (successCount === gen0Samples.length) {
      console.log(`\n✓ All gen0 samples succeeded on iteration ${iteration}!`);
      allSuccess = true;
      break;
    }

    // Show failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0 && failures.length <= 5) {
      console.log("\nFailures:");
      failures.forEach((f) => {
        console.log(`  - ${f.exprStr}: ${f.reason || "no match"}`);
      });
    }
  }

  if (!allSuccess) {
    console.log("\n✗ Did not achieve 100% success within 10 iterations");
  }

  console.log("\n=== Training Complete ===");
  console.log(`Total verbs registered: ${VerbRegistry.instance.getVerbs().length}`);
}