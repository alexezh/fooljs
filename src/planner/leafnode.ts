import { AstNode } from "../ast.js";
import { SkillDescriptor } from "../skilldescriptor.js";
import { NodeId } from "./hpolicy.js";
import { Goal } from "./plannercore.js";
import { BoolVec, Choice } from "./policy.js";

// LeafNode implementation: mixture-of-experts (MoE) over (skill,focus) choices.
// - Produces probabilities (no arbitrary weight drift).
// - Experts:
//   1) TagPriorExpert: stable prior from tags/goal match + (optional) skill.precheck
//   2) NaiveBayesExpert: online learned P(skill | x) from boolean features (per bucket)
//   3) RecencyExpert: small stabilizer preferring skills that recently worked (optional)
//
// You can remove/replace experts without touching the planner.
//
// Notes:
// - Leaf returns a Choice {skill, focus}.
// - Learning is online via observe(...). We update per-skill NB stats and recency stats.
// - Focus selection: we score (skill,focus) pairs with precheck where available and pick best focus
//   under the chosen skill. This avoids needing a trained "focus expert".

export interface LeafNode {
  id: NodeId;

  chooseSkill(input: {
    x: BoolVec;
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
    skills: SkillDescriptor[];
  }): Choice | null;

  observe(input: { x: BoolVec; skillId: string; reward: number; success: boolean }): void;
}

// ------------------------------------
// Expert interface + utility combiner
// ------------------------------------
type Candidate = { skill: SkillDescriptor; focus: number[] };

interface Expert {
  name: string;
  // returns unnormalized log-score (logit) for candidate
  logScore(input: {
    x: BoolVec;
    root: AstNode;
    goal: Goal;
    cand: Candidate;
  }): number;
  observe?(evt: { x: BoolVec; skillId: string; reward: number; success: boolean }): void;
}

function softmaxLogits(logits: Float64Array): Float64Array {
  // stable softmax
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  const exps = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    exps[i] = e;
    sum += e;
  }
  if (sum <= 0) {
    // fallback uniform
    const p = 1 / logits.length;
    for (let i = 0; i < logits.length; i++) exps[i] = p;
    return exps;
  }
  for (let i = 0; i < logits.length; i++) exps[i] /= sum;
  return exps;
}

function sampleCategorical(probs: Float64Array, rng: () => number): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  return probs.length - 1;
}

// ------------------------------------
// Expert 1: Tag/goal prior + precheck
// ------------------------------------
class TagPriorExpert implements Expert {
  name = "tag_prior";

  constructor(private params?: { precheckWeight?: number }) { }

  logScore(input: { x: BoolVec; root: AstNode; goal: Goal; cand: Candidate }): number {
    const { goal, cand, root } = input;

    // goal-to-tag alignment (handy, stable)
    let s = 0;
    if (goal.kind === "solve_for") {
      if (cand.skill.tags.includes("solve")) s += 1.5;
      if (cand.skill.tags.includes("isolate")) s += 1.0;
      if (cand.skill.tags.includes("normalize")) s += 0.4;
      if (cand.skill.tags.includes("danger_expand")) s -= 1.0;
    } else if (goal.kind === "compute") {
      if (cand.skill.tags.includes("compute") || cand.skill.tags.includes("eval") || cand.skill.tags.includes("fold")) s += 1.2;
      if (cand.skill.tags.includes("danger_expand")) s -= 0.6;
      // } else if (goal.kind === "normalize_eq") {
      //   if (cand.skill.tags.includes("normalize") && cand.skill.tags.includes("eq")) s += 1.2;
    } else {
      if (cand.skill.tags.includes("simplify") || cand.skill.tags.includes("normalize")) s += 0.6;
      if (cand.skill.tags.includes("progress")) s += 0.2;
    }

    // Focus-aware precheck: treat as a strong applicability signal
    // if (cand.skill.precheck) {
    //   const pre = cand.skill.precheck({ root, focus: cand.focus, goal });
    //   if (pre <= -1) return Number.NEGATIVE_INFINITY; // hard reject
    //   const w = this.params?.precheckWeight ?? 0.4;
    //   s += w * pre;
    // }

    return s;
  }
}

