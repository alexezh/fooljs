# State-Based Rule Guidance: Implementation Summary

## What Was Implemented

A complete **recursive Markov graph** system for guiding rule application in the equation solver, based on pattern-states rather than concrete expressions.

## Files Created

### Core Infrastructure

1. **`src/state.ts`** (250 lines)
   - `State` class: Represents pattern-states
   - `Transition` class: Weighted edges between states
   - `StateManager` class: Manages states, transitions, and scoring

2. **`src/runtime.ts`** - Enhanced (217 lines added)
   - Pattern matching engine (`matchPattern`, `matchPatternInternal`, `matchArgs`)
   - AST equality checking (`astEquals`)
   - State management API (`addState`, `addTransition`, `updateTransitionWeight`)
   - Integration with `StateManager`

3. **`src/search.ts`** - Modified
   - Integration of state-based scoring in `getRewrites`
   - Passes state scores to `SearchState.create`

4. **`src/tests/searchstate.ts`** - Enhanced
   - Added `stateScoreAdj` parameter to `SearchState.create`
   - State-based adjustment applied to `gCost`

### Documentation & Examples

5. **`docs/STATE_SYSTEM.md`** (600+ lines)
   - Complete user guide
   - API reference
   - Conceptual explanation
   - Learning strategies
   - Advanced patterns

6. **`examples/state_example.ts`** (130 lines)
   - Quadratic equation solving example
   - Shows state definitions and transitions
   - Demonstrates scoring and learning

7. **`src/tests/state_test.ts`** (195 lines)
   - 5 comprehensive test suites
   - Pattern matching tests
   - Transition and scoring tests
   - Weight update (learning) tests
   - Nested pattern tests
   - Overlapping state tests
   - **All tests passing ✓**

## Key Features Implemented

### 1. Pattern-Based States

States are defined as patterns, not concrete expressions:

```typescript
runtime.addState(
  "quad_leading1",
  "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
  ["?x"]
);
```

This single pattern matches infinite variations:
- `eq(sum(pow(x, 2), mul(3, x), 5), 0)`
- `eq(sum(pow(y, 2), mul(7, y), 2), 0)`
- Any quadratic with leading coefficient 1

### 2. Weighted Transitions

Transitions encode learned (or human-specified) rule preferences:

```typescript
runtime.addTransition(
  "quad_leading1",      // From state
  "ruleCompleteSquare", // Via rule
  "square_form",        // To state
  10.0                  // Weight (higher = prefer)
);
```

### 3. Comprehensive Pattern Matching

Supports all AST node types:
- ✓ Pattern variables (`?x`, `?a`)
- ✓ Spread patterns (`?rest...`)
- ✓ Numbers, symbols
- ✓ Function applications
- ✓ Equations
- ✓ Lists
- ✓ Variable binding and checking

### 4. State-Based Scoring

For each candidate rewrite `(expr, rule)`:

1. **Find active states**: Match `expr` against all state patterns
2. **Lookup weights**: For each matching state, get transition weight for that rule
3. **Sum scores**: `score = Σ weights` across all matching states
4. **Adjust cost**: `newGCost = parentGCost + rewriteCost - stateScore`

Higher scores → lower cost → higher priority in A* search.

### 5. Learning from Traces

Weights can be updated incrementally:

```typescript
// Positive reinforcement
runtime.updateTransitionWeight("state_a", "good_rule", +0.5);

// Negative reinforcement
runtime.updateTransitionWeight("state_b", "bad_rule", -0.2);
```

### 6. Recursive Application

The **same state graph** applies at every subtree level:

```
sum(
  eq(...),  ← State graph applies here
  eq(...)   ← And here
)
```

This is what enables generalization - no need to learn separately for nested expressions.

## Integration with Existing System

### Minimal Changes Required

- **Rules**: No changes needed - remain pure functions
- **Search**: Small modification to `getRewrites` (5 lines)
- **SearchState**: Added one optional parameter (2 lines)
- **Backward compatible**: Works with zero states defined (falls back to base costs)

### Clean API

```typescript
// Define states
runtime.addState("pattern_name", "pattern_expr");

// Define transitions
runtime.addTransition("from_state", "rule_name", "to_state", weight);

// Learn from experience
runtime.updateTransitionWeight("state", "rule", delta);

// Inspect
console.log(runtime.printStateGraph());
```

