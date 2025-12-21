import { SkillDescriptor } from "../skilldescriptor.js";
import { ActionId, FeatureVector, Path } from "./plannercore.js";

export interface Policy {
  // Rank candidates given features. Higher score tried first.
  rank(
    candidates: ActionCandidate[],
    featuresByCandidate: Map<string, FeatureVector>
  ): RankedCandidate[];

  // Training hook: update policy from one transition.
  // You can implement as bandit, Q-learning, supervised imitation, etc.
  observe?(evt: {
    beforeFeatures: FeatureVector;
    chosen: ActionCandidate;
    reward: number;
    afterFeatures?: FeatureVector;
    success?: boolean;
  }): void;
}

// RL policy chooses among available skills/actions (existing in your system)
export interface Policy {
  // Decide whether to invoke a macro/skill now, and which one.
  chooseAction(input: {
    root: any;
    goal: any;
    focusCandidates: number[][];
    availableSkills: SkillDescriptor[];
  }): { skillId: string; focus: number[] } | null;

  // Learn from outcomes
  observe?(evt: {
    rootBefore: any;
    rootAfter: any;
    chosen: { skillId: string; focus: number[] };
    reward: number;
    success: boolean;
  }): void;
}

// ----------------------------
// 4) Policy (trainable selector over (focus, action))
// ----------------------------

export interface ActionCandidate {
  focus: Path;
  actionId: ActionId;
  // Optional: the action can include a paramization key ("mode"), not shown here.
}

export interface RankedCandidate extends ActionCandidate {
  score: number;
}

export function dot(w: Record<string, number>, f: FeatureVector): number {
  let s = 0;
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === "number") s += (w[k] ?? 0) * v;
  }
  return s;
}

export function candidateKey(c: ActionCandidate): string {
  return `${c.actionId} @${c.focus.join(",")} `;
}