// ------------------------------------
// Expert 2: Online Naive Bayes over skills
// - Learns P(skill | x) using boolean features (Bernoulli NB)
// - Bucketed to avoid conditioning explosion
// ------------------------------------
type BucketId = number;

type NbSkillState = {
  n: number;
  count1: Uint32Array; // length = numFeatures
};

class NaiveBayesExpert implements Expert {
  name = "naive_bayes";

  private readonly numBuckets: number;
  private readonly alpha: number;
  private readonly rng: () => number;

  // bucket -> (skillId -> stats)
  private readonly buckets = new Map<BucketId, Map<string, NbSkillState>>();

  constructor(params: { numBuckets?: number; alpha?: number; rng?: () => number } = {}) {
    this.numBuckets = params.numBuckets ?? 256;
    this.alpha = params.alpha ?? 1; // Laplace smoothing
    this.rng = params.rng ?? Math.random;
  }

  logScore(input: { x: BoolVec; root: AstNode; goal: Goal; cand: Candidate }): number {
    const { x, cand } = input;
    const b = this.bucketOf(x);
    const m = this.buckets.get(b);
    if (!m) return 0; // neutral until we have data

    const st = m.get(cand.skill.id);
    if (!st) return 0;

    // Bernoulli NB log-likelihood up to constant
    // log P(skill) + Σ_k log P(x_k | skill)
    // Use smoothed probabilities:
    // p_k = (count1[k] + alpha) / (n + 2alpha)
    // add log(p_k) if x_k else log(1-p_k)
    const n = st.n;
    if (n <= 0) return 0;

    let ll = 0;
    // prior ~ log(n) (optional); keep mild
    ll += Math.log(n + 1);

    const denom = n + 2 * this.alpha;
    for (let k = 0; k < x.length; k++) {
      const p = (st.count1[k] + this.alpha) / denom;
      ll += x[k] ? Math.log(p) : Math.log(1 - p);
    }
    return ll;
  }

  observe(evt: { x: BoolVec; skillId: string; reward: number; success: boolean }): void {
    // update only on success by default (you can also weight by reward)
    if (!evt.success) return;

    const b = this.bucketOf(evt.x);
    let m = this.buckets.get(b);
    if (!m) {
      m = new Map<string, NbSkillState>();
      this.buckets.set(b, m);
    }

    let st = m.get(evt.skillId);
    if (!st) {
      st = { n: 0, count1: new Uint32Array(evt.x.length) };
      m.set(evt.skillId, st);
    }

    st.n += 1;

    // Optional: weight by reward by repeating update; keep skeleton simple.
    for (let k = 0; k < evt.x.length; k++) if (evt.x[k]) st.count1[k] += 1;
  }

  private bucketOf(x: BoolVec): BucketId {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < x.length; i++) {
      const v = (x[i] ? 1 : 0) ^ (i & 1);
      h ^= v;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % this.numBuckets) as BucketId;
  }
}

// ------------------------------------
// Expert 3: Recency bonus (tiny stabilizer)
// ------------------------------------
class RecencyExpert implements Expert {
  name = "recency";
  private scoreBySkill = new Map<string, number>();

  constructor(private params?: { decay?: number; bonusScale?: number }) { }

  logScore(input: { x: BoolVec; root: AstNode; goal: Goal; cand: Candidate }): number {
    const s = this.scoreBySkill.get(input.cand.skill.id) ?? 0;
    return (this.params?.bonusScale ?? 0.2) * s;
  }

  observe(evt: { x: BoolVec; skillId: string; reward: number; success: boolean }): void {
    const decay = this.params?.decay ?? 0.98;
    for (const [k, v] of this.scoreBySkill) this.scoreBySkill.set(k, v * decay);

    const cur = this.scoreBySkill.get(evt.skillId) ?? 0;
    const bump = evt.success ? Math.max(0, evt.reward) : -0.1;
    this.scoreBySkill.set(evt.skillId, cur + bump);
  }
}

// ============================================================================
// LeafNode: MoE over candidates + separation threshold
// ============================================================================

export class MoeLeafNode implements LeafNode {
  public readonly id: NodeId;

