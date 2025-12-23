import { AstNode, ASymbol } from "./ast.js";
import { DumbPolicy } from "./dumbpolicy.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, LlmClient, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse, parseEquation } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { initRules } from "./ruletable.js";
import { RuleId, Runtime, SkillId } from "./runtime.js";
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
    id: "eq_zero_form_inline" as SkillId,
    name: "Normalize equation to zero-form",
    payload: {
      kind: "macro_action",
      budget: 1,
      match: "eq(?a, ?b)",
      steps: [{
        ruleBody: "eq(?a, ?b) => eq(sum(?a, neg(?b)), 0)",
        focus: "same",
      }],
    },
    tags: ["eq", "normalize"],
  });

  await registry.add({
    id: "local_simplify_bounded_inline" as SkillId,
    name: "Local simplification pass (bounded)",
    payload: {
      kind: "macro_action",
      match: "paren(?a) | neg(neg(?a)) | neg(0) | sum(?args..., 0, ?rest...) | sum(?a, ?b)",
      budget: 12,
      steps: [
        { ruleBody: "paren(?a) => ?a", focus: "same" },
        { ruleBody: "neg(neg(?a)) => ?a", focus: "same" },
        { ruleBody: "neg(0) => 0", focus: "same" },

        { ruleBody: "sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)", focus: "same" },

        { ruleBody: "sum(?a, ?b) => calc_sum(?a, ?b) where ?a is number, ?b is number", focus: "same" },
      ],
    },
    tags: ["simplify"],
  });
  await registry.add({
    id: "macro_solve_ax_plus_c_zero_inline_factor_then_eval" as SkillId,
    name: "Solve ax + c = 0 (factor x, isolate, then eval RHS)",
    payload: {
      kind: "macro_action",
      budget: 14,
      steps: [
        // 1) Normalize equation to zero form
        {
          ruleBody: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(sub(?a, ?b), 0), solved_for(?x)) => solve(eq(sum(?a, neg(?b)), 0), solved_for(?x))",
          focus: "same",
        },

        // 2) (Optional) group exact x terms to the front (cheap helper)
        {
          ruleBody: "solve(eq(sum(?terms...), 0), solved_for(?x)) => solve(eq(group_same(sum(?terms...), ?x), 0), solved_for(?x))",
          focus: "same",
        },

        // 3) Move constant tail to RHS: (t + c) = 0 => t = -c
        {
          ruleBody: "solve(eq(sum(?t, ?c), 0), solved_for(?x)) => solve(eq(?t, neg(?c)), solved_for(?x))",
          focus: "same",
        },

        // 4) Factor out x from a sum of x-multiples:
        //    sum(t_i) => mul(x, sum(div(t_i, x)))
        {
          ruleBody:
            "solve(eq(sum(?terms...), ?b), solved_for(?x)) => " +
            "solve(eq(mul(?x, sum(?qs...)), ?b), solved_for(?x)) " +
            "where map_div_by_x([?terms...], ?x) => [?qs...]",
          focus: "same",
        },

        // 5) Isolate x by dividing both sides by the other factor:
        //    x*k = b  => x = b/k   (or k*x = b => x = b/k)
        {
          ruleBody: "solve(eq(mul(?x, ?k), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(mul(?k, ?x), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))",
          focus: "same",
        },

        // 6) Evaluate/simplify the RHS as a whole (this is where x/x=>1 happens, inside ?rhs)
        {
          ruleBody: "solve(eq(?x, ?rhs), solved_for(?x)) => solve(eq(?x, eval(?rhs)), solved_for(?x))",
          focus: "same",
        },
        // If you prefer your expensive progression library:
        // {
        //   pattern: "solve(eq(?x, ?rhs), solved_for(?x))",
        //   rewrite: "solve(eq(?x, ?rhs), solved_for(?x)) => solve(eq(?x, simplify(?rhs)), solved_for(?x))",
        //   focus: "same",
        // },

        // 7) Discharge
        {
          ruleBody: "solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs",
          focus: "same",
        },
      ],
    },
    tags: ["solve", "linear", "procedure", "generic", "inline_rules", "factor", "eval_rhs"],
  });
}

const dumbPolicy = new DumbPolicy();

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama();

  initRules(RuntimeImpl.instance);
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