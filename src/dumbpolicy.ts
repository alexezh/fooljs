// ----------------------------
// 2) Policy (placeholder)
// ----------------------------
// Dumb policy for testing - just tries skills in order

import { AstNode } from "./ast";
import { Goal } from "./planner/plannercore";
import { SkillId } from "./runtime";
import { SkillDescriptor } from "./skilldescriptor";
import { SkillRegistry } from "./skillregistry";

export class DumbPolicy {
  private stepCount = 0;
  private skills?: SkillDescriptor[];

  // Simple rank implementation - just returns candidates in order
  rank(candidates: any[], _featuresByCandidate: Map<string, any>): any[] {
    return candidates.map((c, i) => ({ ...c, score: candidates.length - i }));
  }

  async chooseAction({ root, goal, focusCandidates, registry }: { root: AstNode, goal: Goal, focusCandidates, registry: SkillRegistry }):
    Promise<{ skillId: SkillId, focus: [] } | null> {
    if (!this.skills) {
      this.skills = await registry.findMatching(root);
    }
    console.log(`\n[DumbPolicy] Step ${this.stepCount}, Available skills: `, this.skills.map((s: any) => s.id));

    // Simple strategy: try each skill in sequence
    if (goal.kind === "solve_for") {
      if (this.stepCount < this.skills.length) {
        const res = this.skills[this.stepCount];
        this.stepCount++;
        return {
          skillId: res.id,
          focus: []
        };
      }
    }

    console.log(`[DumbPolicy] No matching skills found`);
    return null;
  }

  observe(evt: any) {
    this.stepCount++;
    console.log(`[DumbPolicy] Observed: reward = ${evt.reward}, success = ${evt.success} `);
  }
}
