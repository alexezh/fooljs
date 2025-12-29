# Design Pattern

Rule = single local rewrite: Expr -> Expr with guards/constraints. Cheap, composable, no opinion about “when”.

Skill = named strategy (a function) that runs a sequence + choice over rules (and maybe calls other skills). I.e. State -> State? (Kleisli-ish) where failure is allowed and backtracking is expected.

Such as the body for skill "solve equation" is defined as:

   solve(eq(?lhs, ?rhs)) => do
      eq(?lhs, ?rhs) => eq(sub(?lhs, ?rhs), 0)
      eq(sub(?a, ?b), 0) => eq(sum(?a, neg(?b)), 0)
      eq(sum(?terms...), 0) => eq(group_same(sum(?terms...), ?x), 0)
      eq(sum(?t, ?c), 0) => eq(?t, neg(?c))
      eq(sum(?terms...), ?b) => 
         eq(mul(?x, sum(?qs...)), ?b)
         where map_div_by_x([?terms...], ?x) => [?qs...]
      eq(mul(?x, ?k), ?b) => eq(?x, div(?b, ?k))
      eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k))
      eq(?x, ?rhs) => eq(?x, eval(?rhs))
      eq(?x, ?rhs) => ?rhs

=== Spec: $ (match root) and tag(...)

1) Occurrence and match environment
	•	When a rewrite rule’s LHS matches, it produces an occurrence (p, σ):
	•	p is the position (path) of the matched subtree in the subject term.
	•	σ is the substitution for pattern variables.
	•	The rule body (RHS, where[...], and do[...]) is evaluated under a match environment Env that includes:
	•	σ (pattern var bindings)
	•	a distinguished value $, defined below.

2) $ meaning
	•	$ denotes the root node of the matched occurrence, i.e. the subtree subterm(subject, p) as it exists at the moment the rule is applied.
	•	$ is available in:
	•	RHS templates
	•	where[...] predicates
	•	do[...] blocks (including nested do)

3) Child selection: $[i]
	•	$[i] denotes the i-th child of $ using a fixed indexing convention.
	•	Indexing convention must be specified by the language. Pick one and make it global:
	•	0-based: $[0] is first child
	•	If $[i] is out of bounds, $[i] is invalid and any predicate using it is false, and any action using it is a no-op (or a match failure—choose one; recommend “predicate false / action no-op” for robustness).

4) $ inside do[...]

do[...] is a sequence of steps evaluated left-to-right. Define two kinds of steps: directives/actions and rewrites.

4.1 $ binding is stable per outer rule application
	•	$ is bound once when the outer rule matches.
	•	$ continues to refer to the occurrence root position of that outer match, even as the overall term changes.

4.2 $ value is live (recommended)

To avoid confusing “stale pointers”, define $ as live at its position:
	•	After each successful rewrite within do[...], $ is interpreted as “the current subtree at the original occurrence position”.
	•	If a rewrite replaces the occurrence root itself, then $ becomes that replaced node (the new subtree at that position).
	•	If a rewrite removes the occurrence root position (rare; e.g. whole-term replacement), then $ becomes invalid and tag/predicate operations referencing it behave as in §3 (false/no-op).

4.3 Nested rewrites inside do[...] get their own $
	•	When a rewrite step inside do[...] matches a subtree, that inner rewrite has its own match root $ for that rewrite only.
	•	This inner $ shadows the outer $ only within that rewrite’s RHS/where evaluation.
	•	Outside that rewrite step, $ refers again to the outer rule’s $.

This gives a simple rule:
	•	$ always means “match root of the current rewrite being evaluated.”

5) Tags

Each node has an annotation map Tags(node): Map<string, TagValue>.

5.1 Tag values
	•	TagValue is one of: bool | number | string | sym | small_record
	•	Equality in where[...] uses structural equality for simple scalars; for records, define either structural equality or forbid equality and require tag_has_key(...) + projections.

5.2 Tag visibility
	•	Tags are readable in where[...] and writable via actions in RHS/do[...].
	•	Tags do not affect pattern matching unless explicitly referenced by predicates.

6) Tag primitives

6.1 Predicates (usable in where[...])
	•	has_tag(nodeExpr, key: string) -> bool
	•	tag_eq(nodeExpr, key: string, valueExpr) -> bool
	•	tag_get(nodeExpr, key: string) -> TagValue | null (optional; if you allow value comparisons without tag_eq)
	•	tag_in(nodeExpr, key: string, setExpr) -> bool (optional convenience)

nodeExpr may be $, $[i], or a bound pattern variable that denotes a node.

6.2 Actions (usable in RHS / do[...])
	•	tag(nodeExpr, key: string, valueExpr) -> unit
	•	Sets Tags(nodeExpr)[key] = valueExpr.
	•	untag(nodeExpr, key: string) -> unit
	•	Removes key from Tags(nodeExpr) if present.
	•	clear_tags(nodeExpr, prefix?: string) -> unit (optional)
	•	Removes all tags, or tags with a prefix.

If nodeExpr is invalid (e.g., $[i] out of range), actions are no-ops.

7) Persistence and scope of tags

You need one explicit rule so debugging stays sane:
	•	Tags are ephemeral by default: they persist for the duration of the current rewrite “episode” (e.g., one solve attempt), and may be cleared when control returns to the outer dispatcher / skill detection cycle.
	•	If you want tags to survive across episodes, require a namespace or qualifier:
	•	tag($, "tmp.picked", true) ephemeral
	•	tag($, "persist.picked", true) persistent

(Exact lifecycle is up to you, but the language should distinguish temporary vs persistent tags so rules don’t silently depend on leftover state.)

8) Example patterns using $

Mark the matched equation node inside solve

solve(eq(?lhs, ?rhs), solved_for(?x)) => do[
  tag($[0], "tmp.picked_eq", true),
  $
]

Only rewrite the marked equation

eq(sum(?t, ?c), 0)
  where [has_tag($, "tmp.picked_eq"), is_num(?c)]
  =>
  eq(?t, neg(?c))

If you want, I can add one more clause: whether $[i] can appear on the LHS (as a pattern anchor) or only in where/RHS; both are workable, but the spec above keeps $ as an evaluation-time reference (simpler).