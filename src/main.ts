import { AstNode, ASymbol } from "./ast.js";
import { DumbPolicy } from "./dumbpolicy.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, LlmClient, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse, parseEquation } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { aStarSearch, getSolutionString } from "./search.js";
import { SkillDescriptor } from "./skilldescriptor.js";
import { SkillExecutor } from "./skillexecutor.js";
import { SkillRegistry } from "./skillregistry.js";

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

const dumbPolicy = new DumbPolicy();

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
    const expr = parseEquation(p);
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
    console.log(`${s.id} (${s.payload.kind}) - ${s.name} `);
  }
}

// Run basic tests (no LLM required)
//await testBasicOrchestrator();

// Run training problems test
//await testTrainingProblems();

// Uncomment to run full orchestrator with LLM
await main(RuntimeImpl.instance);