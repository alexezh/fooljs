// =============================================================================
// Meta-actions + policy skeleton (AST + rewrite rules already exist in your runtime)
// =============================================================================
//
// Assumptions about your existing Runtime:
// - You already have an AST, a rule registry, a matcher, and a way to apply rules.
// - You want a planner loop that:
//   1) enumerates candidate "places to act" (subtrees / paths),
//   2) asks a POLICY to rank meta-actions for those candidates,
//   3) applies the best meta-action (which internally uses your existing rules),
//   4) repeats until goal is met or budget exhausted.
//
// This file defines:
// - Feature extraction hook (pluggable)
// - MetaAction interface
// - A simple trainable policy interface (bandit/Q-style)
// - A solver/planner loop that wires them together

import { DefaultFocusSelector } from "./defaultfocus.js";
import { FeatureExtractor, FeatureVector, FocusSelector, Goal, MetaAction, Runtime } from "./plannercore.js";
import { ActionCandidate, candidateKey, Policy, RankedCandidate } from "./policy.js";

// ----------------------------
// 5) Planner loop: glue everything together
// ----------------------------

export interface PlannerConfig {
  maxSteps: number;
  maxFocus: number;
  // How many top candidates to try before giving up on this iteration
  tryTopK: number;
}

export interface PlannerResult {
  root: any;
  success: boolean;
  stepsTaken: number;
  trace: Array<{
    chosen?: RankedCandidate;
    applied?: boolean;
    info?: any;
  }>;
}

export class Planner {
  constructor(
    private readonly runtime: Runtime,
    private readonly actions: MetaAction[],
    private readonly policy: Policy,
    private readonly features: FeatureExtractor,
    private readonly focusSelector: FocusSelector = new DefaultFocusSelector(),
    private readonly cfg: PlannerConfig = { maxSteps: 50, maxFocus: 20, tryTopK: 5 }
  ) { }

  run(initialRoot: any, goal: Goal): PlannerResult {
    let root = initialRoot;
    const trace: PlannerResult["trace"] = [];

    const baseScore = this.features.score?.(this.runtime, root, goal);

    for (let step = 0; step < this.cfg.maxSteps; step++) {
      if (this.runtime.goalMet(root, goal)) {
        return { root, success: true, stepsTaken: step, trace };
      }

      // 1) pick focus points
      const focusPoints = this.focusSelector.select(this.runtime, root, goal, this.cfg.maxFocus);

      // 2) build candidates (focus × applicable actions)
      const candidates: ActionCandidate[] = [];
      for (const focus of focusPoints) {
        for (const action of this.actions) {
          if (action.applicable(this.runtime, root, goal, focus)) {
            candidates.push({ focus, actionId: action.id });
          }
        }
      }

      if (candidates.length === 0) {
        return { root, success: false, stepsTaken: step, trace };
      }

      // 3) compute features per candidate
      const featuresByCandidate = new Map<string, FeatureVector>();
      for (const c of candidates) {
        const f = this.features.extract(this.runtime, root, goal, c.focus);
        featuresByCandidate.set(candidateKey(c), f);
      }

      // 4) rank candidates
      const ranked = this.policy.rank(candidates, featuresByCandidate);

      // 5) try top-K until one applies (some may fail due to rule-level conflicts)
      let applied = false;
      for (const pick of ranked.slice(0, this.cfg.tryTopK)) {
        const action = this.actions.find(a => a.id === pick.actionId)!;
        const beforeFeat = featuresByCandidate.get(candidateKey(pick)) ?? {};

        const result = action.apply(this.runtime, root, goal, pick.focus);
        if (!result) continue;

        // reward shaping (optional but helpful)
        const beforeScore = this.features.score?.(this.runtime, root, goal);
        const afterScore = this.features.score?.(this.runtime, result.nextRoot, goal);

        // Basic reward:
        // - if you provide score(): use delta
        // - else: sparse goal reward
        let reward = 0;
        if (beforeScore !== undefined && afterScore !== undefined) {
          reward = afterScore - beforeScore;
        } else {
          reward = this.runtime.goalMet(result.nextRoot, goal) ? 1 : 0;
        }

        // small step penalty helps avoid infinite wandering
        reward -= 0.01;

        // train policy (if enabled)
        this.policy.observe?.({
          beforeFeatures: beforeFeat,
          chosen: { focus: pick.focus, actionId: pick.actionId },
          reward,
          success: this.runtime.goalMet(result.nextRoot, goal),
        });

        root = result.nextRoot;
        trace.push({ chosen: pick, applied: true, info: result.info });
        applied = true;
        break;
      }

      if (!applied) {
        // nothing worked among topK; you can either:
        // - expand tryTopK
        // - fall back to a generic SimplifyLocal on root
        trace.push({ applied: false });
        return { root, success: false, stepsTaken: step + 1, trace };
      }
    }

    return { root, success: this.runtime.goalMet(root, goal), stepsTaken: this.cfg.maxSteps, trace };
  }
}

// ----------------------------
// 6) How you wire it (example usage)
// ----------------------------
//
// const actions: MetaAction[] = [
//   new NormalizeEq("ruleEqNormalize"),
//   new SimplifyLocal([
//     "ruleParenRemove",
//     "ruleDoubleNeg",
//     "ruleNeutralRight",
//     "ruleCombineNumbers",
//     "ruleCombineLikeTerms",
//     // ...whatever you already have
//   ]),
//   new ExpandForCancellation([
//     "ruleDistributeLeft",
//     "ruleDistributeRight",
//     // ...your expansion rules
//   ]),
// ];
//
// const policy = new LinearBanditPolicy();
// const features: FeatureExtractor = {
//   extract(rt, root, goal, focus) {
//     const node = rt.getAt(root, focus);
//     return {
//       isEq: rt.matches("eq(?a, ?b)", node) ? 1 : 0,
//       isZeroForm: rt.matches("eq(?a, 0)", node) ? 1 : 0,
//       isMul: rt.matches("mul(?a, ?b, ?rest...)", node) ? 1 : 0,
//       isSum: rt.matches("sum(?a, ?b, ?rest...)", node) ? 1 : 0,
//       // add your own powerful features: degreeInX, cancellationPotential, etc.
//     };
//   },
//   score(rt, root, goal) {
//     // Optional: return a scalar "progress" score. Higher = better.
//     // Example: prefer goal met, prefer zero-form, penalize size (if you can measure).
//     if (rt.goalMet(root, goal)) return 1000;
//     // If you can cheaply detect zero-form at root:
//     const isZero = rt.matches("eq(?a, 0)", root) ? 1 : 0;
//     return 10 * isZero;
//   }
// };
//
// const planner = new Planner(runtime, actions, policy, features);
// const result = planner.run(exprAst, { kind: "solve_for", x: "x" });
//
// ----------------------------
// Notes
// ----------------------------
// - This is intentionally "meta-action first": actions can be as small as one rule
//   (NormalizeEq) or as big as a bounded pipeline (SimplifyLocal, CompleteSquare).
// - You can add LLM-learned meta-actions later as new MetaAction classes with:
//   - a matcher trigger (applicable)
//   - a bounded sequence of ruleIds or a synthesized macro rewrite.
// - You can replace LinearBanditPolicy with a Q-function, NN, or pattern-table later.
// - The entire system "builds upon itself" by adding actions + features + better policy.
