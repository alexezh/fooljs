import { ChildId, NodeId } from "./hpolicy.js";
import { BoolVec } from "./policy";

// Multiplicative-weights RoutingNode (Hedge/EXP3-ish), bucketed by feature hash.
// - No training set required; learns online from observe(reward).
// - Keeps a probability distribution over childIds per bucket.
// - chooseChild samples from π (optionally with epsilon exploration).
// - observe updates chosen weight: w <- w * exp(eta * reward) and renormalizes lazily.

export interface RoutingNode {
  id: NodeId;
  childIds: ChildId[];

  chooseChild(input: { x: BoolVec }): { childId: ChildId; p: number };

  observe(input: { x: BoolVec; chosenChildId: ChildId; reward: number }): void;
}

type BucketId = number;

type BucketState = {
  // positive weights per child; probabilities are weights / sum(weights)
  w: Float64Array;
  // optional: cache sum for speed
  sumW: number;
};

export class MwRoutingNode implements RoutingNode {
  public readonly id: NodeId;
  public readonly childIds: ChildId[];

  private readonly numBuckets: number;
  private readonly eta: number;
  private readonly epsilon: number;
  private readonly decay: number;     // 0..1 (0 = none). Applied on observe.
  private readonly minWeight: number; // floor to avoid collapse
  private readonly rng: () => number;

  // bucketId -> BucketState
  private readonly buckets = new Map<BucketId, BucketState>();

  // childId -> index in arrays
  private readonly childIndex = new Map<ChildId, number>();

  constructor(params: {
    id: NodeId;
    childIds: ChildId[];
    numBuckets?: number;   // default 256
    eta?: number;          // default 0.2  (learning rate)
    epsilon?: number;      // default 0.02 (random exploration)
    decay?: number;        // default 0.0  (weight decay toward uniform)
    minWeight?: number;    // default 1e-6
    rng?: () => number;    // default Math.random
  }) {
    this.id = params.id;
    this.childIds = [...params.childIds];

    this.numBuckets = params.numBuckets ?? 256;
    this.eta = params.eta ?? 0.2;
    this.epsilon = params.epsilon ?? 0.02;
    this.decay = params.decay ?? 0.0;
    this.minWeight = params.minWeight ?? 1e-6;
    this.rng = params.rng ?? Math.random;

    if (this.childIds.length === 0) throw new Error("MwRoutingNode: childIds must be non-empty.");

    this.childIds.forEach((c, i) => this.childIndex.set(c, i));
  }

  chooseChild(input: { x: BoolVec }): { childId: ChildId; p: number } {
    const b = this.bucketOf(input.x);
    const state = this.getBucket(b);

    const probs = this.computeProbs(state);

    // epsilon-greedy exploration over children
    const useExplore = this.rng() < this.epsilon;
    let idx: number;

    if (useExplore) {
      idx = Math.floor(this.rng() * this.childIds.length);
    } else {
      idx = sampleCategorical(probs, this.rng);
    }

    const childId = this.childIds[idx];
    const p = useExplore
      ? this.epsilon * (1 / this.childIds.length) + (1 - this.epsilon) * probs[idx]
      : (1 - this.epsilon) * probs[idx]; // (approximately) probability mass from exploit path

    return { childId, p };
  }

  observe(input: { x: BoolVec; chosenChildId: ChildId; reward: number }): void {
    const idx = this.childIndex.get(input.chosenChildId);
    if (idx == null) return; // unknown childId, ignore

    const b = this.bucketOf(input.x);
    const state = this.getBucket(b);

    // Optional decay toward uniform (prevents runaway dominance, forgets stale info)
    // w <- (1-decay)*w + decay*1
    if (this.decay > 0) {
      for (let i = 0; i < state.w.length; i++) {
        state.w[i] = (1 - this.decay) * state.w[i] + this.decay * 1.0;
      }
    }

    // Multiplicative update on chosen child
    // w_i <- w_i * exp(eta * reward)
    const mult = Math.exp(this.eta * input.reward);
    state.w[idx] = Math.max(this.minWeight, state.w[idx] * mult);

    // Recompute sumW lazily (here eagerly for simplicity/stability)
    let sum = 0;
    for (let i = 0; i < state.w.length; i++) {
      // enforce floor everywhere to avoid zeros
      if (state.w[i] < this.minWeight) state.w[i] = this.minWeight;
      sum += state.w[i];
    }
    state.sumW = sum;
  }

  // -----------------------
  // Internals
  // -----------------------

  private getBucket(b: BucketId): BucketState {
    const existing = this.buckets.get(b);
    if (existing) return existing;

    // Start uniform weights
    const w = new Float64Array(this.childIds.length);
    for (let i = 0; i < w.length; i++) w[i] = 1.0;

    const st: BucketState = { w, sumW: w.length };
    this.buckets.set(b, st);
    return st;
  }

  private computeProbs(state: BucketState): Float64Array {
    const probs = new Float64Array(state.w.length);
    const denom = state.sumW > 0 ? state.sumW : state.w.length;
    for (let i = 0; i < probs.length; i++) probs[i] = state.w[i] / denom;
    return probs;
  }

  // Simple stable hash of BoolVec -> [0, numBuckets)
  private bucketOf(x: BoolVec): BucketId {
    // FNV-1a-ish over bits
    let h = 2166136261 >>> 0;
    for (let i = 0; i < x.length; i++) {
      // mix in bit and index to reduce collisions for sparse vectors
      const v = (x[i] ? 1 : 0) ^ (i & 1);
      h ^= v;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % this.numBuckets) as BucketId;
  }
}

function sampleCategorical(probs: Float64Array, rng: () => number): number {
  // probs assumed to sum to ~1
  const r = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  // numeric drift fallback
  return probs.length - 1;
}