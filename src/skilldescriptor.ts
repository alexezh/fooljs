import { Goal } from "./planner/plannercore";
import { RuleBody, RuleId, SkillId } from "./runtime";

export type SkillKind = "rewrite_rule" | "macro_action" | "tagger";

/**
 * named strategy (a function) that runs a sequence + choice over rules (and maybe calls other skills). 
 * I.e. State -> State? (Kleisli-ish) where failure is allowed and backtracking is expected.
 */
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

export type SkillBody = string;

export interface MacroActionPayload {
  kind?: "macro_action"; // optional if discriminated elsewhere

  skillBody: SkillBody;

  // Hard cap to guarantee termination
  budget: number;

  // Optional metadata / hints
  notes?: string;
}

export type MacroCondition =
  | { kind: "pattern_matches"; pattern: string }
  | { kind: "goal_is"; goal: Goal["kind"] }
  | { kind: "rule_applicable"; ruleId: string };

export interface RewriteRulePayload {
  kind?: "rewrite_rule";

  skillBody: SkillBody;
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



