import { AstNode } from "./ast.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, Orchestrator, SymbolicVerifier } from "./orchestrator.js";
import { parse, parseEquation } from "./parser.js";
import { FeatureExtractor } from "./planner/featureextractor.js";
import { Goal } from "./planner/plannercore.js";
import { LeafNodeNN, PolicyNN, RoutingNodeNN } from "./planner/policynn.js";
import { trainVerbs } from "./planner/trainverbs.js";
import { Verb, VerbRegistry } from "./planner/verb.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { RuntimeImpl } from "./runtimeimpl.js";
import { SkillExecutor } from "./planner/verbexecutor.js";

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

// ----------------------------
// 1) Bootstrapping: baseline skills in registry
// ----------------------------

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama();

  //initRules(RuntimeImpl.instance);
  const leafNode = new LeafNodeNN({ id: 'leaf', featureDim: 3 });
  const policy = new PolicyNN<Verb>(
    new FeatureExtractor(),
    VerbRegistry.instance.getVerbs(),
    new RoutingNodeNN({ id: 'route', children: [leafNode], featureDim: 3 }));

  //await seedBaselineSkills(RuntimeImpl.instance.skillRegistry);

  const executor = new SkillExecutor(runtime);

  const orchestrator = new Orchestrator(
    runtime,
    policy,      // swap for your RL policy
    executor,
    {
      maxSteps: 30,
      focusLimit: 10,
      proposeEveryNSuccesses: 3, // after 3 successful solves, ask LLM for abstractions
      maxProposals: 3,
    }
  );

  trainVerbs(orchestrator, llm);

  // 3.3 Final harder problem
  // const finalProblem = "eq(sum(mul(2, x), mul(3, x), 4, mul(4, x), 2), 2)";

  // console.log("=== FINAL ===");
  // const finalExpr = parse(finalProblem);
  // const finalOut = await orchestrator.solveOne({
  //   expr: finalExpr,
  //   goal: { kind: "solve_for", sym: "x" },
  //   focusCandidates: defaultFocusCandidates(finalExpr),
  //   testSetForVerify: verifySet,
  // });

  // console.log("problem:", finalProblem);
  // console.log("final result:", finalOut.result);
  // console.log("trace success:", finalOut.trace.success);
  // console.log("trace JSON:", JSON.stringify(finalOut.trace, null, 2));
}

// Run basic tests (no LLM required)
//await testBasicOrchestrator();

// Run training problems test
//await testTrainingProblems();

// Uncomment to run full orchestrator with LLM
await main(RuntimeImpl.instance);