## Test Results

All 5 test suites passing:

```
✓ State Pattern Matching
  - Simple patterns
  - Multiple expressions
  - Non-matching expressions

✓ Transitions and Scoring
  - Basic scoring
  - Multiple transitions from one state
  - Non-existent transitions (score 0)

✓ Weight Updates (Learning)
  - Positive updates
  - Negative updates
  - Cumulative updates

✓ Nested Pattern Matching
  - Complex patterns (quadratics)
  - Generalization across different variables
  - Same pattern matches multiple expressions

✓ Overlapping State Patterns
  - Multiple states match one expression
  - Scores sum across all matching states
  - Precise pattern matching (arity checking)
```

## Example Usage

```typescript
// Setup
const runtime = Runtime.instance;
initCore(runtime);

// Define quadratic solving states
runtime.addState("quad_raw", "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)");
runtime.addState("quad_leading1", "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)");
runtime.addState("isolated", "eq(?x, ?rhs)");

// Define transition weights (human knowledge or learned)
runtime.addTransition("quad_raw", "ruleNormalize", "quad_leading1", 8.0);
runtime.addTransition("quad_leading1", "ruleCompleteSquare", "isolated", 10.0);

// Now when solving equations, rules with higher weights are preferred
// The A* search will explore ruleCompleteSquare before other options
```

## Performance Characteristics

### Time Complexity

- **Pattern matching per state**: O(n) where n = AST size
- **Scoring per rule**: O(s) where s = number of matching states (typically small)
- **Overall impact**: Negligible compared to search expansion cost

### Space Complexity

- **States**: O(number of state patterns defined)
- **Transitions**: O(number of (state, rule) pairs)
- Typically 10-100 states, so very small memory footprint

### Search Impact

- **Positive**: Better-guided exploration reduces search space
- **Neutral**: Small constant-factor overhead per node expansion
- **Net effect**: Faster convergence to solutions when weights are well-learned

## Future Enhancements

### Immediate Opportunities

1. **Constraint Support**: Enable patterns like `sum(?x, ?n) where ?n is number`
2. **State Discovery**: Automatically identify useful patterns from traces
3. **Weight Persistence**: Save/load learned weights to/from files
4. **Visualization**: Display state graph and active states during search

### Advanced Features

1. **Hierarchical States**: Parent-child relationships for pattern refinement
2. **Context-Sensitive Weights**: Different weights for different problem types
3. **Multi-Objective**: Balance speed, simplicity, pedagogical value
4. **Neural Integration**: Use NN to predict transition weights

### Learning Algorithms

1. **Temporal Difference**: TD-learning for credit assignment
2. **Policy Gradient**: Optimize for expected solution quality
3. **Exploration**: ε-greedy or UCB for discovering new paths
4. **Transfer Learning**: Share weights across similar problem domains

## Comparison to Alternatives

| Approach | Generalization | Transparency | Learning | Setup |
|----------|---------------|--------------|----------|-------|
| **Pattern States** (ours) | ✓✓✓ Excellent | ✓✓✓ Inspectable | ✓✓ Incremental | ✓✓ Medium |
| Concrete State Markov | ✗ None | ✓✓✓ Clear | ✓ Slow | ✓✓✓ Easy |
| Neural Network Policy | ✓✓ Good | ✗ Black box | ✓✓✓ Powerful | ✗ Hard |
| Hand-Coded Heuristics | ✗ Limited | ✓✓ Clear | ✗ None | ✓✓ Medium |

Our approach combines the best aspects:
- **Generalization** from pattern matching
- **Transparency** from explicit state graph
- **Learning** from weight updates
- **Reasonable setup** with human-interpretable patterns

## Conclusion

The state-based rule guidance system successfully implements a recursive Markov graph over pattern-states, enabling:

- **Human-like abstraction**: "All quadratics solve similarly"
- **Generalization**: One pattern covers infinite expressions
- **Learning**: Weights improve from experience
- **Recursion**: Same graph applies at any depth

This provides a solid foundation for building an intelligent equation solver that learns from experience while remaining interpretable and debuggable.

---

**Status**: ✓ Fully implemented, tested, and documented
**Lines of Code**: ~700 (core) + ~900 (docs/examples/tests)
**Test Coverage**: 5/5 test suites passing
**Ready for**: Production use and further enhancement
