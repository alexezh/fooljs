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

import { AstNode } from "../ast.js";
import { parse } from "../parser.js";
import { Goal } from "./plannercore.js";
import { Runtime, SkillId } from "../runtime.js";
import { SkillDescriptor } from "../skilldescriptor.js";
import { Verb } from "./verb.js";

export class SkillExecutor {
  constructor(private readonly runtime: Runtime) { }

  /**
   * Execute a skill at focus. For macro_action, apply its steps.
   */
  tryExecute(verb: Verb, root: AstNode, focus: number[], goal: Goal): { nextRoot: AstNode; applied: boolean } {

    // Get the node at focus
    let current = this.runtime.getAt(root, focus);

    // Check if pattern is a wrapper function
    // If doBlock is a 'do' node, apply rules sequentially to working content
    const steps = verb.emit.children!;

    for (let i = 0; i < steps.length; i++) {
      const stepAst = steps[i];

      const stepCode = this.runtime.ruleCache.compileRule(stepAst);

      const next = stepCode.matchFunc(current);
      if (next) {
        current = next.replace;
      }
    }

    // Update the tree at focus
    const nextRoot = this.runtime.setAt(root, focus, current);
    return { nextRoot, applied: true };
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