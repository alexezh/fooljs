Yep — you’re describing a feature-induction loop (like decision-tree splits / boosting), but with:
	•	boolean feature vectors that may be incomplete,
	•	probabilistic selection,
	•	and an LLM-assisted “invent a new feature” step only when two skills are consistently confusable.

Here’s a clean way to structure it without hardwiring, and without feature explosion.

⸻

Core idea
	1.	For each skill i, maintain a prototype / summary over samples where it worked:

	•	P(f_k = 1 | skill=i) and P(f_k = 0 | skill=i) (smoothed)
	•	plus usage stats

	2.	When policy struggles (skills i and j both plausible), detect persistent confusion pairs.
	3.	Only after N samples for each (and enough confusion events), ask an LLM to propose one candidate boolean feature that separates them.
	4.	Gate feature creation by measured separation gain (information gain / likelihood ratio improvement) and budget (max features per week/run).
	5.	Regularly prune / down-weight features that don’t help.

This is basically: “learn features to make the classifier simpler”, rather than “tuning weights forever”.

⸻

Data you maintain (minimal, stable)

A) Skill statistics (per skill)

For each skill i:
	•	n_i: number of successful samples
	•	count1_i[k]: how often feature k was 1 when skill i succeeded
	•	(optional) rewardMean_i, etc.

From this you can get a stable “weight-ish” vector without arbitrary drift:
	•	p_i[k] = (count1_i[k] + α) / (n_i + 2α) (Beta prior)

Then a simple separation score between skill i and j for feature k:
	•	sep(i,j,k) = |p_i[k] - p_j[k]|

This gives you your “most significant bits” idea, but probabilistic.

B) Confusion matrix (pairwise)

Track when policy is uncertain between i and j:
	•	confuse[i,j]++ when P(i|x) and P(j|x) are both high (or top-2 are close)
	•	store a small reservoir of the hard examples (feature vectors + maybe AST snippets/focus)

⸻

When to trigger “invent a new feature”

Trigger only if ALL true:
	•	n_i >= N_min and n_j >= N_min
	•	confuse[i,j] >= C_min
	•	current features cannot separate:
	•	e.g. max_k sep(i,j,k) < sep_threshold
	•	and feature budget not exceeded:
	•	newFeaturesThisEpoch < B

This prevents explosion.

⸻

What LLM should do (and what it should not)

LLM’s job: propose a new boolean predicate feature_new(ast, focus, goal) -> bool that’s likely to separate i vs j, using:
	•	the textual description of the two skills (match patterns + tags + where predicates),
	•	a few confusing examples (AST snippets / canonical strings),
	•	and your existing feature set (to avoid proposing duplicates).

LLM should output:
	•	name
	•	definition in your predicate DSL or pseudo-code
	•	which subtree it examines (root vs focus)
	•	why it separates (one paragraph)

Then your system:
	•	implements it (or compiles from DSL),
	•	evaluates on stored samples,
	•	keeps it only if it improves separation.

⸻

How to “reduce weight” of rarely useful features

Don’t manually “reduce weights”. Just do feature selection by utility:
	•	compute global usage: how often feature appears AND influences a decision
	•	compute information contribution: average |logit_with_feature - logit_without_feature| or IG
	•	prune features with:
	•	low usage AND low contribution for M epochs
	•	or apply decay to counts so stale correlations fade:
	•	count1_i[k] *= (1 - decay) periodically

This is stable and doesn’t require arbitrary negative updates.

⸻

Skeleton of the loop

// --- stable stats, no drifting weights ---
interface SkillStats {
  n: number;
  count1: Uint32Array; // length = numFeatures
  // optional: rewardMean, etc.
}

interface ConfusionStore {
  // symmetric key "i|j"
  count: Map<string, number>;
  hardExamples: Map<string, { x: boolean[]; meta?: any }[]>; // reservoir per pair
}

interface FeatureDef {
  id: string;
  name: string;
  // compiled predicate (root/focus/goal -> boolean)
  eval: (args: { root: AstNode; focus: number[]; goal: Goal }) => boolean;
}

interface FeatureInducer {
  maybeProposeNewFeature(input: {
    skillA: SkillDescriptor;
    skillB: SkillDescriptor;
    examples: { x: boolean[]; meta?: any }[];
    existingFeatures: FeatureDef[];
  }): Promise<{ name: string; spec: string } | null>; // LLM output
}

interface FeatureGate {
  shouldAdd(input: {
    candidate: FeatureDef;
    skillAId: string;
    skillBId: string;
    // cached samples for A/B
    samplesA: boolean[][];
    samplesB: boolean[][];
  }): boolean;
}

class TraceDrivenFeatureLoop {
  constructor(
    private stats: Map<string, SkillStats>,
    private confusion: ConfusionStore,
    private inducer: FeatureInducer,
    private gate: FeatureGate,
    private featureBudget: { perEpoch: number; minSamplesPerSkill: number; minConfusions: number }
  ) {}

  observeDecision(evt: {
    x: boolean[];
    chosenSkillId: string;
    success: boolean;
    // optional: top2 for confusion
    top2?: [string, string];
    meta?: any;
  }) {
    // 1) update stats for chosen skill on success
    // 2) update confusion counts if ambiguous (top2 close)
    // 3) add hard example to reservoir
  }

  async maybeInduce(features: FeatureDef[], skillsById: Map<string, SkillDescriptor>) {
    // 1) find worst confusion pair (i,j) meeting thresholds
    // 2) confirm existing features can't separate well
    // 3) ask LLM for a new feature predicate
    // 4) compile candidate, evaluate on stored samples
    // 5) if gate approves, add feature (and extend all stats vectors)
  }
}


⸻

Why this matches what you want
	•	No hardwired lexicographic rules
	•	No “arbitrary weight drift”: you’re using smoothed probabilities / counts + confidence
	•	Feature incompleteness becomes a signal: persistent confusion triggers feature invention
	•	Controlled growth: only after N samples each + confusion threshold + budget
	•	Feature pruning: remove/decay features that don’t contribute

If you want one concrete choice inside this framework: use Naive Bayes per skill-family for the probabilistic policy, because it naturally uses P(f|skill) counts and gives you exactly the separation stats (p_i[k]) you need for feature induction.