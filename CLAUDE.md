# Design Pattern

## Expression Representation

### ARef Hierarchy
- `ARef` represents a hierarchical structure: `ref[]`
- Each `ref` is either:
  - **Symbol**: A named reference to a sub-expression
  - **Number**: A numeric value
  - **Operator**: +, -, *, /, ^

### Parsing Strategy

When parsing expressions, create simplified top-level representations using symbols for sub-expressions.

**Example**: `a + b * c`
- `b * c` becomes a symbol `?1`
- Result: `a + ?1` where `?1` represents `b * c`

**Symbol Naming**:
- Symbols are named using `AModelSymbolCache` available from the model
- Format: `?<num>` (e.g., `?1`, `?2`, `?3`)
- Cache ensures consistent naming across the search tree

### Computation Model

**When Computing**:
1. Wrap parameters in new Symbols with:
   - Name from `AModelSymbolCache`
   - `arefs` pointing to the original parameters
   - `value = undefined` (not yet computed)

2. If a model has one or more uncomputed symbols:
   - Store them in the delayed list at model level
   - These represent pending computations

**When Search Computes**:
- Computation happens when there are no additional steps to take
- The search explores transformations until reaching a state where computation is necessary
- Only then are delayed operations executed

## Example Flow

```
Input: a + b * c

1. Parse:
   - Identify b * c as sub-expression
   - Allocate symbol: ?1 = b * c
   - Top level: [a, +, ?1]

2. During search:
   - Transform operations on symbols
   - Track delayed computations
   - ?1 remains symbolic until needed

3. Compute (when needed):
   - Execute delayed op for ?1
   - Replace symbol with computed value
   - Continue search with new state
```

## Benefits

1. **Lazy Evaluation**: Sub-expressions remain symbolic until computation is needed
2. **Consistent Naming**: Cache ensures same sub-expression gets same symbol name
3. **Hierarchical Structure**: Natural representation of expression precedence
4. **Delayed Computation**: Separate symbolic manipulation from actual computation
