// ----------------------------
// 4) Simple test without LLM
// ----------------------------

import { AstNode } from "./ast";
import { DumbPolicy } from "./dumbpolicy";
import { LlmClient } from "./llmclient.js";
import { AbstractionProposer, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse, parseEquation } from "./parser";
import { Goal } from "./planner/plannercore";
import { initRules } from "./ruletable.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { SkillExecutor } from "./skillexecutor.js";
import { SkillRegistry } from "./skillregistry.js";

const dumbPolicy = new DumbPolicy();

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
  ];
}

async function testBasicOrchestrator() {
  console.log("======================================================================");
  console.log("BASIC ORCHESTRATOR TESTS (without LLM)");
  console.log("======================================================================\n");

  const runtime = RuntimeImpl.instance;
  initRules(runtime);

  // Create a minimal LLM client that doesn't actually call anything
  const mockLlm: LlmClient = {
    async chat(_messages, _opts) {
      // Don't actually call LLM in basic test
      return { content: '{"proposals": []}' };
    }
  };

  const proposer = new AbstractionProposer(mockLlm);
  const verifier = new SymbolicVerifier(runtime);

  const registry = new SkillRegistry();
  await seedBaselineSkills(registry);

  console.log("=== SKILLS IN REGISTRY ===");
  for (const s of registry.list()) {
    console.log(`  ${s.id} (${s.payload.kind}) - ${s.name} `);
  }
  console.log();

  const executor = new SkillExecutor(runtime, registry);

  const orchestrator = new Orchestrator(
    runtime,
    registry,
    dumbPolicy,
    proposer,
    verifier,
    executor,
    {
      maxSteps: 10,
      focusLimit: 10,
      proposeEveryNSuccesses: 999, // disable LLM proposals for testing
      maxProposals: 0,
    }
  );

  const verifySet = makeVerifySet();

  // Test 1: Simple equation
  console.log("=== TEST 1: Simple linear equation ===");
  const problem1 = "eq(sum(x, 7), 0)";
  console.log("Problem:", problem1);

  const expr1 = parse(problem1);
  const goal1: Goal = { kind: "solve_for", x: "x" };
  const focusCandidates1 = defaultFocusCandidates(expr1);

  try {
    const out1 = await orchestrator.solveOne({
      expr: expr1,
      goal: goal1,
      focusCandidates: focusCandidates1,
      testSetForVerify: verifySet,
    });

    console.log("\nResult:", out1.result?.toString());
    console.log("Success:", out1.trace.success);
    console.log("Steps taken:", out1.trace.steps.length);
    console.log("---\n");
  } catch (e: any) {
    console.error("Error:", e.message);
    console.log("---\n");
  }

  // Test 2: Runtime methods
  console.log("=== TEST 2: Runtime method tests ===");

  const testExpr = parse("sum(mul(2, x), 3)");
  console.log("Test expression:", testExpr.toString());

  // Test getAt / setAt
  console.log("\nTest getAt/setAt:");
  const child0 = runtime.getAt(testExpr, [0]);
  console.log("  getAt([0]):", child0.toString(), "✓");

  const newExpr = runtime.setAt(testExpr, [1], parse("5"));
  console.log("  setAt([1], 5):", newExpr.toString(), "✓");

  // Test walk
  console.log("\nTest walk:");
  let nodeCount = 0;
  runtime.walk(testExpr, () => nodeCount++);
  console.log("  Node count:", nodeCount, "✓");

  // Test matches
  console.log("\nTest matches:");
  const matches1 = runtime.matches("sum(?a, ?b)", testExpr);
  console.log("  matches('sum(?a, ?b)'):", matches1, "✓");

  // Test evaluation
  console.log("\nTest evaluation:");
  const env = { x: 5 };
  const value = runtime.evalWithEnv!(testExpr, env);
  console.log("  eval with x=5:", value, "(expected: 13)", value === 13 ? "✓" : "✗");

  // Test equivalence
  console.log("\nTest equivalence:");
  const eq1 = parse("sum(x, 3)");
  const eq2 = parse("sum(3, x)");
  const equiv = runtime.equivalent(eq1, eq2);
  console.log("  sum(x, 3) ≡ sum(3, x):", equiv, equiv ? "✓" : "✗");

  console.log("\n======================================================================");
  console.log("BASIC TESTS COMPLETED");
  console.log("======================================================================");
}

