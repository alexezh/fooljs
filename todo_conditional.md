What you’re asking for is a hierarchical policy tree with backtracking + multiplicative-weights credit assignment.
	•	Tree: balanced, limited depth.
	•	Each internal node: chooses which child policy to descend into (a routing decision).
	•	Leaf: chooses an actual skill (or a small set of skills).
	•	Backtracking: if the chosen path increases cost, roll back and penalize the routing decisions on that path.
	•	No “arbitrary +/- weights”: use probability distributions updated by multiplicative weights / EXP3-style updates (stable, normalized).

This is exactly how you make “we didn’t have samples for sequence, so we chose x+(1+2)… and cost went up” automatically shift probability mass toward the branch that leads to calc_seq.

⸻

1) Balanced policy tree

Think of it like:
	•	Root node routes to: {compute-ish, simplify-ish, solve-ish, normalize-ish, ...}
	•	Next level splits further (e.g. within simplify: {assoc/neutral, factor, fold/sequence, ...})
	•	Leaf emits a skill.

Each node N maintains a distribution π_N(child | features).

To keep it simple and stable with 50 booleans, don’t make routing depend on a big NN. Do:
	•	a small feature projection (top bits / signatures), or
	•	a few buckets of feature vectors (hashing), or
	•	even global π_N first, then later condition on buckets.

⸻

2) Execution with rollback (go back)

During one decision episode:
	1.	Keep a checkpoint stack: (rootAST, costVec) at each step.
	2.	Record the path you took in the policy tree: [nodeId, chosenChildId] for each internal routing decision, plus the leaf chosen skill.

If after applying the selected skill sequence you see cost increased (in any key dimension or overall scalarized), you:
	•	rollback to the last checkpoint, and
	•	issue a negative reward update to all routing decisions along that path.

⸻

3) Multiplicative-weights update (probability, normalized, stable)

For each node N, for the chosen child c:
	•	Maintain weights w_N[c] > 0
	•	Policy is π_N[c] = w_N[c] / Σ_j w_N[j]

Update after observing reward r (positive = good, negative = bad):
	•	w_N[c] ← w_N[c] * exp(η * r_N)
	•	(optional) also apply small decay to all weights or floor to avoid collapse

This is not “arbitrary inc/dec”; it’s a principled probability update, and renormalization is automatic.

Credit assignment along the path: distribute the episode reward across nodes on the path, e.g.
	•	same r for all, or
	•	discounted r * γ^depth, or
	•	use the actual observed Δcost attributed to the subtree of decisions (if you track it).

⸻

4) Your example: why it naturally moves toward calc_seq

Scenario:
	•	Missing samples → routing sends you down “assoc/simplify” branch.
	•	You apply x + (1 + 2) + ... and cost goes up (compute dimension / AST size).
	•	You rollback and give negative reward to the nodes on that path.
	•	Their branch probabilities drop.
	•	Next attempt, root (or mid node) is more likely to route into the “fold/sequence/compute” branch.
	•	That branch eventually selects calc_seq.

No hardwired “sequence before solve”. Just: branches that increase cost get probability mass removed.

⸻

5) Skeleton objects

type CostVec = number[]; // K dims
type BoolVec = boolean[];

type PathEdge = { nodeId: string; childId: string };

interface PolicyNode {
  id: string;
  children: Array<{ id: string; node: PolicyNode }>;
  // leaf has chooseSkill implemented; internal routes only
  chooseChild(input: { x: BoolVec }): { childId: string; p: number };
  observe(input: { x: BoolVec; chosenChildId: string; reward: number }): void;
}

interface LeafPolicy {
  chooseSkill(...): Promise<{ skill: SkillDescriptor; focus: number[] } | null>;
  observe?(...): void;
}

interface TreePolicy extends Policy {
  // the tree contains both routing nodes and leaf policies
}

Routing node implementation is typically:
	•	weights[childId]
	•	probs = normalize(weights)
	•	sample or argmax
	•	update via multiplicative weights.

⸻

6) Two important practical details

A) “Limited depth” + “go back”

Depth limit is easy. “Go back” means: keep a small beam of alternative child choices per node:
	•	if best path fails, try second-best at the highest-impact node first (like backjumping).

B) Conditional distributions without exploding state

If you want routing to depend on features, don’t store w(child | full 50-bit x).
Instead:
	•	hash features into a small bucket id: bucket = hash(x) % B
	•	store weights per bucket: w[bucket][child]
	•	only allocate buckets you actually visit

That gives you conditioning without feature explosion.

⸻

If you want, I can write the concrete skeleton for a BalancedTreePolicy that:
	•	logs the path,
	•	checks cost delta,
	•	rollbacks,
	•	does multiplicative-weights updates on the path,
	•	and retries with backtracking (top-2 children per node).





  Short answer: yes — this pattern absolutely exists in big, serious systems, but it rarely appears under one name. It shows up as a composite of well-known techniques across search, planning, RL, and compilers.

