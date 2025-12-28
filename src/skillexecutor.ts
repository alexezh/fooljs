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
import { parse } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { Runtime, SkillId } from "./runtime.js";
import { SkillDescriptor } from "./skilldescriptor.js";

export class SkillExecutor {
  constructor(private readonly runtime: Runtime) { }

  /**
   * Execute a skill at focus. For macro_action, apply its steps.
   */
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

      const [doBlock] = skillAst.children || [];
      if (!doBlock) {
        return { nextRoot: root, applied: false };
      }

      // Get the node at focus
      let current = this.runtime.getAt(root, focus);

      if (doBlock.kind !== 'do') {
        throw 'Incorrect AST. Expecting do block';
      }

      // Check if pattern is a wrapper function
      // If doBlock is a 'do' node, apply rules sequentially to working content
      const rules = doBlock.children || [];

      for (let i = 0; i < Math.min(s.payload.budget, rules.length); i++) {
        const ruleAst = rules[i];

        const rule = this.runtime.ruleCache.compileRule(ruleAst);

        const next = rule.matchFunc(current);
        if (next) {
          current = next.replace;
        }
      }

      // Update the tree at focus
      const nextRoot = this.runtime.setAt(root, focus, current);
      return { nextRoot, applied: true };
    }

    return { nextRoot: root, applied: false };
  }
}


// ============================================================================
// Orchestrator wiring (policy owns rollback/backtrack)
// ============================================================================

// export class Orchestrator {
//   constructor(
//     private readonly policy: HierarchicalBacktrackingPolicy,
//     private readonly executor: Executor,
//     private readonly runtime: Runtime,
//     private readonly cost: CostModel
//   ) { }

//   async run(input: { root: AstNode; goal: Goal; focusCandidates: number[][]; maxSteps: number }): Promise<AstNode> {
//     let root = input.root;

//     for (let step = 0; step < input.maxSteps; step++) {
//       const choice = await this.policy.chooseSkill({
//         root,
//         goal: input.goal,
//         focusCandidates: input.focusCandidates,
//         runtime: this.runtime,
//       });

//       if (!choice) break;

//       const before = root;
//       const costBefore = this.cost.cost(before, input.goal);

//       const { nextRoot, applied } = this.executor.tryExecute(choice.skill, root, choice.focus, input.goal);
//       if (!applied) {
//         this.policy.observe?.({
//           rootBefore: before,
//           rootAfter: before,
//           goal: input.goal,
//           chosen: choice,
//           reward: -0.05,
//           success: false,
//         });
//         continue;
//       }

//       const costAfter = this.cost.cost(nextRoot, input.goal);

//       // if worse, rollback and let policy penalize the path
//       if (this.cost.isWorse(costBefore, costAfter)) {
//         const rb = this.policy.backtrack({ currentRootAfter: nextRoot, goal: input.goal });
//         if (rb) root = rb.rollbackRoot; // revert
//         continue;
//       }

//       // accept
//       root = nextRoot;
//       this.policy.observe?.({
//         rootBefore: before,
//         rootAfter: nextRoot,
//         goal: input.goal,
//         chosen: choice,
//         reward: this.cost.reward(costBefore, costAfter),
//         success: true,
//       });
//     }

//     return root;
//   }
// }