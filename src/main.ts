import { AstNode, ASymbol } from "./ast.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, LlmClient, Orchestrator, SkillExecutor, SkillRegistry, SymbolicVerifier } from "./orchestrator.js";
import { parse } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { aStarSearch, getSolutionString } from "./search.js";

function parseEquation(s: string): AstNode {
  let ast = parse(s);
  if (ast.kind === 'eq' && ast.value === 'eq') {
    ast = AstNode.create('func', 'solve', [
      ast,
      AstNode.create('func', 'solved_for', [
        AstNode.create('symbol', new ASymbol('x'))
      ])
    ]);
  }

  return ast;
}

function main_search(): void {
  //const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';
  //const exprStr = '7x + 2x^2 – 14 + 3x^2 = x – 2'
  const exprStr = '7x + 2 = 3'
  //const exprStr = '7x^2 - 2 = 0'

  initRules(RuntimeImpl.instance);
  //initStates(Runtime.instance);
  let ast = parseEquation(exprStr);

  const res = aStarSearch(ast);
  if (res) {
    const solStr = getSolutionString(res);
  }

  //const match = Runtime.instance.matchRule(ast);
  //console.log(match?.length);
}

// Example: Orchestrator usage end-to-end for your curriculum
//
// Assumes you already have:
// - runtime: Runtime (AST + rules + matcher + equivalence + goalMet)
// - a working Policy implementation (even a dumb one to start)
// - a SkillRegistry preloaded with a few safe baseline skills
//

// ----------------------------
// 0) Helpers: parsing expressions & focus candidates
// ----------------------------

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

// ----------------------------
// 1) Bootstrapping: baseline skills in registry
// ----------------------------

function seedBaselineSkills(registry: SkillRegistry) {
  // IMPORTANT: These "skills" are wrappers around rule IDs you already have.
  // Store ruleId references rather than raw rule strings for safety.

  registry.add({
    id: "NormalizeEq",
    name: "Normalize equation to zero-form",
    payload: {
      kind: "macro_action",
      steps: [{ ruleId: "ruleEqNormalize" }],
      budget: 1,
    },
    tags: ["eq", "normalize"],
  });

  registry.add({
    id: "SimplifyLocal",
    name: "Local simplification pass (bounded)",
    payload: {
      kind: "macro_action",
      steps: [
        { ruleId: "ruleParenRemove" },
        { ruleId: "ruleDoubleNeg" },
        { ruleId: "ruleNegZero" },
        { ruleId: "ruleNeutralRight" },
        { ruleId: "ruleCombineNumbers" },
        { ruleId: "ruleCombineLikeTerms" }
      ],
      budget: 12,
    },
    tags: ["simplify"],
  });

  registry.add({
    id: "SolveLinearZeroForm",
    name: "Solve kx + c = 0  (schema)",
    payload: {
      kind: "macro_action",
      // In your ruleset, this might be one rule (ruleSolveLinear) after normalization.
      steps: [{ ruleId: "ruleSolveLinear" }],
      budget: 1,
    },
    tags: ["solve", "linear"],
  });
}

// ----------------------------
// 2) Policy (placeholder)
// ----------------------------
// Dumb policy for testing - just tries skills in order

class DumbPolicy {
  private stepCount = 0;

  // Simple rank implementation - just returns candidates in order
  rank(candidates: any[], _featuresByCandidate: Map<string, any>): any[] {
    return candidates.map((c, i) => ({ ...c, score: candidates.length - i }));
  }