What you’ve described is not exotic — it’s actually a convergent architecture people rediscover when they try to control complex symbolic systems with learning and rollback.

Below I’ll map your idea to concrete, well-known systems and lineages, so you can sanity-check that you’re not inventing something weird.

⸻

1. Where this already exists (under different names)

A) Monte Carlo Tree Search (AlphaGo / AlphaZero lineage)

Used at Google DeepMind (large-scale, production-grade research systems)

Your design:
	•	Tree of policies ✔
	•	Probabilities over branches ✔
	•	Backtracking / rollback ✔
	•	Penalize bad branches, reinforce good ones ✔

Mapping:
	•	Your policy tree = MCTS tree
	•	Your multiplicative weights = PUCT / softmax over visit counts
	•	Your cost increase rollback = negative rollout value
	•	Your feature vector = board representation / state embedding

Difference:
	•	MCTS uses random rollouts or value nets; you use symbolic cost deltas
	•	MCTS learns structure via simulation; you learn via rewrite traces

Conceptually identical control structure.

⸻

B) Hierarchical Reinforcement Learning (Options / MAXQ)

Used at DeepMind, OpenAI, robotics stacks

Your design:
	•	Skills = options ✔
	•	Learned composition of skills ✔
	•	Hierarchical control ✔
	•	Credit assignment through hierarchy ✔

Mapping:
	•	Your macro skills = options
	•	Your policy tree = option hierarchy
	•	Your backtracking = termination + re-selection
	•	Your multiplicative updates = policy gradient / bandit updates

This is standard HRL — except your “environment” is an AST, not a robot.

⸻

C) Online Learning / Multiplicative Weights (EXP3, Hedge)

Used everywhere: ad serving, routing, auctions, load balancing

Your update rule:

w ← w * exp(η * reward)

This exact mechanism is used in:
	•	Google Ads bandits
	•	Routing / congestion control
	•	Portfolio selection
	•	Algorithm selection frameworks

You’re applying it to rewrite strategy selection, which is unusual, but the math is standard.

⸻

D) SAT/SMT Solvers (Conflict-Directed Backjumping)

Used in Z3, CVC5, industrial verification tools

Your design:
	•	Try a branch ✔
	•	Cost / conflict increases ✔
	•	Roll back ✔
	•	Penalize decision heuristics ✔
	•	Learn to avoid similar paths ✔

Mapping:
	•	Your rollback = backjump
	•	Your cost delta = conflict signal
	•	Your probability shift = VSIDS-like heuristic decay
	•	Your feature induction = learned clauses

This is very close philosophically.

⸻

E) Compilers & Superoptimizers

Used at Google, Meta, LLVM ecosystem

Examples:
	•	LLVM’s ML-guided inlining
	•	STOKE superoptimizer
	•	e-graph extraction (egg)

Common pattern:
	•	Tree of transformations
	•	Cost model
	•	Backtracking when cost worsens
	•	Learned heuristics guiding which rewrite to try

Your system is basically a generalized, learnable rewrite optimizer.

⸻

2. Why you don’t see it written exactly like this

Because it lives at the intersection of fields:

Field	Calls it
RL	Hierarchical policy / options
Online learning	Multiplicative weights
Search	MCTS / beam search
SAT/SMT	Heuristic backtracking
Compilers	Rewrite cost models
Theorem proving	Tactic selection

You’ve fused them — which is why it feels new.

⸻

3. What is novel in your formulation

These parts are genuinely rare together:
	1.	Symbolic axioms + learned skill composition
	2.	Explicit K-dim cost vector (not scalar reward)
	3.	Feature induction driven by confusion between skills
	4.	Probabilistic routing + deterministic rollback
	5.	No monolithic NN — everything interpretable

This is closer to Lean / Coq tactic learning than to mainstream RL.

⸻

4. Reality check: is this “safe to build”?

Yes. In fact:
	•	It’s more stable than NN-heavy systems.
	•	It degrades gracefully with little data.
	•	Every decision is inspectable.
	•	You can start with depth-2 tree and grow.

The biggest risk is engineering complexity, not theory.

⸻

5. One-sentence summary

What you’re building is essentially an online-learned, hierarchical rewrite planner with backtracking, using multiplicative-weights bandits for control — a pattern that underlies MCTS, HRL, SMT solvers, and compiler optimizers, even if no one names it exactly this way.

If you want, next I can:
	•	sketch a minimal viable depth-2 tree you could implement in ~200 LOC, or
	•	map this exactly onto MCTS terminology to sanity-check convergence properties, or
	•	help you decide where to stop (what not to learn, to keep it sane).