  private readonly experts: Expert[];
  private readonly expertWeights: Float64Array; // fixed weights for now
  private lastChosenSkillId: string | null = null;

  private readonly rng: () => number;
  private readonly pMin: number;
  private readonly margin: number;
  private readonly temperature: number;
  private readonly maxCandidates: number;

  constructor(params: {
    id: NodeId;
    experts?: Expert[];                 // if omitted: default set
    expertWeights?: number[];           // same length as experts
    rng?: () => number;
    // separation config
    pMin?: number;                      // default 0.55
    margin?: number;                    // default 0.15
    temperature?: number;               // default 1.0
    maxCandidates?: number;             // default 200
  }) {
    this.id = params.id;
    this.rng = params.rng ?? Math.random;

    this.pMin = params.pMin ?? 0.55;
    this.margin = params.margin ?? 0.15;
    this.temperature = params.temperature ?? 1.0;
    this.maxCandidates = params.maxCandidates ?? 200;

    this.experts = params.experts ?? [
      new TagPriorExpert({ precheckWeight: 0.5 }),
      new NaiveBayesExpert({ numBuckets: 256, alpha: 1, rng: this.rng }),
      new RecencyExpert({ decay: 0.98, bonusScale: 0.2 }),
    ];

    const w = params.expertWeights ?? this.experts.map(() => 1);
    if (w.length !== this.experts.length) throw new Error("MoeLeafNode: expertWeights length mismatch.");
    this.expertWeights = new Float64Array(w);
  }

  chooseSkill(input: {
    x: BoolVec;
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
    skills: SkillDescriptor[];
  }): Choice | null {
    const { x, root, goal, skills } = input;

    const cands = this.buildCandidates(input);
    if (cands.length === 0) return null;

    // Compute combined logits
    const logits = new Float64Array(cands.length);
    for (let i = 0; i < cands.length; i++) {
      let z = 0;
      for (let e = 0; e < this.experts.length; e++) {
        const w = this.expertWeights[e];
        if (w === 0) continue;
        const s = this.experts[e].logScore({ x, root, goal, cand: cands[i] });
        z += w * s;
      }
      logits[i] = z / this.temperature;
    }

    // Convert to probabilities
    const probs = softmaxLogits(logits);

    // Pick best and check separation
    let best = 0, second = -1;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[best]) {
        second = best;
        best = i;
      } else if (second < 0 || probs[i] > probs[second]) {
        second = i;
      }
    }
    const pTop = probs[best];
    const p2 = second >= 0 ? probs[second] : 0;

    const confident = pTop >= this.pMin || (pTop - p2) >= this.margin;

    // If not confident, sample to explore among near-ties (still probabilistic, not arbitrary)
    const idx = confident ? best : sampleCategorical(probs, this.rng);

    const chosen = cands[idx];
    this.lastChosenSkillId = chosen.skill.id;
    return { skill: chosen.skill, focus: chosen.focus };
  }

  observe(input: { x: BoolVec; skillId: string; reward: number; success: boolean }): void {
    // Forward observe to experts that learn
    for (const e of this.experts) e.observe?.(input);
  }

  // -----------------------
  // Candidate generation
  // - For each skill, pick the best focus by precheck score (if available)
  // - This avoids a trained focus chooser.
  // -----------------------
  private buildCandidates(input: {
    x: BoolVec;
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
    skills: SkillDescriptor[];
  }): Candidate[] {
    const { root, goal } = input;

    const foci = input.focusCandidates.length ? input.focusCandidates : [[]];

    const out: Candidate[] = [];

    for (const skill of input.skills) {
      // choose best focus for this skill (or first if no precheck)
      let bestFocus: number[] | null = null;
      let bestPre = Number.NEGATIVE_INFINITY;

      for (const focus of foci) {
        if (!skill.precheck) {
          bestFocus = bestFocus ?? focus;
          bestPre = 0;
          continue;
        }
        const p = skill.precheck({ root, focus, goal });
        if (p <= -1) continue;
        if (p > bestPre) {
          bestPre = p;
          bestFocus = focus;
        }
      }

      if (!bestFocus) continue;
      out.push({ skill, focus: bestFocus });

      if (out.length >= this.maxCandidates) break;
    }

    return out;
  }
}