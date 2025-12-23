import { Goal } from "./planner/plannercore";
import { RuleId, SkillId } from "./runtime";

export type SkillKind = "rewrite_rule" | "macro_action" | "tagger";

export interface SkillDescriptor {
  id: SkillId;
  name: string;

  // For rules: DSL rule string; for macro: plan; for tagger: pattern+guard.
  payload: SkillPayload;

  // Optional metadata used by RL
  tags?: string[];
  createdFrom?: {
    traceId?: string;
    llmModel?: string;
    timestamp?: string;
  };
}

export type SkillPayload =
  | RewriteRulePayload
  | MacroActionPayload
  | TaggerPayload;

export interface MacroActionPayload {
  kind?: "macro_action"; // optional if discriminated elsewhere

  // Ordered steps executed by the macro
  steps: MacroStep[];

  // Hard cap to guarantee termination
  budget: number;

  // Optional metadata / hints
  notes?: string;
}

export interface MacroStep {
  // Existing rule ID in Runtime
  ruleId?: RuleId;

  // Serialized AST pattern (e.g., "eq(sum(mul(?k, ?x), ?c), 0)")
  pattern?: string;

  // Optional guard evaluated before applying the rule
  // Keeps macros general and reusable
  when?: MacroCondition;

  // Optional: apply at same focus or override
  focus?: "same" | "root" | number[];
}


export type MacroCondition =
  | { kind: "pattern_matches"; pattern: string }
  | { kind: "goal_is"; goal: Goal["kind"] }
  | { kind: "rule_applicable"; ruleId: string };

export interface RewriteRulePayload {
  kind?: "rewrite_rule";

  // DSL rule string OR compiled ruleId
  ruleId: string;

  // Optional preconditions (soft guards)
  preconditions?: string[];

  // Optional safety hints
  preserves_equivalence?: boolean;
}


export interface TaggerPayload {
  kind?: "tagger";

  // Pattern that tags a node
  pattern: string;

  // Optional semantic label
  tag?: string;

  // Used by policy / heuristics
  priority?: number;
}



