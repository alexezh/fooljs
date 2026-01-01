// =============================================================================
// Skeleton: LLM proposes abstractions → Symbolic core verifies → RL decides when to use
// Using a REST Chat API to talk to an LLM (OpenAI-compatible style).
// =============================================================================
//
// Notes:
// - This is a wiring skeleton, not a full engine.
// - You already have: Runtime (AST, matcher, rule application), equivalence checks, etc.
// - "Abstractions" here can be:
//    (A) new RULES (rewrite rules)
//    (B) new MACRO-ACTIONS (bounded sequences of rule ids)
//    (C) new MATCHERS / TAGGERS (state predicates)
// - We keep math semantics in your symbolic core; LLM proposals are always verified.
//
// Key modules:
// 1) LlmClient: REST chat API wrapper
// 2) AbstractionProposer: prompt+parse proposals
// 3) SymbolicVerifier: test + equivalence + termination checks
// 4) SkillRegistry: store accepted skills (rules/macros/taggers)
// 5) Policy (RL): choose when to invoke which macro/skill
// 6) Orchestrator: training loop + online loop

import { AstNode } from "./ast.js";
import { ChatMessage, LlmClient } from "./llmclient.js";
import { Goal } from "./planner/plannercore.js";
export type { LlmClient } from "./llmclient.js";
import { Policy } from "./planner/policy.js";
import { SolveTrace } from "./planner/solvetrace.js";
import { Clause, Verb } from "./planner/verb.js";
import { RuleBody, Runtime } from "./runtime.js";
import { MacroActionPayload, RewriteRulePayload, SkillDescriptor } from "./skilldescriptor.js";
import { SkillExecutor } from "./skillexecutor.js";
import { SkillRegistry } from "./skillregistry.js";

// ----------------------------
// 3) LLM → propose abstractions
// ----------------------------
//
// Input:
// - traces (successful trajectories) or failure cases
// Output:
// - candidate SkillDescriptor(s)
// Parse format: JSON (strict), so verifier can consume.

const systemPrompt = `
You propose NEW abstractions for a symbolic rewrite/solve system.

Return ONLY valid JSON (no markdown, no extra text), in this schema:
{
  "proposals": [
    {
      "id": "string",
      "kind": "rewrite_rule" | "macro_action" | "tagger",
      "name": "string",
      "payload": { ... },
      "tags": ["..."],
      "rationale": "short"
    }
  ]
}

=== DSL syntax ===
Expressions:
- numbers: 1, 42
- symbols: x, y, a1, x2
- pattern variables: ?x, ?lhs, ?rest...
- function calls: f(arg1, arg2, ...)
- lists: [a, b, c] with variadics like [?x, ?xs...]
- rewrite rules: "<lhs> => <rhs>" optionally with "where" constraints

Pattern variables:
- ?x matches one node
- ?rest... matches 0+ nodes (only inside argument lists or list literals)

Constraints (ONLY these predicates are allowed):
- number
- nonneg_number
- positive_number
- symbol_name
- func_name

Allowed function/operator names (do NOT invent new ones):
sum, mul, div, sub, neg, pow, sqrt, paren,
eq, solve, solved_for, step, eval,
sym, def,
count, fold, acc, prod,
log, exp.

=== Proposal payloads ===

1) rewrite_rule payload:
{
  "rule": "<DSL rule string>",
  "ruleType": "simp" | "normalize" | "compute" | "strategy",
  "whenPattern": "<optional DSL pattern guard>",
  "measureImproved": ["<optional strings>"],
  "notes": "<optional>"
}

Requirements:
- ruleType in {"simp","normalize","compute"} MUST preserve semantics (equivalence).
- ruleType="strategy" MAY change shape without guaranteed equivalence, but MUST include:
  - whenPattern (required)
  - measureImproved (required)
Strategy rules should be rare and high-value.

2) macro_action payload:
{
  "steps": [
    { "rule": "<DSL rule string>", "whenPattern": "<optional DSL pattern>", "focus": "root|same" }
  ],
  "budget": <number>
}

Macro-action steps contain full DSL rules (NOT ruleIds). Keep budget small (<= 12).

3) tagger payload:
{
  "pattern": "<DSL pattern>",
  "tag": "<string>",
  "priority": <number>
}

=== Guidance ===
- Prefer general reusable transformations (normalization, simplification, collecting constants/like-terms).
- Avoid creating pairs of inverse rules that would loop.
- Keep proposals few (<=5) and high value.
`;

export class AbstractionProposer {
  constructor(private readonly llm: LlmClient) { }

