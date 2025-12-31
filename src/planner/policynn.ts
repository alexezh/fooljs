import { AstNode } from "../ast.js";
import { Runtime } from "../runtime.js";
import { SkillDescriptor } from "../skilldescriptor.js";
import { BoolVec, FeatureFn } from "./featurefn.js";
import { Goal } from "./plannercore.js";
import { Choice, Policy } from "./policy.js";
import { Clause, ClauseId, Verb, VerbId } from "./verb.js";

// ============================================================
// Small NN utilities (linear + softmax + REINFORCE update)
// ============================================================

function boolToFloat(x: BoolVec): Float64Array {
  const v = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) v[i] = x[i] ? 1 : 0;
  return v;
}

function softmax(logits: Float64Array, temperature = 1): Float64Array {
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logits.length; i++) {
    const z = logits[i] / temperature;
    if (z > max) max = z;
  }
  let sum = 0;
  const exps = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] / temperature - max);
    exps[i] = e;
    sum += e;
  }
  if (sum <= 0) {
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

// ============================================================
// RoutingNodeNN: chooses among K children (categories)
// z = W^T x + b, pi = softmax(z)
// REINFORCE update: W += lr*(adv)* x*(onehot(a)-pi)^T
// ============================================================

export class RoutingNodeNN {
  readonly id: string;
  readonly children: (RoutingNodeNN | LeafNodeNN)[];

  private readonly N: number;
  private readonly K: number;

  private readonly W: Float64Array; // shape (N*K) row-major: W[n*K + k]
  private readonly b: Float64Array; // shape (K)

  private readonly lr: number;
  private readonly temperature: number;
  private readonly rng: () => number;

  private baseline = 0;           // running reward baseline
  private baselineDecay: number;  // e.g. 0.01

  constructor(params: {
    id: string;
    children: (RoutingNodeNN | LeafNodeNN)[];
    featureDim: number;     // N
    lr?: number;            // default 0.05
    temperature?: number;   // default 1.0
    baselineDecay?: number; // default 0.01
    rng?: () => number;
  }) {
    this.id = params.id;
    this.children = [...params.children];
    this.N = params.featureDim;
    this.K = this.children.length;

    this.lr = params.lr ?? 0.05;
    this.temperature = params.temperature ?? 1.0;
    this.baselineDecay = params.baselineDecay ?? 0.01;
    this.rng = params.rng ?? Math.random;

    this.W = new Float64Array(this.N * this.K);
    this.b = new Float64Array(this.K);

    // small random init
    for (let i = 0; i < this.W.length; i++) this.W[i] = (this.rng() - 0.5) * 0.01;
    for (let k = 0; k < this.K; k++) this.b[k] = 0;
  }

  forward(xBool: BoolVec): { probs: Float64Array; logits: Float64Array } {
    const x = boolToFloat(xBool);
    const logits = new Float64Array(this.K);

    for (let k = 0; k < this.K; k++) {
      let z = this.b[k];
      for (let n = 0; n < this.N; n++) z += x[n] * this.W[n * this.K + k];
      logits[k] = z;
    }

    const probs = softmax(logits, this.temperature);
    return { probs, logits };
  }

  chooseChild(xBool: BoolVec): { child: (RoutingNodeNN | LeafNodeNN); index: number; prob: number; probs: Float64Array } {
    const { probs } = this.forward(xBool);
    const idx = sampleCategorical(probs, this.rng);
    return { child: this.children[idx], index: idx, prob: probs[idx], probs };
  }

  observe(input: { x: BoolVec; chosenIndex: number; reward: number; probs: Float64Array }) {
    // advantage
    this.baseline = (1 - this.baselineDecay) * this.baseline + this.baselineDecay * input.reward;
    const adv = input.reward - this.baseline;

    const x = boolToFloat(input.x);
    const a = input.chosenIndex;
    const pi = input.probs;

    // Gradient ascent on log pi(a|x)
    // d/dW[n,k] log pi(a) = x[n] * (1{k=a} - pi[k])
    for (let n = 0; n < this.N; n++) {
      const xn = x[n];
      if (xn === 0) continue;
      for (let k = 0; k < this.K; k++) {
        const grad = xn * ((k === a ? 1 : 0) - pi[k]);
        this.W[n * this.K + k] += this.lr * adv * grad;
      }
    }
    // bias update
    for (let k = 0; k < this.K; k++) {
      const gradb = (k === a ? 1 : 0) - pi[k];
      this.b[k] += this.lr * adv * gradb;
    }
  }
}

// ============================================================
// LeafNodeNN: chooses among skills in a selected category
// For simplicity, we implement as one shared leaf over all skills,
// but we mask by category if you want.
// ============================================================

export class LeafNodeNN {
  readonly id: string;

  private readonly N: number;

  // Skills are dynamic in your system; we keep an index map built at choose time.
  // We store a weight vector per skillId (linear policy).
  private readonly WByChoice = new Map<ClauseId | VerbId, Float64Array>(); // each is length N
  private readonly bByChoice = new Map<ClauseId | VerbId, number>();

  private readonly lr: number;
  private readonly temperature: number;
  private readonly rng: () => number;

  private baseline = 0;
  private baselineDecay: number;

  constructor(params: {
    id: string;
    featureDim: number;     // N
    lr?: number;            // default 0.05
    temperature?: number;   // default 1.0
    baselineDecay?: number; // default 0.01
    rng?: () => number;
  }) {
    this.id = params.id;
    this.N = params.featureDim;
    this.lr = params.lr ?? 0.05;
    this.temperature = params.temperature ?? 1.0;
    this.baselineDecay = params.baselineDecay ?? 0.01;
    this.rng = params.rng ?? Math.random;
  }

  private ensureChoice(choice: ClauseId | VerbId) {
    if (!this.WByChoice.has(choice)) {
      const w = new Float64Array(this.N);
      for (let i = 0; i < w.length; i++) w[i] = (this.rng() - 0.5) * 0.01;
      this.WByChoice.set(choice, w);
      this.bByChoice.set(choice, 0);
    }
  }

  forward(xBool: BoolVec, choices: (Verb | Clause)[]): { probs: Float64Array; logits: Float64Array } {
    const x = boolToFloat(xBool);
    const logits = new Float64Array(choices.length);

    for (let i = 0; i < choices.length; i++) {
      const sid = choices[i].id;
      this.ensureChoice(sid);
      const w = this.WByChoice.get(sid)!;
      const b = this.bByChoice.get(sid)!;

      let z = b;
      for (let n = 0; n < this.N; n++) z += x[n] * w[n];
      logits[i] = z;
    }

    const probs = softmax(logits, this.temperature);
    return { probs, logits };
  }

  chooseSkill(xBool: BoolVec, choices: (Verb | Clause)[]): { choice: Verb | Clause; index: number; prob: number; probs: Float64Array } | null {
    if (choices.length === 0) return null;
    const { probs } = this.forward(xBool, choices);
    const idx = sampleCategorical(probs, this.rng);
    return { choice: choices[idx], index: idx, prob: probs[idx], probs };
  }

  observe(input: {
    x: BoolVec;
    chosenIndex: number;
    choices: (Clause | Verb)[];
    reward: number;
    probs: Float64Array;
  }) {
    if (input.choices.length === 0) return;

    this.baseline = (1 - this.baselineDecay) * this.baseline + this.baselineDecay * input.reward;
    const adv = input.reward - this.baseline;

    const x = boolToFloat(input.x);
    const a = input.chosenIndex;
    const pi = input.probs;

    // We only update skills present in this masked set (the candidate list).
    for (let i = 0; i < input.choices.length; i++) {
      const sid = input.choices[i].id;
      this.ensureChoice(sid);

      const w = this.WByChoice.get(sid)!;
      const b = this.bByChoice.get(sid)!;

      // grad log pi(a) w.r.t. logits: (1{i=a} - pi[i])
      const g = (i === a ? 1 : 0) - pi[i];

      // w += lr * adv * g * x
      for (let n = 0; n < this.N; n++) {
        if (x[n] === 0) continue;
        w[n] += this.lr * adv * g * x[n];
      }

      // bias update
      this.bByChoice.set(sid, b + this.lr * adv * g);
    }
  }
}

// ============================================================
// PolicyNN: RoutingNodeNN + LeafNodeNN
// - Router selects a category child
// - Leaf selects a skill (optionally filtered by category)
// - Focus selection: purely model-free here (pick first focus candidate)
//   (you can add a FocusLeafNN later if you want)
// ============================================================

type Trace = {
  x: BoolVec;
  goal: Goal;

  // router
  routeChildId: string;
  routeIndex: number;
  routeProbs: Float64Array;

  // leaf (masked candidates)
  leafChoices: (Verb | Clause)[];
  leafIndex: number;
  leafProbs: Float64Array;

  chosen: Choice;
};

export class PolicyNN<TElem extends Verb | Clause> implements Policy<TElem> {
  private lastTrace: Trace | null = null;

  constructor(
    private fx: FeatureFn,
    private choices: TElem[],
    private router: RoutingNodeNN,
    private leaf: LeafNodeNN
  ) { }

  async choose(input: {
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
  }): Promise<{ choice: TElem; focus: number[] } | null> {
    const x = this.fx.extract(input.root, input.goal);

    // 1) Route
    const r = this.router.chooseChild(x);
    const routeChild = r.child;

    // 2) Candidate skills (optionally masked by route)
    const leafChoices = this.choices;

    // 3) Leaf picks skill
    const leafPick = this.leaf.chooseSkill(x, leafChoices);
    if (!leafPick) return null;

    // 4) Focus (kept simple; still “model owns choice of skill”)
    const focus = input.focusCandidates[0] ?? [];

    const choice: Choice = { choice: leafPick.choice, focus };

    // Save trace for observe()
    this.lastTrace = {
      x,
      goal: input.goal,
      routeChildId: routeChild.id,
      routeIndex: r.index,
      routeProbs: r.probs,
      leafChoices: leafChoices,
      leafIndex: leafPick.index,
      leafProbs: leafPick.probs,
      chosen: choice,
    };

    return choice as unknown as { choice: TElem; focus: number[] };
  }

  observe(evt: {
    rootBefore: AstNode;
    rootAfter: AstNode;
    goal: Goal;
    chosen: Choice;
    reward: number;
    success: boolean;
  }): void {
    const t = this.lastTrace;
    if (!t) return;

    // Basic safety: only learn if the observed choice matches the last issued choice
    // (if your orchestrator can interleave, add an id)
    if (t.chosen.choice.id !== evt.chosen.choice.id) return;

    // REINFORCE updates on router and leaf
    this.router.observe({
      x: t.x,
      chosenIndex: t.routeIndex,
      reward: evt.reward,
      probs: t.routeProbs,
    });

    this.leaf.observe({
      x: t.x,
      chosenIndex: t.leafIndex,
      choices: t.leafChoices,
      reward: evt.reward,
      probs: t.leafProbs,
    });

    this.lastTrace = null;
  }
}