# State Design Principles

## Core Principle: States Represent Contexts, Not Features

### ❌ Wrong: States for Low-Level Features

```typescript
// DON'T DO THIS:
runtime.addState("has_x", "?expr"); // contains variable x
runtime.addState("has_x2", "pow(x, 2)"); // x² by itself
runtime.addState("is_sum", "sum(?a, ?b)"); // any sum
runtime.addState("is_number", "?n"); // any number
```

**Why this is wrong:**
- These don't define different *solving strategies*
- They're just features/properties of expressions
- No clear set of "good rules" for each state
- Leads to state explosion (has_x, has_y, has_x_and_y, ...)

### ✅ Right: States for Solving Contexts

```typescript
// DO THIS:
runtime.addState(
  "linear_eq",
  "eq(sum(mul(?a, ?x), ?c), 0)",  // Uses ?x as pattern piece
  ["?x"]
);

runtime.addState(
  "quadratic_raw",
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)",  // Uses pow(?x, 2) as pattern piece
  ["?x"]
);

runtime.addState(
  "factored_quadratic",
  "eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0)",  // Uses sum(?x, ?r) as pattern pieces
  ["?x"]
);
```

**Why this is right:**
- Each state represents a situation where a *specific set of rules* makes sense
- `linear_eq` → use linear solving rules
- `quadratic_raw` → use quadratic solving rules (completing square, factoring, formula)
- `factored_quadratic` → use zero-product property
- Variables like `x` and expressions like `pow(x, 2)` are **pattern pieces** inside larger contexts

---

## The Test: "What Rules Apply Here?"

A good state should answer:

> "When an expression matches this pattern, what solving strategies become relevant?"

### Good State Examples

**State:** `linear_eq` = `eq(sum(mul(?a, ?x), ?c), 0)`

**Good rules in this state:**
- Divide both sides by `?a`
- Move constant to RHS
- Isolate `?x`

**State:** `expr_nested_sum` = `sum(sum(?inner...), ?outer...)`

**Good rules in this state:**
- Flatten: `sum(sum(a, b), c)` → `sum(a, b, c)`
- Associativity transformations
- After flattening, look for like terms

**State:** `expr_double_neg` = `neg(neg(?x))`

**Good rules in this state:**
- Eliminate: `neg(neg(x))` → `x`
- Always apply this (high weight)

### Bad State Examples (Too Generic)

**State:** `has_variable`

**Problem:** What rules apply? Unclear. Too vague.

**State:** `is_sum`

**Problem:** What rules apply? Could be anything. Too broad.

---

## Pattern Pieces vs. States

Think of it like language:

- **Letters** (x, x², +, -, etc.) → Pattern pieces
- **Words/Sentences** (ax + c = 0, (x+r1)(x+r2) = 0) → States

You build a Markov graph over **sentences**, not individual **letters**.

### Example: How `pow(x, 2)` is Used

```typescript
// ❌ DON'T make a state for "x²" by itself
runtime.addState("has_x_squared", "pow(x, 2)");

// ✅ DO use "pow(x, 2)" as a PATTERN PIECE in meaningful contexts
runtime.addState(
  "quadratic_raw",
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)"
  //         ^^^^^^^^^^^
  //         pow(x, 2) used as a pattern piece
);

runtime.addState(
  "quadratic_perfect_square",
  "eq(pow(sum(?x, ?h), 2), ?k)"
  //  ^^^^^^^^^^^^^^^^^^^
  //  pow(..., 2) used as a pattern piece
);
```

### Example: How Variables are Used

```typescript
// ❌ DON'T make states for "has x" or "contains variable"
runtime.addState("contains_x", "?expr"); // Too vague

// ✅ DO use variables as pattern pieces in specific contexts
runtime.addState(
  "linear_in_x",
  "eq(sum(mul(?k, ?x), ?c), 0)",  // ?x is a pattern variable
  ["?x"]  // Parameterized by which variable we're solving for
);
```

---

## Categories of Good States

### 1. Equation Type Recognition

States that identify the *algebraic structure* of an equation:

- `linear_eq`: `ax + c = 0`
- `quadratic_raw`: `ax² + bx + c = 0`
- `factored_quadratic`: `(x + r1)(x + r2) = 0`
- `product_eq_zero`: `(a)(b) = 0`

**Why good:** Different equation types need different solving methods.

### 2. Solving Progress States

States that represent *how far along* we are in solving:

- `quadratic_raw` → `quadratic_normalized` → `quadratic_square_form` → `isolated`
- `factored_quadratic` → `product_eq_zero` → `single_factor` → `isolated`

**Why good:** Different stages need different next steps.

### 3. Simplification Contexts

States where *simplification is needed* before we can proceed:

- `expr_nested_sum`: `sum(sum(a, b), c)` - needs flattening
- `expr_double_neg`: `neg(neg(x))` - needs elimination
- `expr_like_terms`: `sum(x, x, 3)` - needs combining
- `eq_needs_eval`: `eval(eq(...))` - needs evaluation

**Why good:** These represent bottlenecks where specific simplification rules unlock progress.

### 4. Goal States

States representing *successful outcomes*:

- `isolated`: `x = value`
- `zero_form`: `expr = 0` (normalized equation)

**Why good:** These define when we can stop or transition to a new phase.

---

## State Transitions Encode Strategy

Transitions represent:

> "From state S, applying rule R tends to move toward state T"

### Example: Quadratic Solving Path

```typescript
quadratic_raw
  ↓ [normalize leading coeff, weight=7.0]
quadratic_normalized
  ↓ [complete square, weight=8.0]  ← Preferred
  ↓ [try factoring, weight=6.0]    ← Alternative
quadratic_square_form
  ↓ [move constant, weight=9.0]
quadratic_perfect_square
  ↓ [take sqrt, weight=9.0]
isolated
```

**The weights encode:**
- Completing square (8.0) is preferred over factoring (6.0)
- This represents pedagogical preference
- Learned weights could adjust based on success rates

---

## Anti-Patterns to Avoid

### 1. Feature Detection States

```typescript
// ❌ Bad: These are just features
runtime.addState("has_plus", "sum(?a, ?b)");
runtime.addState("has_multiply", "mul(?a, ?b)");
runtime.addState("has_exponent", "pow(?a, ?b)");
```

**Why bad:** No clear solving strategy. Use these as *pattern pieces* instead.

### 2. Overly Generic States

```typescript
// ❌ Bad: Too broad
runtime.addState("any_equation", "eq(?lhs, ?rhs)");
runtime.addState("any_expression", "?expr");
```

**Why bad:** Every equation matches. No discriminating power.

### 3. Overlapping Without Purpose

```typescript
// ❌ Bad: Redundant without strategy difference
runtime.addState("sum_two", "sum(?a, ?b)");
runtime.addState("sum_three", "sum(?a, ?b, ?c)");
runtime.addState("sum_four", "sum(?a, ?b, ?c, ?d)");
```

**Why bad:** Unless there's a *different strategy* for each arity, use a single state with spread: `sum(?terms...)`

**Acceptable overlap:**
```typescript
// ✅ Good: Different strategies apply
runtime.addState("sum_with_numbers", "sum(?terms...)");  // → combine numeric terms
runtime.addState("linear_eq", "eq(sum(mul(?a, ?x), ?c), 0)");  // → linear solving
```

Both match `eq(sum(mul(3, x), 5), 0)`, but they guide *different types of rules*.

---

## Practical Workflow

When adding a new state, ask:

1. **What context does this represent?**
   - "Equation is quadratic in x"
   - "Expression has nested sums"
   - "Equation needs evaluation"

2. **What rules become relevant in this context?**
   - Quadratic → completing square, factoring, formula
   - Nested sums → flattening, associativity
   - Needs eval → evaluate subexpressions

3. **What are the pattern pieces?**
   - Quadratic: uses `pow(?x, 2)`, `mul(?a, ?x)`, etc.
   - Nested sum: uses `sum(sum(...), ...)`
   - Eval: uses `eval(...)`

4. **What are the transitions?**
   - From: current state
   - Via: specific rule
   - To: target state
   - Weight: how good is this transition?

5. **Does this overlap with existing states?**
   - If yes: Is there a *different strategy* for each? (OK)
   - If no different strategy: Merge or generalize instead

---

## Summary

✅ **DO:**
- Make states for *contexts* where different rule sets apply
- Use variables and subexpressions as *pattern pieces*
- Think "what solving strategy applies here?"
- Encode preferences via transition weights

❌ **DON'T:**
- Make states for individual features (has_x, has_x2)
- Make states that don't imply a strategy
- Create state explosion without strategy differentiation
- Treat x, x², etc. as standalone states

**Remember:** States are over *sentences* (contexts), not *letters* (features).
