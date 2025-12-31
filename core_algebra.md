Great — here’s a small, fixed, planner-level verb vocabulary that works well for algebra and simplification, without collapsing into A ⇒ B detail. These are meta-actions, not skills or rules.

I’ll group them by intent and explain what each verb means to the planner, not how it rewrites.

⸻

Core Algebra / Equation-Solving Verbs (≈15)

1. normalize

Intent: Put an expression or equation into a canonical, comparable form.
Typical effects: flatten sums/products, reorder terms, standardize signs.

Planner uses this when structure matters more than value.

⸻

2. collect

Intent: Group like terms or factors.
Effects: reduces term count, exposes coefficients or common factors.

e.g. collect powers of x, constants, repeated subterms.

⸻

3. expand

Intent: Remove products over sums.
Effects: increases size but exposes polynomial structure.

Used only when analysis requires visibility (degree detection, collection).

⸻

4. factor

Intent: Introduce structure by pulling out common factors or patterns.
Effects: exposes roots, cancels terms, enables zero-product reasoning.

Includes “factor common”, “factor polynomial”, but planner doesn’t care which.

⸻

5. move

Intent: Relocate terms across an equation boundary.
Effects: concentrates variables, simplifies one side.

Planner-level: “move non-x terms to RHS”, not “add −c to both sides”.

⸻

6. isolate

Intent: Reduce the equation to a single occurrence of the target variable.
Effects: narrows focus, prepares for final solve.

Works for linear, quadratic (after factor), rational, etc.

⸻

7. eliminate

Intent: Remove a structural obstacle.
Effects: removes fractions, parentheses, denominators, negations.

Examples: eliminate fraction, eliminate denominator, eliminate nested sum.

⸻

8. reduce

Intent: Simplify without changing structure category.
Effects: constant folding, cancel factors, shrink AST.

The “do obvious cleanup” verb.

⸻

9. classify

Intent: Determine the problem type.
Effects: selects downstream strategy.

linear / quadratic / rational / polynomial / series / product-zero.

⸻

10. substitute

Intent: Replace a subexpression with an equivalent one.
Effects: enables simplification or factoring.

Often paired with symmetry or pattern reuse.

⸻

11. split

Intent: Branch the problem into independent cases.
Effects: introduces disjunctions.

e.g. zero-product rule, domain cases, absolute values.

⸻

12. evaluate

Intent: Compute a known finite value.
Effects: collapses expressions to constants.

arithmetic series, numeric sums, coefficients.

⸻

13. check

Intent: Validate candidate solutions.
Effects: prune invalid roots (domain, extraneous solutions).

Critical for rational equations.

⸻

14. finish

Intent: Recognize goal satisfaction and stop.
Effects: commits solution.

eq(x, c), set of roots, or contradiction.

⸻

15. reframe (optional but powerful)

Intent: Change representation without solving.
Effects: turns equation into product, polynomial into series, etc.

Example: reframe sum of k(1+x) as (1+x)·Σk.

⸻

Why these verbs work
	•	They are stable across domains (linear → quadratic → rational → series).
	•	Each verb maps to many possible DSP rewrites.
	•	They support multi-objective progress (size ↓, degree exposed, variables isolated).
	•	They align perfectly with your idea of meta-planning + late binding.

⸻

Example plan using only these verbs

For
(1+x) + 2(1+x) + ... + 1000(1+x) = 0

normalize
collect
factor
evaluate
split
finish

No rewrite mentioned. No syntax. Just intent.

⸻

Mental model (important)
	•	Verbs are “why”
	•	Rules are “how”
	•	Planner speaks verbs
	•	Executor speaks A ⇒ B

If you want next, I can:
	•	map each verb → progress metrics (what improves when you apply it), or
	•	show how this becomes a clean multi-objective MCTS over verb sequences (very close to what you were circling earlier).



  Here are 10 “entity types” those ~15 algebra verbs typically apply to (planner-level), i.e. what your target usually is:
	1.	Equation (eq(lhs,rhs))
	2.	Expression (generic subtree)
	3.	Sum / Additive group (sum(...), linear combination)
	4.	Product / Multiplicative group (mul(...))
	5.	Power / Degree term (pow(base, exp) / monomial)
	6.	Fraction / Rational form (div(a,b) / frac(a,b))
	7.	Constant / Number (numeric literal, arithmetic-only subtree)
	8.	Variable / Symbol (x, y)
	9.	Substitution / Definition (a binding like let u = ... or “replace pattern”)
	10.	Solution set / Constraint (roots list, domain restriction like x != -3)

