# State-Based Rule Guidance System

## Overview

The state-based rule guidance system implements a **recursive Markov graph** over expression patterns to guide the equation solver. This enables:

- **Generalization**: One state pattern matches infinitely many concrete expressions
- **Learning**: Transition weights can be learned from successful solve traces
- **Human-like reasoning**: Abstractions like "any ax²+bx+c" guide solving
- **Recursive application**: The same state graph applies at every subtree level

## Core Concepts

### 1. States are Patterns, Not Concrete ASTs

Traditional state machines operate over concrete expressions:
```
State: "x² + 3x + 5 = 0"  → Only matches this exact equation
```

Our system uses **pattern-states** that match entire classes of expressions:
```typescript
runtime.addState(
  "quad_leading1",
  "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
  ["?x"]
);
```

This single state matches **all** quadratics with leading coefficient 1:
- `x² + 3x + 5 = 0`
- `y² - 7y + 2 = 0`
- `z² + 100z - 50 = 0`
- etc.

### 2. Edges are Weighted Transitions

Transitions represent: **"If you're in state S, applying rule R tends to take you to state T"**

```typescript
runtime.addTransition(
  "quad_leading1",       // From state
  "ruleCompleteSquare",  // Via this rule
  "square_form",         // To state
  8.0                    // Weight (higher = more preferred)
);
```

The weight encodes how "good" this transition is:
- High weight = strongly prefer this rule in this state
- Low weight = explore this path only if better options fail
- Negative weight = actively avoid (rarely used)

### 3. Recursive Application at Every Subtree

The magic: **the same state graph is applied at every level of the expression tree**.

Consider this nested expression:
```
sum(
  eq(sum(pow(x, 2), mul(3, x), 5), 0),  ← Matches "quad_leading1"
  eq(sum(pow(y, 2), mul(7, y), 2), 0)   ← Also matches "quad_leading1"
)
```

Both sub-equations match the same pattern state, so:
- Each gets the **same rule guidance**
- Learned weights apply **everywhere** this pattern appears
- No need to re-learn for every concrete equation

## How It Works in Search

### Step 1: Find Active States

When considering a rewrite at expression `E`:

```typescript
const activeStates = stateManager.getActiveStates(expr);
// → ["quad_leading1", "polynomial_form", ...]
```

The system matches `E` against all state patterns to find which states "contain" it.

### Step 2: Score Each Rule

For each matching rule `R`:

```typescript
const score = stateManager.scoreRule(expr, rule);
// score = Σ over all matching states S of weight[S][R]
```

The score is the **sum of transition weights** from all matching states.

### Step 3: Adjust Search Cost

In A* search, lower cost = higher priority. We adjust:

```typescript
const newGCost = parentGCost + rewriteCost - stateScore;
//                                            ^^^^^^^^^^^
//                                            Higher score → lower cost → higher priority
```

Rules with high state-based scores are explored first.

### Step 4: Recursion

This happens at **every node** in the AST, so even deeply nested expressions benefit from the same learned guidance.

## API Reference

### Runtime Methods

#### `addState(name: string, patternStr: string, params?: string[]): void`

Define a new pattern-state.

