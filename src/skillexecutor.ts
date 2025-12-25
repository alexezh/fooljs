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
import { astMatch } from "./ast_match";
import { astReplace } from "./ast_match";
import { parse } from "./parser";
import { Goal } from "./planner/plannercore";
import { RuleBody, Runtime, SkillId } from "./runtime";
import { SkillDescriptor } from "./skilldescriptor";
import { SkillRegistry } from "./skillregistry";

export class SkillExecutor {
  constructor(private readonly runtime: Runtime) { }

  // Execute a skill at focus. For macro_action, apply its steps.
  tryExecute(skill: SkillDescriptor | SkillId, root: AstNode, focus: number[], goal: Goal): { nextRoot: AstNode; applied: boolean } {
    const s = (typeof (skill) === "string" ? this.runtime.skillRegistry.get(skill) : skill);
    if (!s) return { nextRoot: root, applied: false };

    if (s.payload.kind === "rewrite_rule") {
      throw 'Not implemented';
    } else if (s.payload.kind === "macro_action") {
      // Parse the skill body to get the AST
      const skillAst = parse(s.payload.skillBody);

      // Should be a rule: pattern => do [...]
      if (skillAst.kind !== 'rule') {
        return { nextRoot: root, applied: false };
      }

      const [pattern, doBlock] = skillAst.children || [];
      if (!pattern || !doBlock) {
        return { nextRoot: root, applied: false };
      }

      // Get the node at focus
      let current = this.runtime.getAt(root, focus);

      // Match the pattern against the focused node
      const patternMatch = astMatch(pattern, current);
      if (!patternMatch) {
        return { nextRoot: root, applied: false };
      }

      // If doBlock is a 'do' node, apply rules sequentially
      if (doBlock.kind === 'do') {
        const rules = doBlock.children || [];
        let applied = false;

        for (let i = 0; i < Math.min(s.payload.budget, rules.length); i++) {
          const rule = rules[i];

          if (rule.kind !== 'rule') continue;

          const [rulePattern, ruleReplacement] = rule.children || [];
          if (!rulePattern || !ruleReplacement) continue;

          // Try to match this rule
          const bindings = astMatch(rulePattern, current);

          if (bindings) {
            // Apply the replacement
            const next = astReplace(ruleReplacement, bindings);
            current = next;
            applied = true;
          }
          // If no match, continue with same current (rules are optional)
        }

        if (applied) {
          // Update the tree at focus
          const nextRoot = this.runtime.setAt(root, focus, current);
          return { nextRoot, applied: true };
        }
      }

      return { nextRoot: root, applied: false };
    }

    // tagger doesn't execute
    return { nextRoot: root, applied: false };
  }
}
