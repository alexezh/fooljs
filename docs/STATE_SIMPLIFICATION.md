# State System Simplification

## Summary of Changes

The state system has been simplified from ~20+ states down to **14 strategy states**, focusing on high-level solving contexts rather than mechanical simplification.

## What Was Removed

### Removed: Expression Simplification States

❌ Removed states (now handled by local rewrite rules):
- `expr_numeric_ops` - unevaluated numeric operations
- `expr_like_terms` - combinable terms
- `expr_nested_sum` - nested sums to flatten
- `expr_nested_mul` - nested products to flatten
- `expr_double_neg` - double negations to eliminate
- `expr_needs_eval` - eval wrappers
- `expr_product_of_sum` - products that can distribute

### Removed: Equation Simplification States

❌ Removed states (now handled by local rewrite rules):
- `eq_unsimplified_lhs` - equations with unsimplified LHS
- `eq_nested_ops` - equations with nested operations
- `eq_needs_eval` - eval-wrapped equations

### Why These Were Removed

These states represented **local, mechanical transformations** that:
1. Don't require high-level strategy decisions
2. Should apply whenever they match (no need for Markov weighting)
3. Are already handled efficiently by the existing rule engine
4. Would make the Markov layer noisy and hard to learn from

**Example:**
- When you see `neg(neg(x))`, you **always** want to eliminate it
- No need for a Markov state to "decide" - it's mechanical
- The rule `neg(neg(?x)) => ?x` handles this perfectly

## What Was Kept

### ✅ Kept: Strategy States (14 total)

**Goal States:**
- `isolated` - Variable isolated: x = value
- `isolated_rhs` - Alternative: value = x

**Normalization States:**
- `zero_form` - Equation in zero form: expr = 0
- `non_zero_form` - Non-zero form: lhs = rhs

**Linear Equation States:**
- `linear_eq` - General linear: ax + c = 0
- `linear_normalized` - Normalized: x + k = 0
- `linear_solved` - Solved: x = value

**Factored Form States:**
- `product_eq_zero` - Product equals zero: (a)(b) = 0
- `factored_quadratic` - Factored quadratic: (x + r1)(x + r2) = 0
- `single_factor` - Single factor: (x + r) = 0

**Quadratic Equation States:**
- `quadratic_raw` - Raw quadratic: ax² + bx + c = 0
- `quadratic_normalized` - Normalized: x² + kx + d = 0
- `quadratic_square_form` - Complete square: (x + h)² + k = 0
- `quadratic_perfect_square` - Perfect square: (x + h)² = k

### Why These Were Kept

These states represent **strategic decision points** where:
1. Different solving methods apply (linear vs quadratic vs factored)
2. We're at different stages of the solving process
3. Learning which transition to take is valuable
4. The "next move" qualitatively changes based on context

**Example:**
- In `quadratic_normalized` state, we have choices:
  - Complete the square (weight 8.0) - pedagogical
  - Try factoring (weight 6.0) - if it factors nicely
  - Apply formula (weight 3.0) - fallback
- These represent **strategic alternatives**, not mechanical transforms

## The Design Principle

### Markov States Are For Strategy

> **States represent contexts where the set of good next rules is qualitatively different**

- `linear_eq` → use linear solving rules
- `quadratic_raw` → use quadratic methods
- `factored_quadratic` → use zero-product property

### Local Rules Are For Mechanics

> **Rules handle deterministic, always-apply transformations**

- `neg(neg(?x))` → always eliminate
- `sum(sum(?a, ?b), ?c)` → always flatten
- `sum(2, 3)` → always compute

## State Count Target: ~10 Strategy States

Our current 14 states break down as:
- 2 goal states (isolated, isolated_rhs)
- 2 normalization states (zero_form, non_zero_form)
- 3 linear solving stages
- 3 factored form stages
- 4 quadratic solving stages

This is manageable for:
- Learning from traces (not too many states)
- Debugging (can inspect transitions)
- Understanding (represents human-like solving stages)

## Benefits of Simplification

### 1. Cleaner Learning Signal

**Before:**
- 20+ states with many micro-transitions
- Hard to tell what's being learned
- Noise from mechanical simplifications

**After:**
- 14 strategy states with clear purpose
- Each transition represents a meaningful choice
- Clean signal: "prefer completing square over factoring"

### 2. Easier Debugging

**Before:**
```
expr_nested_sum → expr_like_terms → expr_numeric_ops → linear_eq → ...
```
Too many intermediate states to track

**After:**
```
zero_form → linear_eq → linear_normalized → isolated
```
Clear, high-level progression

### 3. Separation of Concerns

**Strategy layer (Markov states):**
- What kind of equation is this?
- Which solving method should we use?
- How far along are we?

**Mechanics layer (local rules):**
- Flatten nested operations
- Combine like terms
- Compute numeric operations
- Eliminate double negations

## What This Looks Like in Practice

### Example: Solving `2x + 3 = 5`

**Strategy layer sees:**
1. Start: `non_zero_form`
2. Normalize: `zero_form` (after `2x + 3 - 5 = 0`)
3. Recognize: `linear_eq` (matches `sum(mul(?a, ?x), ?c) = 0`)
4. Solve: `isolated` (x = 1)

**Mechanics layer handles (transparently):**
- Simplifying `3 - 5` to `-2`
- Flattening nested sums if present
- Combining constants
- Computing final division

The Markov graph doesn't see or care about these mechanical steps - they just happen automatically via local rules.

### Example: Solving `x² + 6x + 9 = 0`

**Strategy layer sees:**
1. Start: `zero_form`
2. Recognize: `quadratic_normalized`
3. **Decision point:** Complete square (8.0) vs Factor (6.0)
4. If complete square: `quadratic_square_form`
5. Simplify: `quadratic_perfect_square`
6. Finish: `isolated`

**Mechanics layer handles:**
- Any arithmetic simplification
- Flattening operations
- Evaluating numeric expressions

The strategy layer focuses on the **solving method**, not the **arithmetic details**.

## Future: Transition API Improvement

Currently transitions duplicate rule patterns:

```typescript
runtime.addTransition(
  "quadratic_raw",
  "eq(sum(mul(?a, pow(?x, 2)), ...), 0) => eq(sum(pow(?x, 2), ...), 0)",
  "quadratic_normalized",
  7.0
);
```

Better API would reference rule names:

```typescript
runtime.addTransition(
  "quadratic_raw",
  "ruleQuadraticNormalizeLeadingOne",  // Reference existing rule
  "quadratic_normalized",
  7.0
);
```

This would:
- Avoid duplication between rules and transitions
- Make transitions more maintainable
- Clearly separate rule patterns from state graph structure

## Summary

✅ **14 strategy states** - clean, focused, learnable

✅ **Mechanical simplification** - handled by local rules (where it belongs)

✅ **Clear separation** - strategy vs mechanics

✅ **Better for learning** - clean signal, less noise

✅ **Easier to debug** - fewer states, clear purpose

This simplified design makes the Markov layer do what it does best: **learn which high-level solving strategies work**, while leaving mechanical transformations to the deterministic rule engine.
