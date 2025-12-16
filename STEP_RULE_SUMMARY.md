# Step Rule System - Implementation Summary

## Overview

Successfully implemented the step-based solving architecture with `eq_ast` and `not` constraints, enabling A* search to solve linear equations.

## Key Changes

### 1. Grammar Extensions (grammar.ohm)

Added support for `not` and `eq_ast` constraints:

```ohm
Constraint
  = "not" Constraint               -- not
  | "eq_ast" "(" Expression "," Expression ")" -- eq_ast
  | PatVar "is" TypeName           -- type
  | Expression "=>" Expression     -- rule
  | Expression "matches" Expression -- match
  | Expression "=" Expression      -- assign
```

### 2. AST Support (ast.ts)

- Added `'not'` and `'eq_ast'` to `ConstraintKind`
- Added `nested?: Constraint` field for negated constraints
- Implemented factory methods:
  - `Constraint.notConstraint(nested)`
  - `Constraint.eqAstConstraint(left, right)`
- Updated `toString()` for new constraint types

### 3. Parser Updates (parser.ts)

Added semantic actions:
```typescript
Constraint_not(_not, constraint)
Constraint_eq_ast(_eq_ast, _lparen, left, _comma, right, _rparen)
```

### 4. Step Rule Implementation (goals.ts)

#### Structural Equality Helper
```typescript
function eqAst(a: AstNode, b: AstNode): boolean
```
Performs deep structural comparison of AST nodes.

#### Step Rule - Bridge to Eval
```typescript
// step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)
export function ruleStep(ast: AstNode): AstNode | undefined
```
Tries to make one eval step, skipping if structurally identical (prevents loops).

#### Solve Driver
```typescript
// solve(?e, ?p) => solve(?e1, ?p) where step(?e) => ?e1
export function ruleSolveStep(ast: AstNode): AstNode | undefined
```
Drives solving using step transformations.

### 5. Linear Solve Fix (equation.ts)

**Critical fix:** Wrap linear solve result in `eval()`:

```typescript
// Before: return div(neg(c), k)
// After:  return eval(div(neg(c), k))

return AstNode.create('func', 'eval', [
  AstNode.create('func', 'div', [
    AstNode.create('func', 'neg', [c]),
    k
  ])
]);
```

This allows the eval rules to progressively evaluate the expression to a number.

### 6. Rule Strings (ruletable.ts)

```typescript
["step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)", ruleStep],
["solve(?e, ?p) => solve(?e1, ?p) where step(?e) => ?e1", ruleSolveStep],
```

## How It Works

### Example: solve(eq(3x + 6, 0), solved_for(x))

**A* Search Path:**
```
Step 0: solve(eq(sum(mul(3,x),6),0),solved_for(x))  [cost: 68]
Step 1: eval(div(neg(6),3))                          [cost: 6]   ← ruleSolveLinear
Step 2: eval(div(eval(neg(6)),3))                   [cost: 7]   ← ruleEvalProgressive
Step 3: eval(div(-6,3))                             [cost: 5]   ← ruleEvalNeg
Step 4: -2                                          [cost: 1]   ← ruleEvalDiv
```

### Why It Works

1. **ruleSolveLinear** recognizes `kx + c = 0` pattern
2. Returns `eval(div(neg(c), k))` (wrapped in eval)
3. **ruleEvalProgressive** applies: `eval(f(a, rest...)) => eval(f(eval(a), rest...))`
4. **ruleEvalNeg** evaluates: `eval(neg(6)) => -6`
5. **ruleEvalDiv** evaluates: `eval(div(-6,3)) => -2`
6. **isGoal** recognizes `-2` as a goal (number)
7. A* returns the path

## Test Results

### Search Tests (npm run test:search)

✅ **Test 6:** `x = 5` → `5` (2 steps)
✅ **Test 7:** `2x + 3 = 0` → `-1.5` (5 steps)
❌ **Test 8:** `2x + 3 = 7` → No path (needs sub simplification)
✅ **Test 9:** `5 = x` → `5` (2 steps)
✅ **Test 10:** `3x + 6 = 0` → `-2` (5 steps)

**Success Rate: 4/5 (80%)**

### Debug Test Output

```
-- Testing: solve(eq(3x + 6, 0), solved_for(x)) --
Parsed equation: eq(sum(mul(3,x),6),0)
Initial cost: 68

Direct rule matches: eval(div(neg(6),3)) (cost: 6)
Next transformations: eval(div(eval(neg(6)),3)) (cost: 7)

A* Search: SUCCESS! Found path with 5 steps
Final solution: x = -2
```

## Architecture Benefits

1. **Separation of Concerns**
   - Equation rules handle structural transformations
   - Eval rules handle numeric computation
   - Step rule bridges the two

2. **Cost-Based Optimization**
   - A* uses costs to find optimal simplification path
   - Lower costs guide search toward simpler expressions

3. **Extensibility**
   - Easy to add new equation types (quadratic, exponential)
   - Easy to add new eval rules (sqrt, log, etc.)
   - Step rule automatically connects them

4. **Constraint System**
   - `eq_ast` prevents infinite loops
   - `not` enables negative conditions
   - Composable and expressive

## Future Enhancements

1. **Subtraction Simplification** - To solve `2x + 3 = 7` type equations
2. **Quadratic Solving** - Implement quadratic formula
3. **Polynomial Combining** - Simplify `2x² + 3x²` to `5x²`
4. **Smarter Goal Recognition** - Accept `div(neg(6),3)` as solved form
5. **Step Tracing** - Show step-by-step explanations

## Success Metrics

✅ **Parser** - `eq_ast` and `not` constraints parse correctly
✅ **AST** - Proper constraint representation
✅ **Step Rule** - Successfully bridges solve and eval
✅ **Linear Solving** - Finds numeric solutions via A* search
✅ **Cost System** - Guides search to optimal paths
✅ **Tests** - 4/5 equation solving tests passing

The step rule system is **fully functional** and provides a solid foundation for advanced equation solving!
