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

import { AstNode } from "./ast.js";
import { astMatch } from "./ast_match.js";
import { astReplace } from "./ast_match.js";
import { parse } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { Runtime, SkillId } from "./runtime.js";
import { SkillDescriptor } from "./skilldescriptor.js";

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

      // Determine the working content to transform
      // If pattern is a wrapper like solve(...), extract the inner content to transform
      let workingContent = current;
      let wrapperFunc: string | null = null;
      let wrapperArgs: AstNode[] = [];

      // Check if pattern is a function wrapper (like solve, eval, etc.)
      if (pattern.kind === 'func' && pattern.children && pattern.children.length > 0) {
        // Pattern like solve(eq(?lhs, ?rhs), solved_for(?x))
        // Extract first arg as working content, rest as wrapper context
        wrapperFunc = pattern.value as string;
        const patternArgs = pattern.children;

        if (current.kind === 'func' && current.value === wrapperFunc) {
          const currentArgs = current.children || [];
          if (currentArgs.length > 0) {
            workingContent = currentArgs[0]; // Extract inner content (e.g., the equation)
            wrapperArgs = currentArgs.slice(1); // Keep wrapper args (e.g., solved_for(?x))
          }
        }
      }

      // If doBlock is a 'do' node, apply rules sequentially to working content
      if (doBlock.kind === 'do') {
        const rules = doBlock.children || [];
        let applied = false;

        for (let i = 0; i < Math.min(s.payload.budget, rules.length); i++) {
          const rule = rules[i];

          if (rule.kind !== 'rule') continue;

          const [rulePattern, ruleReplacement] = rule.children || [];
          if (!rulePattern || !ruleReplacement) continue;

          // Try to match this rule against working content
          const bindings = astMatch(rulePattern, workingContent);

          if (bindings) {
            // Apply the replacement
            const next = astReplace(ruleReplacement, bindings);
            workingContent = next;
            applied = true;
          }
          // If no match, continue with same workingContent (rules are optional)
        }

        if (applied) {
          // Wrap the result back if there was a wrapper
          // BUT: If the wrapper was solve(...) and the result is no longer an equation,
          // it means we've "discharged" the solve, so don't wrap it back
          let result = workingContent;
          if (wrapperFunc) {
            const shouldWrap = !(wrapperFunc === 'solve' && workingContent.kind !== 'eq');
            if (shouldWrap) {
              result = AstNode.create('func', wrapperFunc as any, [workingContent, ...wrapperArgs]);
            }
          }

          // Update the tree at focus
          const nextRoot = this.runtime.setAt(root, focus, result);
          return { nextRoot, applied: true };
        }
      }

      return { nextRoot: root, applied: false };
    }

    // tagger doesn't execute
    return { nextRoot: root, applied: false };
  }
}