If you encode verb + target, a simple clean feature basis is:
	•	target_kind ∈ {eq, expr, sum, mul, pow, frac, num, sym, binding, constraint}

Want a more “human” version (same list, different names): statement, chunk, group-add, group-mul, term, ratio, value, name, alias, rule/constraint.

==========================================
foci.

Ah — selectors / foci, not tests.
So: “what part(s) of the expression can a human point at?”
These are navigation / focus primitives, orthogonal to predicates.

Below is a compact, human-like focus vocabulary you can encode as selectors.

⸻

Core focus entities (structural)

These are where attention goes, independent of meaning.
	1.	self
→ the whole expression / equation
	2.	lhs / rhs
→ sides of an equation
	3.	term
→ one additive term in a sum
	4.	factor
→ one multiplicative factor in a product
	5.	argument
→ direct child of an operator
(sum arg, mul arg, function arg)
	6.	numerator / denominator
→ parts of a fraction
	7.	base / exponent
→ parts of a power

⸻

Positional / indexing foci

How humans pick which one.
	8.	first / last
→ first term, last factor, etc.
	9.	nth(k)
→ k-th argument / term
	10.	every(k)
→ every k-th element
(every second term, every other factor)
	11.	range(i, j)
→ contiguous slice of arguments

⸻

Group / collection foci

Used constantly in algebra.
	12.	all
→ all terms / all factors / all args
	13.	rest
→ everything except a focused subset
(“factor out x from the rest”)
	14.	matching(pattern)
→ all subparts with same structural role
(e.g., all x terms)
	15.	common
→ intersection-like focus
(common factor, common term)

⸻

Semantic-lite foci (still not predicates)

These are views, not checks.
	16.	constants
	17.	variables
	18.	coefficients
	19.	powers
	20.	subexpressions

(These don’t ask if something is constant — they select the constant slots.)

⸻

Example (pure focus, no predicates)

“factor (1+x) from
(1+x) + 2(1+x) + … + 1000(1+x)”

focus: terms.all
then: factor.common

“move constant terms to RHS”

focus: lhs.terms.constants

“divide both sides by the coefficient”

focus: lhs.factor.coefficient


⸻

Minimal encoding model (very compact)

You can encode focus as:

focus := path + selector

Where:
	•	path: self | lhs | rhs | term | factor | argument | numerator | denominator | base | exponent
	•	selector: all | first | last | nth(k) | every(k) | range(i,j) | matching(tag) | common

This stays:
	•	human-aligned
	•	DSL-friendly
	•	predicate-free
	•	composable

If you want, next step would be:
	•	mapping verbs × focus types (what combinations humans actually use), or
	•	a canonical focus AST you can hash/embed alongside verb_id.




Prompt: Rule Categorization → Action Phrase

======== prompt ====================

You are given a single algebraic rewrite rule written in a low-level DSL.

Your task is to summarize the rule as one short English action phrase, using the known verbs, entities, focus, and properties, but without labels.

Do not:
	•	restate the rule,
	•	explain mechanics,
	•	mention variables or DSL syntax.

The output should read like a human planning step.

⸻

Allowed vocabulary (implicit)
	•	Verbs: normalize, collect, expand, factor, move, isolate, eliminate, reduce, classify, substitute, split, evaluate, check, finish, reframe
	•	Entities: equation, expression, term, factor, fraction, constant, variable, etc.
	•	Focus & props: left/right side, constant, variable term, denominator, common factor, even, matching pattern, etc.

⸻

Output format

Write one short sentence fragment, imperative mood.

Examples of good outputs:
	•	“move constant term from left to right”
	•	“factor out the common expression”
	•	“eliminate the denominator”
	•	“collect like terms”
	•	“expand the product”
	•	“isolate the variable”
	•	“evaluate the numeric sum”
	•	“split into cases”
	•	“check candidate solutions”

⸻

Example

Input rule

eq(sum(?t, ?c), 0) => eq(?t, neg(?c))

Output

move constant term from left to right

⸻

Guidance
	•	Prefer what a human would say while solving on paper.
	•	Keep it short; omit articles if natural.
	•	If multiple phrasings fit, choose the most generic one.

