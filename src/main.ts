import { AstNode, ASymbol } from "./ast.js";
import { LlmClientLlama } from "./llmclient.js";
import { AbstractionProposer, LlmClient, Orchestrator, SkillExecutor, SkillRegistry, SymbolicVerifier } from "./orchestrator.js";
import { parse } from "./parser.js";
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
// Use your real RL policy. This dumb policy is just to demonstrate wiring.

const dumbPolicy = {
  chooseAction({ root, goal, focusCandidates, availableSkills }: any) {
    // Always try: NormalizeEq at root, then SimplifyLocal at LHS, then SolveLinearZeroForm at root.
    const has = (id: string) => availableSkills.some((s: any) => s.id === id);
    if (goal.kind === "solve_for") {
      if (has("NormalizeEq")) return { skillId: "NormalizeEq", focus: [] };
      if (has("SimplifyLocal")) return { skillId: "SimplifyLocal", focus: [0] };
      if (has("SolveLinearZeroForm")) return { skillId: "SolveLinearZeroForm", focus: [] };
    }
    // fallback: first available
    const first = availableSkills[0];
    return first ? { skillId: first.id, focus: focusCandidates[0] ?? [] } : null;
  },
  observe(_evt: any) {
    // no-op; replace with real RL updates
  },
};

// ----------------------------
// 3) Main: construct orchestrator + run curriculum
// ----------------------------

async function main(runtime: Runtime) {
  // 3.1 LLM REST client (OpenAI-compatible chat endpoint)
  const llm = new LlmClientLlama(
  );

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
    const goal = { kind: "solve_for", x: "x" };
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

// Call main(runtime) from your bootstrap after initCore(runtime), etc.
// main(runtime).catch(console.error);

await main(RuntimeImpl.instance);