import { AstNode, ASymbol } from "./ast.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, LlmClient, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { aStarSearch, getSolutionString } from "./search.js";
import { SkillDescriptor } from "./skilldescriptor.js";
import { SkillExecutor } from "./skillexecutor.js";
import { SkillRegistry } from "./skillregistry.js";

function parseEquation(s: string): AstNode {
  let ast = parse(s);
  if (ast.kind === 'func' && ast.value === 'eq') {
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

async function seedBaselineSkills(registry: SkillRegistry) {
  // Use serialized AST patterns instead of ruleIds for skill identification
  // These patterns are used for embedding-based lookup

  await registry.add({
    id: "eq(sum(?a, neg(?b)), 0)",
    name: "Normalize equation to zero-form",
    payload: {
      kind: "macro_action",
      steps: [{
        pattern: "eq(?a, ?b)",
        ruleId: "eq_normalize_to_zero_form"
      }],
      budget: 1,
    },
    tags: ["eq", "normalize"],
  });

  await registry.add({
    id: "sum(?simplified...)",
    name: "Local simplification pass (bounded)",
    payload: {
      kind: "macro_action",
      steps: [
        { pattern: "paren(?a)", ruleId: "paren_remove" },
        { pattern: "neg(neg(?a))", ruleId: "neg_double" },
        { pattern: "neg(0)", ruleId: "neg_zero" },
        { pattern: "sum(?args..., 0, ?rest...)", ruleId: "sum_neutral_drop_0" },
        { pattern: "sum(?a, ?b)", ruleId: "calc_sum_numbers" },
        { pattern: "sum(?terms...)", ruleId: "combine_like_terms" }
      ],
      budget: 12,
    },
    tags: ["simplify"],
  });

  await registry.add({
    id: "macro_solve_simple_linear_via_steps",
    name: "Solve ax + c = 0 (generic steps, no special rule)",
    payload: {
      kind: "macro_action",
      budget: 8,
      steps: [
        { pattern: "solve(eq(?lhs, ?rhs), solved_for(?x))", ruleId: "solve_eq_normalize", focus: "same" },

        // Let solve/step do the work: move constant, simplify
        { pattern: "solve(?e, solved_for(?x))", ruleId: "solve_driver_step", focus: "same" },
        { pattern: "solve(?e, solved_for(?x))", ruleId: "solve_driver_step", focus: "same" },
        { pattern: "solve(?e, solved_for(?x))", ruleId: "solve_driver_step", focus: "same" },

        { pattern: "solve(eq(?x, ?rhs), solved_for(?x))", ruleId: "solve_isolated_left", focus: "same" },
        { pattern: "solve(eq(?lhs, ?x), solved_for(?x))", ruleId: "solve_isolated_right", focus: "same" }
      ],
    },
    tags: ["solve", "linear", "procedure", "generic"]
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

  chooseAction({ root, goal, focusCandidates, registry }: { root: AstNode, goal: Goal, focusCandidates, registry: SkillRegistry }) {
    console.log(`\n[DumbPolicy] Step ${this.stepCount}, Available skills:`, availableSkills.map((s: any) => s.id));

    const has = (idPattern: string) => availableSkills.some((s: SkillDescriptor) => s.id.includes(idPattern));
    const find = (idPattern: string) => availableSkills.find((s: SkillDescriptor) => s.id.includes(idPattern));

    // Simple strategy: try each skill in sequence
    if (goal.kind === "solve_for") {
      // First try normalizing
      if (this.stepCount === 0 && has("neg(?b)")) {
        const skill = find("neg(?b)");
        console.log(`[DumbPolicy] Choosing normalize skill at root`);
        return { skillId: skill!.id, focus: [] };
      }

      // Then try simplifying
      if (this.stepCount === 1 && has("simplified")) {
        const skill = find("simplified");
        console.log(`[DumbPolicy] Choosing simplify skill at focus [0]`);
        return { skillId: skill!.id, focus: [0] };
      }

      // Finally try solving - prefer more specific patterns
      if (this.stepCount >= 2) {
        // Try simple linear first
        if (has("eq(sum(?x, ?c), 0)")) {
          const skill = find("eq(sum(?x, ?c), 0)");
          console.log(`[DumbPolicy] Choosing simple linear solve at root`);
          return { skillId: skill!.id, focus: [] };
        }
        // Then try kx+c pattern
        if (has("eq(sum(mul(?k, ?x), ?c), 0)")) {
          const skill = find("eq(sum(mul(?k, ?x), ?c), 0)");
          console.log(`[DumbPolicy] Choosing linear solve at root`);
          return { skillId: skill!.id, focus: [] };
        }
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
  await seedBaselineSkills(registry);

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
    console.log(`\n=== Problem ${i + 1}: ${input} ===`);
    console.log(`Expected form: ${expected}`);

    const rawExpr = parse(input);
    console.log(`Shape:        ${rawExpr.toShapeString()}\n`);

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
        console.log(`     Result: ${match.replace.toString()}`);
      }
    }

    // Try to solve step by step
    let current = expr;
    let steps = 0;
    const maxSteps = 10;

    console.log("\nSolving step by step:");
    while (steps < maxSteps) {
      console.log(`  Step ${steps}: ${current.toString()}`);

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

    console.log(`\nFinal result: ${current.toString()}`);
    console.log("---");
  }

  console.log("\n======================================================================");
  console.log("TRAINING PROBLEMS TEST COMPLETED");
  console.log("======================================================================");
}

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama();

  const proposer = new AbstractionProposer(llm);
  const verifier = new SymbolicVerifier(runtime);

  const registry = new SkillRegistry();
  await seedBaselineSkills(registry);

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

// Run training problems test
//await testTrainingProblems();

// Uncomment to run full orchestrator with LLM
await main(RuntimeImpl.instance);