  chooseAction({ root, goal, focusCandidates, availableSkills }: any) {
    console.log(`\n[DumbPolicy] Step ${this.stepCount}, Available skills:`, availableSkills.map((s: any) => s.id));

    const has = (id: string) => availableSkills.some((s: any) => s.id === id);

    // Simple strategy: try each skill in sequence
    if (goal.kind === "solve_for") {
      // First try normalizing
      if (this.stepCount === 0 && has("NormalizeEq")) {
        console.log(`[DumbPolicy] Choosing NormalizeEq at root`);
        return { skillId: "NormalizeEq", focus: [] };
      }

      // Then try simplifying
      if (this.stepCount === 1 && has("SimplifyLocal")) {
        console.log(`[DumbPolicy] Choosing SimplifyLocal at focus [0]`);
        return { skillId: "SimplifyLocal", focus: [0] };
      }

      // Finally try solving
      if (this.stepCount >= 2 && has("SolveLinearZeroForm")) {
        console.log(`[DumbPolicy] Choosing SolveLinearZeroForm at root`);
        return { skillId: "SolveLinearZeroForm", focus: [] };
      }
    }

    // Fallback: first available skill
    const first = availableSkills[0];
    if (first) {
      console.log(`[DumbPolicy] Fallback: choosing first skill ${first.id}`);
      return { skillId: first.id, focus: focusCandidates[0] ?? [] };
    }

    console.log(`[DumbPolicy] No skills available, giving up`);
    return null;
  }

  observe(evt: any) {
    this.stepCount++;
    console.log(`[DumbPolicy] Observed: reward=${evt.reward}, success=${evt.success}`);
  }
}

const dumbPolicy = new DumbPolicy();

// ----------------------------
// 3) Main: construct orchestrator + run curriculum
// ----------------------------

// ----------------------------
// 4) Simple test without LLM
// ----------------------------

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
  seedBaselineSkills(registry);

  console.log("=== SKILLS IN REGISTRY ===");
  for (const s of registry.list()) {
    console.log(`  ${s.id} (${s.payload.kind}) - ${s.name}`);
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

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama();

  const proposer = new AbstractionProposer(llm);
  const verifier = new SymbolicVerifier(runtime);

  const registry = new SkillRegistry();
  seedBaselineSkills(registry);

  const executor = new SkillExecutor(runtime, registry);

  const orchestrator = new Orchestrator(
    runtime,
    registry,
    dumbPolicy,      // swap for your RL policy
    proposer,
    verifier,
    executor,
    {
      maxSteps: 30,
      focusLimit: 10,
      proposeEveryNSuccesses: 3, // after 3 successful solves, ask LLM for abstractions
      maxProposals: 3,
    }
  );

  const verifySet = makeVerifySet();

  // 3.2 Training set
  const trainingProblems = [
    "eq(sum(x, 7), 0)",
    "eq(sum(mul(2, x), 4), 0)",
    "eq(sum(mul(3, x), 9), 0)",
    "eq(sum(mul(3, x), mul(2, x), 5), 0)",
  ];

  console.log("=== TRAINING ===");
  for (const p of trainingProblems) {
    const expr = parse(p);
    const goal: Goal = { kind: "solve_for", x: "x" };
    const focusCandidates = defaultFocusCandidates(expr);

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

  // 3.3 Final harder problem
  const finalProblem = "eq(sum(mul(2, x), mul(3, x), 4, mul(4, x), 2), 2)";

  console.log("=== FINAL ===");
  const finalExpr = parse(finalProblem);
  const finalOut = await orchestrator.solveOne({
    expr: finalExpr,
    goal: { kind: "solve_for", x: "x" },
    focusCandidates: defaultFocusCandidates(finalExpr),
    testSetForVerify: verifySet,
  });

  console.log("problem:", finalProblem);
  console.log("final result:", finalOut.result);
  console.log("trace success:", finalOut.trace.success);
  console.log("trace JSON:", JSON.stringify(finalOut.trace, null, 2));

  // Inspect what new skills were accepted
  console.log("=== SKILLS IN REGISTRY ===");
  for (const s of registry.list()) {
    console.log(`${s.id} (${s.payload.kind}) - ${s.name}`);
  }
}

// Run basic tests (no LLM required)
//await testBasicOrchestrator();

// Uncomment to run full orchestrator with LLM
await main(RuntimeImpl.instance);