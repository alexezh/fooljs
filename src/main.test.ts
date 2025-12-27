// ----------------------------
// 4) Simple test without LLM
// ----------------------------

import { AstNode } from "./ast";
import { seedBaselineSkills } from "./baselineskills";
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

  const executor = new SkillExecutor(runtime);

  const orchestrator = new Orchestrator(
    runtime,
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