**Parameters:**
- `name`: Unique identifier for the state
- `patternStr`: Pattern expression (using `?var` for pattern variables)
- `params`: Optional list of key parameters (e.g., `["?x"]` for the variable we're solving for)

**Example:**
```typescript
runtime.addState(
  "isolated",
  "eq(?x, ?rhs)",
  ["?x"]
);
```

#### `addTransition(fromState: string, rule: string, toState: string, weight?: number): void`

Add a weighted transition between states.

**Parameters:**
- `fromState`: Source state name
- `rule`: Rule definition string (must match a registered rule)
- `toState`: Target state name
- `weight`: Transition weight (default 1.0)

**Example:**
```typescript
runtime.addTransition(
  "quad_leading1",
  "ruleCompleteSquare",
  "square_form",
  10.0
);
```

#### `updateTransitionWeight(fromState: string, rule: string, deltaWeight: number): void`

Adjust an existing transition weight (for learning).

**Parameters:**
- `fromState`: Source state name
- `rule`: Rule name
- `deltaWeight`: Amount to add to current weight

**Example:**
```typescript
// Increase weight for successful path
runtime.updateTransitionWeight("quad_leading1", "ruleCompleteSquare", +1.0);

// Decrease weight for failed path
runtime.updateTransitionWeight("quad_raw", "ruleBadChoice", -0.5);
```

#### `printStateGraph(): string`

Get a string representation of the entire state graph for debugging.

**Example:**
```typescript
console.log(runtime.printStateGraph());
```

### StateManager Methods

Access via `runtime.getStateManager()`.

#### `getActiveStates(expr: AstNode): string[]`

Find all states whose pattern matches the given expression.

**Example:**
```typescript
const stateManager = runtime.getStateManager();
const expr = runtime.parseExpr("eq(sum(pow(x, 2), mul(3, x), 5), 0)");
const states = stateManager.getActiveStates(expr);
// → ["quad_leading1", "polynomial_eq", ...]
```

#### `scoreRule(expr: AstNode, rule: string): number`

Compute the total weight for applying a rule at an expression.

**Example:**
```typescript
const score = stateManager.scoreRule(expr, "ruleCompleteSquare");
// → 10.0 (sum of all transition weights from matching states)
```

## Example: Quadratic Equation Solver

See `examples/state_example.ts` for a complete working example.

### Define State Hierarchy

```typescript
// Raw form: ax²+bx+c = 0
runtime.addState("quad_raw",
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)",
  ["?x"]);

// Normalized: x²+kx+d = 0
runtime.addState("quad_leading1",
  "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
  ["?x"]);

// Completed square: (x+h)²+k = 0
runtime.addState("square_form",
  "eq(sum(pow(sum(?x, ?h), 2), ?k), 0)",
  ["?x"]);

// Solved: x = value
runtime.addState("isolated",
  "eq(?x, ?rhs)",
  ["?x"]);
```

### Define Transition Graph

```typescript
// Standard solving path (high weights)
runtime.addTransition("quad_raw", "ruleNormalizeLeading", "quad_leading1", 10.0);
runtime.addTransition("quad_leading1", "ruleCompleteSquare", "square_form", 8.0);
runtime.addTransition("square_form", "ruleTakeSqrt", "isolated", 10.0);

// Alternative path (lower weight)
runtime.addTransition("quad_raw", "ruleQuadraticFormula", "isolated", 3.0);
```

### The System Learns

After observing solve traces:

```typescript
// If completing the square worked well
runtime.updateTransitionWeight("quad_leading1", "ruleCompleteSquare", +0.5);

// If a path failed
runtime.updateTransitionWeight("quad_raw", "ruleBadApproach", -1.0);
```

Over time, weights converge to optimal values.

## Learning from Traces

### Positive Reinforcement

After a successful solve:

1. Extract the path: `start → state1 → state2 → goal`
2. Identify which (state, rule) pairs were used
3. Increase weights for those transitions:

```typescript
for (const step of successfulPath) {
  runtime.updateTransitionWeight(
    step.fromState,
    step.rule,
    +learningRate  // e.g., +0.1
  );
}
```

### Negative Reinforcement

After an unsuccessful exploration:

1. Identify (state, rule) pairs that led to dead ends
2. Decrease weights:

```typescript
for (const step of failedPath) {
  runtime.updateTransitionWeight(
    step.fromState,
    step.rule,
    -learningRate  // e.g., -0.05
  );
}
```

### Credit Assignment

For more sophisticated learning:

- **Temporal difference**: Adjust based on how much closer we got to goal
- **Exploration bonus**: Occasionally try low-weight transitions to discover new paths
- **Decay**: Slowly decrease all weights to prevent overfitting

## Integration with Existing System

The state system integrates seamlessly:

1. **No changes to rules**: Rules remain pure functions
2. **Optional enhancement**: Works even with zero states (falls back to base costs)
3. **Gradual adoption**: Add states incrementally for important patterns

### Search Integration

The A* search automatically uses state-based scoring:

```typescript
// In getRewrites():
const stateScore = stateManager.scoreRule(node, ruleDef);
const successorState = SearchState.create(
  state,
  path,
  node,
  rewrite,
  -stateScore  // Higher score → lower cost
);
```

## Advanced Patterns

### Conditional States

Use constraints in patterns:

```typescript
runtime.addState(
  "quad_positive_discriminant",
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) where ?b^2 > 4*?a*?c"
);
```

### Hierarchical States

Create parent-child relationships:

```typescript
// Parent: any polynomial equation
runtime.addState("polynomial_eq", "eq(sum(?terms...), 0)");

// Child: specifically quadratic
runtime.addState("quad_eq", "eq(sum(mul(?a, pow(?x, 2)), ?rest...), 0)");

// Rule applies to both, but different weights
runtime.addTransition("polynomial_eq", "ruleNormalize", "normalized", 1.0);
runtime.addTransition("quad_eq", "ruleNormalize", "normalized", 5.0);
```

### Multi-Step Sequences

Encode common solving sequences:

```typescript
runtime.addTransition("raw", "step1", "intermediate1", 10.0);
runtime.addTransition("intermediate1", "step2", "intermediate2", 10.0);
runtime.addTransition("intermediate2", "step3", "goal", 10.0);

// Alternative shorter path (if applicable)
runtime.addTransition("raw", "directSolve", "goal", 2.0);
```

The system learns which sequences work best.

## Comparison to Alternatives

### vs. Plain Markov Graph over Concrete States

**Plain Markov:**
- State: `"x² + 3x + 5 = 0"`
- No generalization to `"y² + 7y + 2 = 0"`
- Must learn separately for every concrete equation

**Our System:**
- State: `"eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)"`
- Generalizes to all similar quadratics
- Learn once, apply everywhere

### vs. Neural Network Policy

**Neural Network:**
- Requires large training datasets
- Black box (hard to debug)
- May need retraining for new rule types

**Our System:**
- Can initialize with human knowledge
- Transparent (inspect state graph)
- Learns incrementally from traces
- Can optionally use NN to predict weights

### Hybrid Approach

Best of both worlds:

1. Use state patterns for structure
2. Use small NN to predict transition weights
3. Fine-tune with RL from solve traces

```typescript
// Predicted by NN
const predictedWeight = neuralNet.predict(stateFeatures, ruleFeatures);
runtime.addTransition(fromState, rule, toState, predictedWeight);

// Then update from actual outcomes
runtime.updateTransitionWeight(fromState, rule, rewardDelta);
```

## Future Extensions

### Automatic State Discovery

Learn state patterns from data:
- Cluster similar expressions
- Extract common subpatterns
- Create states automatically

### Multi-Objective Optimization

Different weights for different objectives:
- Speed: prefer fast rules
- Simplicity: prefer simple intermediates
- Pedagogy: prefer "teachable" steps

### Contextual Weights

Transition weights depend on context:
- Problem difficulty
- Available computation time
- User skill level
