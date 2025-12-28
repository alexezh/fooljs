import { AstNode } from "./ast.js";
import { seedBaselineSkills } from "./baselineskills.js";
import { DumbPolicy } from "./dumbpolicy.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse, parseEquation } from "./parser.js";
import { FeatureExtractor } from "./planner/featureextractor.js";
import { Goal } from "./planner/plannercore.js";
import { LeafNodeNN, PolicyNN, RoutingNodeNN } from "./planner/policynn.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { SkillExecutor } from "./skillexecutor.js";

// function main_search(): void {
//   //const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
//   // const exprStr = '4 + 3 * 4';
//   //const exprStr = '7x + 2x^2 – 14 + 3x^2 = x – 2'
//   const exprStr = '7x + 2 = 3'
//   //const exprStr = '7x^2 - 2 = 0'

//   initRules(RuntimeImpl.instance);
//   //initStates(RuntimeImpl.instance);
//   let ast = parseEquation(exprStr);

//   const res = aStarSearch(ast);
//   if (res) {
//     const solStr = getSolutionString(res);
//   }

//   //const match = RuntimeImpl.instance.matchRule(ast);
//   //console.log(match?.length);
// }

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
    parse("eq(sub(x, 3), 0)"),
    parse("eq(mul(4, x), 12)"),
    parse("eq(0, sum(x, 5))"),
    parse("eq(sum(x, 0, 6), 0)"),
  ];
}

// ----------------------------
// 1) Bootstrapping: baseline skills in registry
// ----------------------------

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama();

  initRules(RuntimeImpl.instance);
  const policy = new PolicyNN(
    new FeatureExtractor(),
    new RoutingNodeNN({ id: 'route', childIds: ['leaf'], featureDim: 3 }),
    new LeafNodeNN({ id: 'leaf', featureDim: 3 })
  );
  const proposer = new AbstractionProposer(llm);
  const verifier = new SymbolicVerifier(runtime);

  await seedBaselineSkills(RuntimeImpl.instance.skillRegistry);

  const executor = new SkillExecutor(runtime);

  const orchestrator = new Orchestrator(
    runtime,
    policy,      // swap for your RL policy
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

  console.log("=== TRAINING ===");
  for (const p of trainingProblems) {
    const expr = parseEquation(p);
    const goal: Goal = { kind: "solve_for", sym: "x" };
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
    goal: { kind: "solve_for", sym: "x" },
    focusCandidates: defaultFocusCandidates(finalExpr),
    testSetForVerify: verifySet,
  });

  console.log("problem:", finalProblem);
  console.log("final result:", finalOut.result);
  console.log("trace success:", finalOut.trace.success);
  console.log("trace JSON:", JSON.stringify(finalOut.trace, null, 2));
}

// Run basic tests (no LLM required)
//await testBasicOrchestrator();

// Run training problems test
//await testTrainingProblems();

// Uncomment to run full orchestrator with LLM
await main(RuntimeImpl.instance);
