// A simple contextual bandit policy: linear weights per (actionId) over feature keys.

import { ActionId, FeatureVector } from "./plannercore.js";
import { ActionCandidate, candidateKey, dot, Policy, RankedCandidate } from "./policy.js";

// (Skeleton: you can swap for NN later.)
export class LinearBanditPolicy /*implements Policy */ {
  private w: Record<ActionId, Record<string, number>> = {};

  constructor(private readonly learningRate = 0.05) { }

  rank(
    candidates: ActionCandidate[],
    featuresByCandidate: Map<string, FeatureVector>
  ): RankedCandidate[] {
    const scored: RankedCandidate[] = [];
    for (const c of candidates) {
      const key = candidateKey(c);
      const f = featuresByCandidate.get(key) ?? {};
      const s = dot(this.w[c.actionId] ?? {}, f);
      scored.push({ ...c, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  observe(evt: {
    beforeFeatures: FeatureVector;
    chosen: ActionCandidate;
    reward: number;
  }): void {
    // Very simple update: w += lr * reward * features
    const a = evt.chosen.actionId;
    this.w[a] ||= {};
    for (const [k, v] of Object.entries(evt.beforeFeatures)) {
      if (typeof v === "number") {
        this.w[a][k] = (this.w[a][k] ?? 0) + this.learningRate * evt.reward * v;
      }
    }
  }
}