  async proposeFromTraces(input: {
    traces: SolveTrace[];
    maxProposals?: number;
    domainNotes?: string;
  }): Promise<SkillDescriptor[]> {
    const system: ChatMessage = {
      role: "system",
      content: systemPrompt,
    };

    const user: ChatMessage = {
      role: "user",
      content:
        `Traces (JSON):
${JSON.stringify(input.traces).slice(0, 60_000)}  // cap to avoid huge payload

Domain notes:
${input.domainNotes ?? ""}

Please produce up to ${input.maxProposals ?? 5} proposals.`,
    };

    const resp = await this.llm.chat([system, user], { temperature: 0.2 });
    const parsed = safeJsonParse(resp.content);
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];

    // Convert to SkillDescriptors
    return proposals.map((p: any) => ({
      id: String(p.id),
      kind: p.kind,
      name: String(p.name),
      payload: p.payload,
      tags: p.tags ?? [],
      createdFrom: {
        traceId: input.traces[0]?.traceId,
        llmModel: (this.llm as any).model ?? "unknown",
        timestamp: new Date().toISOString(),
      },
    }));
  }
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

// ----------------------------
// 4) Symbolic core → verify proposals
// ----------------------------
//
// Verification strategies (pick what you can support):
// - Equivalence check using canonicalization / rewriting to normal form
// - Random testing via evaluation with random variable assignments
// - Termination / no-blowup checks for macros (bounded steps, size caps)
// - Non-regression tests on a labeled set

export interface VerificationResult {
  ok: boolean;
  reason?: string;
  evidence?: any;
}

export class SymbolicVerifier {
  constructor(private readonly runtime: Runtime) { }

  verify(skill: SkillDescriptor, testSet: AstNode[]): VerificationResult {
    return { ok: true };

    // switch (skill.payload.kind) {
    //   case "rewrite_rule":
    //     return this.verifyRewriteRule(skill.payload, testSet);
    //   case "macro_action":
    //     return this.verifyMacroAction(skill.payload, testSet);
    //   case "tagger":
    //     return this.verifyTagger(skill.payload, testSet);
    //   default:
    //     return { ok: false, reason: `Unknown skill kind: ${(skill as any).kind}` };
    // }
  }
}


// ----------------------------
// 6) Orchestrator: online solve + periodic LLM proposal + verification + policy update
// ----------------------------

export interface OrchestratorConfig {
  maxSteps: number;
  focusLimit: number;

  // How often to ask LLM for new abstractions
  proposeEveryNSuccesses: number;

  // How many proposals to request each time
  maxProposals: number;
}

export class Orchestrator<TElem extends Verb | Clause> {
  private successCounter = 0;

  constructor(
    private readonly runtime: Runtime,
    public readonly policy: Policy<Verb>,
    private readonly proposer: AbstractionProposer,
    private readonly verifier: SymbolicVerifier,
    //private readonly executor: SkillExecutor,
    private readonly cfg: OrchestratorConfig
  ) { }

  async solveOne(input: { expr: AstNode; goal: Goal; focusCandidates: number[][] }): Promise<{
    verb: Verb,
    result: AstNode,
    trace: SolveTrace
  }> {
    let root = input.expr;
    let verb: Verb | undefined;
    const trace: SolveTrace = {
      traceId: `trace_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      goal: input.goal,
      start: input.expr,
      steps: [],
      success: false,
    };

    for (let t = 0; t < this.cfg.maxSteps; t++) {
      if (this.runtime.goalMet(root, input.goal)) {
        trace.success = true;
        break;
      }

      const choice = await this.policy.choose({
        root,
        goal: input.goal,
        focusCandidates: input.focusCandidates,
      });

      if (!choice) break;

      verb = choice.choice;
      const before = root;
      //const { nextRoot, applied } = this.executor.tryExecute(choice.choice, root, choice.focus, input.goal);
      // if (!applied) {
      //   // Optionally penalize / teach policy that this choice was ineffective
      //   this.policy.observe?.call({
      //     rootBefore: before,
      //     rootAfter: before,
      //     chosen: choice,
      //     reward: -0.05,
      //     success: false,
      //   });
      //   continue;
      // }

      //root = nextRoot;

      trace.steps.push({
        focus: choice.focus,
        appliedChoiceId: choice.choice!.id, // skillId (macro or rule) used
        before,
        after: root,
      });

      // Reward: sparse success + small step cost (you will likely use shaped reward)
      const success = this.runtime.goalMet(root, input.goal);
      const reward = (success ? 1.0 : 0.0) - 0.01;

      this.policy.observe?.({
        rootBefore: before,
        rootAfter: root,
        chosen: choice,
        reward,
        success,
      });

      break;
    }

    return { verb: verb!, result: root, trace };
  }
}