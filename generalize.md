Concise spec: Generalization rules for combining solution macros

Definitions
	•	Step: (verb, body) applied to a state.
	•	Macro: an ordered list of steps M = [s1…sn].
	•	Trace: executed macro with concrete bindings (used as evidence).
	•	Generalized macro: a macro template with parameters, guards, loops, or branches.

Normalization (mandatory pre-pass)

Before any comparison/generalization:
	1.	Alpha-normalize pattern variables in every step body (names don’t matter).
	2.	Canonicalize bodies (whitespace, ordering of commutative predicates, etc.).
	3.	Optionally canonicalize associative forms if your system treats them as such (e.g., flatten sum).

⸻

Generalization operators

G1. Anti-unification

Given two macros A, B, compute the least-general template that matches both:
	•	Same verb at position i ⇒ keep verb.
	•	Bodies unify ⇒ keep unified body; mismatches become holes (params).
	•	If verbs differ but are semantically the same class (optional mapping) ⇒ lift to shared verb, defer to clause selection.

Output: Template + parameter constraints.

G2. Common prefix/suffix factoring

If A = P + A' + S and B = P + B' + S with maximal P,S:
Return: P; choice(A' | B'); S

G3. Guarded branching

If A and B apply under distinguishable predicates:
Return: if guard(state) then A else B
Guards must be:
	•	decidable from features/predicates
	•	mutually exclusive or ordered by priority

G4. Loop generalization

If a contiguous subsequence repeats (X repeated k times) across traces:
Return: repeat X until stop_predicate
Stop predicate must be:
	•	monotone under X (eventually terminates)
	•	computable from state

G5. Subgoal boundary extraction

If both macros reach a shared invariant state I:
Return: toInvariant(I); fromInvariant(I)
Where:
	•	toInvariant is generalized from prefixes
	•	fromInvariant is generalized from suffixes

G6. Abstraction lift (sequence → derived operator)

If a step sequence Q appears in ≥2 macros and improves a metric:
Create new macro-step derived_op(Q) replacing Q.
Must preserve semantics and reduce plan length.

G7. Canonicalization-first

If A differs from B only by surface form:
Return: canonicalize; A (or canonicalize; B)
Canonicalize must be semantics-preserving and reduce divergence.

⸻

Constraints / acceptance tests

A proposed generalized macro G is accepted iff:
	1.	Coverage: Replays successfully on all source traces (or their AST-equivalent inputs).
	2.	Progress: Does not reduce progress metric vs originals (e.g., complexity decreases, distance-to-goal not worse).
	3.	Specificity: No unnecessary holes/branches:
	•	Prefer fewer parameters
	•	Prefer fewer branches
	4.	Safety: Guards and stop predicates are checkable; loops terminate on verify set.
	5.	Stage gating: If gen stage forbids varargs/advanced helpers, G must not introduce them.

⸻

Output form

Generalization returns a MacroPlan:

type MacroPlan =
  | { kind: "seq"; steps: Step[] }
  | { kind: "choice"; alts: MacroPlan[]; guard?: Predicate }
  | { kind: "repeat"; body: MacroPlan; until: Predicate }
  | { kind: "call"; name: string; params?: any };

This is the only allowed composition vocabulary: seq / choice / repeat / call.

That’s the compact rule set: normalize → (anti-unify | factor | branch | loop | subgoal) → optionally lift to derived op → accept by tests.