// ----------------------------
// 5) Training problems test
// ----------------------------

async function testTrainingProblems() {
  console.log("\n======================================================================");
  console.log("TRAINING PROBLEMS TEST");
  console.log("======================================================================\n");

  const runtime = RuntimeImpl.instance;
  initRules(runtime);

  const trainingProblems = [
    { input: "eq(sum(x, 7), 0)", expected: "eq(x, neg(7))" },
    { input: "eq(sum(mul(2, x), 4), 0)", expected: "eq(x, div(neg(4), 2))" },
    { input: "eq(sum(mul(3, x), 9), 0)", expected: "eq(x, div(neg(9), 3))" },
    { input: "eq(sum(mul(3, x), mul(2, x), 5), 0)", expected: "eq(x, ...)" }, // more complex
  ];

  for (let i = 0; i < trainingProblems.length; i++) {
    const { input, expected } = trainingProblems[i];
    console.log(`\n === Problem ${i + 1}: ${input} === `);
    console.log(`Expected form: ${expected} `);

    const rawExpr = parse(input);
    console.log(`Shape:        ${rawExpr.toShapeString()} \n`);

    const expr = parseEquation(input);
    console.log("Parsed:", expr.toString());

    // Try to find matching rules
    const matches = runtime.matchRule(expr);
    console.log(`Found ${matches.length} matching rules`);

    if (matches.length > 0) {
      // Show first few matches
      for (let j = 0; j < Math.min(3, matches.length); j++) {
        const match = matches[j];
        console.log(`  ${j + 1}. ${match.ruleDef?.slice(0, 60)}...`);
        console.log(`     Result: ${match.replace.toString()} `);
      }
    }

    // Try to solve step by step
    let current = expr;
    let steps = 0;
    const maxSteps = 10;

    console.log("\nSolving step by step:");
    while (steps < maxSteps) {
      console.log(`  Step ${steps}: ${current.toString()} `);

      // Check if solved
      const goal = { kind: "solve_for" as const, x: "x" };
      if (runtime.goalMet(current, goal)) {
        console.log(`  ✓ SOLVED!`);
        break;
      }

      // Try to apply a rule
      const ruleMatches = runtime.matchRule(current);
      if (ruleMatches.length === 0) {
        console.log(`  ✗ No more rules match`);
        break;
      }

      // Apply first rule that changes something
      // Prefer direct solve rules over step rules
      let applied = false;

      // First try non-step rules
      for (const match of ruleMatches) {
        if (match.ruleDef?.includes('step(?e)')) continue; // Skip step rules
        if (!runtime.equivalent(current, match.replace)) {
          current = match.replace;
          applied = true;
          console.log(`  → Applied: ${match.ruleDef?.slice(0, 50)}...`);
          break;
        }
      }

      // If no non-step rule applied, try step rules
      if (!applied) {
        for (const match of ruleMatches) {
          if (!runtime.equivalent(current, match.replace)) {
            current = match.replace;
            applied = true;
            console.log(`  → Applied: ${match.ruleDef?.slice(0, 50)}...`);
            break;
          }
        }
      }

      if (!applied) {
        console.log(`  ✗ No rules make progress`);
        break;
      }

      steps++;
    }

    console.log(`\nFinal result: ${current.toString()} `);
    console.log("---");
  }

  console.log("\n======================================================================");
  console.log("TRAINING PROBLEMS TEST COMPLETED");
  console.log("======================================================================");
}
function seedBaselineSkills(registry: SkillRegistry) {
  throw new Error("Function not implemented.");
}

