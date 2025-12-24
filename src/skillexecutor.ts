// ----------------------------
// 5) RL decides when to use accepted abstractions (skills)
// ----------------------------
//
// You already have a policy skeleton. The idea is:
// - SkillRegistry holds accepted meta-actions/macros
// - Policy chooses among them during solve
// - We log experience and update policy
//
// Here, "availableSkills" is everything in the registry that is relevant to this goal.

import { AstNode } from "./ast";
import { Goal } from "./planner/plannercore";
import { RuleBody, Runtime, SkillId } from "./runtime";
import { SkillDescriptor } from "./skilldescriptor";
import { SkillRegistry } from "./skillregistry";

export class SkillExecutor {
  constructor(private readonly runtime: Runtime, private readonly registry: SkillRegistry) { }

  // Execute a skill at focus. For macro_action, apply its steps.
  tryExecute(skill: SkillDescriptor | SkillId, root: AstNode, focus: number[], goal: Goal): { nextRoot: AstNode; applied: boolean } {
    const s = (typeof (skill) === "string" ? this.registry.get(skill) : skill);
    if (!s) return { nextRoot: root, applied: false };

    if (s.payload.kind === "rewrite_rule") {
      // You can store a ruleId in payload, or compile rule string to ruleId at registration time.
      const ruleId = s.payload?.ruleId;
      if (typeof ruleId !== "string") return { nextRoot: root, applied: false };

      debugger;
      const next = this.runtime.tryApplyRuleAt(ruleId as RuleBody, root, focus);
      return next ? { nextRoot: next, applied: true } : { nextRoot: root, applied: false };
    } else if (s.payload.kind === "macro_action") {
      const steps = s.payload?.steps ?? [];
      const budget = s.payload?.budget ?? 8;
      let cur = root;
      let applied = false;

      for (let i = 0; i < Math.min(budget, steps.length); i++) {
        const ruleBody = steps[i]?.ruleBody as RuleBody;

        const next = this.runtime.tryApplyRuleAt(ruleBody, cur, focus);
        if (next) {
          cur = next;
          applied = true;
        }
      }
      return { nextRoot: cur, applied };
    }

    // tagger doesn't execute
    return { nextRoot: root, applied: false };
  }
}
