import { AstNode, ASymbol, MatchFunc, MatchFuncRet } from "./ast.js";
import { parse } from "./parser.js";
import { Path, Goal } from "./planner/plannercore.js";
import { RuleId, RuleMeta, RuleNode, RuleTag, Runtime } from "./runtime.js";

export class RuntimeImpl implements Runtime {
  private rules: RuleNode[] = [];
  private byFunc = new Map<string, RuleNode>();
  private byId: Map<RuleId, RuleMeta> = new Map();
  private byTag: Map<RuleTag, RuleNode[]> = new Map();
  //private stateManager: StateManager;

  static instance: Runtime = new RuntimeImpl();

  constructor() {
    //this.stateManager = new StateManager(this);
  }
  /**
   * Navigate to a node at the given path.
   * Path is an array of child indices, e.g., [0, 1] means root.children[0].children[1]
   */
  getAt(root: AstNode, path: Path): AstNode {
    let cur = root;
    for (const idx of path) {
      const children = cur.children;
      if (!children || idx < 0 || idx >= children.length) {
        throw new Error(`Invalid path ${path} at index ${idx}`);
      }
      cur = children[idx];
    }
    return cur;
  }

  /**
   * Replace node at the given path with newSubtree, returning a new root.
   * Uses structural sharing - only creates new nodes along the path.
   */
  setAt(root: AstNode, path: Path, newSubtree: AstNode): AstNode {
    if (path.length === 0) {
      return newSubtree;
    }

    const [idx, ...rest] = path;
    const children = root.children;
    if (!children || idx < 0 || idx >= children.length) {
      throw new Error(`Invalid path at index ${idx}`);
    }

    const newChild = this.setAt(children[idx], rest, newSubtree);
    const newChildren = [...children];
    newChildren[idx] = newChild;

    return root.clone(newChildren);
  }

  /**
   * Walk all nodes in the tree, calling cb with (node, path) for each.
   */
  walk(root: AstNode, cb: (node: AstNode, path: Path) => void): void {
    const helper = (node: AstNode, path: Path) => {
      cb(node, path);
      const children = node.children ?? [];
      for (let i = 0; i < children.length; i++) {
        helper(children[i], [...path, i]);
      }
    };
    helper(root, []);
  }

  /**
   * Check if a pattern string matches a node.
   */
  matches(patternStr: string, node: AstNode): boolean {
    const pattern = this.parseExpr(patternStr);
    return this.matchPattern(pattern, node) !== undefined;
  }

  /**
   * Try to apply a rule at a specific path in the tree.
   * Returns the new root if successful, null otherwise.
   */
  tryApplyRuleAt(ruleId: string, root: AstNode, path: Path): AstNode | null {
    // Find the rule by ID (ruleId is the def string for now)
    const rule = this.rules.find(r => r.def === ruleId);
    if (!rule || !rule.matchFunc) {
      return null;
    }

    // Get the node at the path
    const target = this.getAt(root, path);

    // Try to apply the rule
    const result = rule.matchFunc(target);
    if (!result || !result.replace) {
      return null;
    }

    // Replace the target with the result
    return this.setAt(root, path, result.replace);
  }

  /**
   * Check if the goal is met for the given root expression.
   * For solve_for goals, check if we have isolated the variable.
   */
  goalMet(root: AstNode, goal: Goal): boolean {
    if (goal.kind === "solve_for") {
      // Goal is to isolate the variable
      // Check patterns like: eq(x, value) or eq(value, x)
      if (root.kind === 'func' && root.value === 'eq') {
        const children = root.children ?? [];
        if (children.length === 2) {
          const [lhs, rhs] = children;
          const varName = goal.x;

          // Check if lhs is the variable and rhs doesn't contain it
          if (lhs.kind === 'symbol' && (lhs.value as ASymbol).name === varName) {
            return !this.containsVariable(rhs, varName);
          }

          // Check if rhs is the variable and lhs doesn't contain it
          if (rhs.kind === 'symbol' && (rhs.value as ASymbol).name === varName) {
            return !this.containsVariable(lhs, varName);
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if an expression contains a given variable.
   */
  private containsVariable(expr: AstNode, varName: string): boolean {
    if (expr.kind === 'symbol') {
      return (expr.value as ASymbol).name === varName;
    }
    const children = expr.children ?? [];
    return children.some(ch => this.containsVariable(ch, varName));
  }

  /**
   * Check if two expressions are semantically equivalent.
   * For now, use random testing with variable groundings.
   */
  equivalent(a: AstNode, b: AstNode): boolean {
    // Try structural equality first
    if (this.astEquals(a, b)) {
      return true;
    }

    // Random testing: evaluate both with random variable assignments
    const numTests = 10;
    let successfulTests = 0;
    for (let i = 0; i < numTests; i++) {
      const env = this.sampleGrounding(a);
      try {
        const valA = this.evalWithEnv(a, env);
        const valB = this.evalWithEnv(b, env);
        successfulTests++;
        if (Math.abs(valA - valB) > 1e-10) {
          return false;
        }
      } catch (e) {
        // Evaluation error (e.g., division by zero, non-numeric expression)
        // If we can't evaluate either expression, we can't claim equivalence
        continue;
      }
    }

    // Only return true if we had at least one successful test
    // If all tests failed to evaluate, the expressions are likely not equivalent
    return successfulTests > 0;
  }

  /**
   * Generate random variable assignments for testing.
   * Returns an object like {x: 3, y: -1, z: 0.5}
   */
  sampleGrounding(root: AstNode): Record<string, number> {
    const vars = new Set<string>();
    this.walk(root, (node) => {
      if (node.kind === 'symbol') {
        vars.add((node.value as ASymbol).name);
      }
    });

    const env: Record<string, number> = {};
    for (const v of vars) {
      // Random integer between -10 and 10
      env[v] = Math.floor(Math.random() * 21) - 10;
    }
    return env;
  }

  /**
   * Evaluate an expression with given variable bindings.
   */
  evalWithEnv(expr: AstNode, env: Record<string, number>): number {
    if (expr.kind === 'number') {
      return expr.value as number;
    }

    if (expr.kind === 'symbol') {
      const name = (expr.value as ASymbol).name;
      if (env[name] !== undefined) {
        return env[name];
      }
      throw new Error(`Unbound variable: ${name}`);
    }

    if (expr.kind === 'func') {
      const children = expr.children ?? [];
      const args = children.map(ch => this.evalWithEnv(ch, env));

      switch (expr.value) {
        case 'sum':
          return args.reduce((a, b) => a + b, 0);
        case 'mul':
          return args.reduce((a, b) => a * b, 1);
        case 'div':
          if (args.length !== 2) throw new Error('div requires 2 args');
          if (args[1] === 0) throw new Error('Division by zero');
          return args[0] / args[1];
        case 'sub':
          if (args.length !== 2) throw new Error('sub requires 2 args');
          return args[0] - args[1];
        case 'neg':
          if (args.length !== 1) throw new Error('neg requires 1 arg');
          return -args[0];
        case 'pow':
          if (args.length !== 2) throw new Error('pow requires 2 args');
          return Math.pow(args[0], args[1]);
        case 'sqrt':
          if (args.length !== 1) throw new Error('sqrt requires 1 arg');
          return Math.sqrt(args[0]);
        default:
          throw new Error(`Unknown function: ${expr.value}`);
      }
    }

    throw new Error(`Cannot evaluate: ${expr.kind}`);
  }

  init(): void {
    //this.rules.push(new AstNode("sum", [new AstNode(new ASymbol("a")), new AstNode(new ASymbol("b"))]))
  }

  /**
   * Get the state manager for this runtime.
   */
  // getStateManager(): StateManager {
  //   return this.stateManager;
  // }

  addRule(m: RuleMeta): void {
    /** Optional: keep meta accessible for features/policy */
    this.byId.set(m.id, m);

    let ruleAst: AstNode;
    ruleAst = parse(m.rule);

    if (ruleAst.kind !== "rule") {
      throw "Should be rule"
    }

    let node: RuleNode = {
      def: m.rule,
      id: m.id,
      tags: m.tags,
      pattern: ruleAst.children![0],
      match: ruleAst.children![1],
      constraints: ruleAst.constraints,
      matchFunc: m.fn
    }
    this.rules.push(node);
    if (node.pattern.kind === "func") {
      if (typeof (node.pattern.value) !== "string") {
        debugger;
      } else {
        this.byFunc.set(node.pattern.value as string, node);
      }
    }

    for (let tag of m.tags) {
      let e = this.byTag.get(tag);
      if (!e) {
        e = [];
        this.byTag.set(tag, e);
      }
      e.push(node);
    }
  }

  matchRule(inp: AstNode): MatchFuncRet[] {
    const results: MatchFuncRet[] = [];

    for (const rule of this.rules) {
      const result = rule.matchFunc!(inp);
      if (result !== undefined) {
        result.ruleDef = rule.def;
        results.push(result);
      }
      continue;
    }

    return results;
  }

  /**
   * Parse an expression string into an AST.
   * Used by StateManager to parse state patterns.
   */
  parseExpr(exprStr: string): AstNode {
    return parse(exprStr);
  }

  /**
   * Match a pattern against an expression.
   * Returns a map of pattern variable bindings if match succeeds, undefined otherwise.
   *
   * This is a simple pattern matcher that supports:
   * - Pattern variables (?x, ?a, etc.)
   * - Literal values (numbers, symbols)
   * - Function applications with matching argument lists
   * - Spread patterns (?rest...)
   */
  matchPattern(pattern: AstNode, expr: AstNode): Map<string, AstNode> | undefined {
    const bindings = new Map<string, AstNode>();

    if (this.matchPatternInternal(pattern, expr, bindings)) {
      return bindings;
    }

    return undefined;
  }

  private matchPatternInternal(pattern: AstNode, expr: AstNode, bindings: Map<string, AstNode>): boolean {
    // Pattern variable: ?x
    if (pattern.kind === 'patvar') {
      const varName = pattern.value.toString();

      // Check if this variable is already bound
      const existing = bindings.get(varName);
      if (existing !== undefined) {
        // Variable must match the same expression
        return this.astEquals(existing, expr);
      }

      // Bind the variable
      bindings.set(varName, expr);
      return true;
    }

    // Spread pattern: ?rest...
    if (pattern.kind === 'spread') {
      // This case is handled by the parent (function arguments matching)
      // Should not be called directly
      return false;
    }

    // Number: must match exactly
    if (pattern.kind === 'number') {
      return expr.kind === 'number' && pattern.value === expr.value;
    }

    // Symbol: must match name
    if (pattern.kind === 'symbol') {
      if (expr.kind !== 'symbol') return false;
      const patSym = pattern.value as ASymbol;
      const exprSym = expr.value as ASymbol;
      return patSym.name === exprSym.name;
    }

    // Function: must match name and arguments
    if (pattern.kind === 'func') {
      if (expr.kind !== 'func') return false;
      if (pattern.value !== expr.value) return false;

      const patArgs = pattern.children ?? [];
      const exprArgs = expr.children ?? [];

      return this.matchArgs(patArgs, exprArgs, bindings);
    }

    // Equation: match both sides
    if (pattern.kind === 'eq') {
      if (expr.kind !== 'eq') return false;

      const patArgs = pattern.children ?? [];
      const exprArgs = expr.children ?? [];

      if (patArgs.length !== 2 || exprArgs.length !== 2) return false;

      return this.matchPatternInternal(patArgs[0], exprArgs[0], bindings) &&
        this.matchPatternInternal(patArgs[1], exprArgs[1], bindings);
    }

    // List: match elements
    if (pattern.kind === 'list') {
      if (expr.kind !== 'list') return false;

      const patArgs = pattern.children ?? [];
      const exprArgs = expr.children ?? [];

      return this.matchArgs(patArgs, exprArgs, bindings);
    }

    return false;
  }

  private matchArgs(patArgs: ReadonlyArray<AstNode>, exprArgs: ReadonlyArray<AstNode>, bindings: Map<string, AstNode>): boolean {
    let pi = 0;
    let ei = 0;

    while (pi < patArgs.length && ei < exprArgs.length) {
      const pat = patArgs[pi];

      // Handle spread pattern: ?rest...
      if (pat.kind === 'spread') {
        const varPat = pat.children?.[0];
        if (!varPat || varPat.kind !== 'patvar') {
          return false; // Invalid spread pattern
        }

        const varName = varPat.value.toString();
        const remainingPatterns = patArgs.length - pi - 1;
        const remainingExprs = exprArgs.length - ei;

        if (remainingExprs < remainingPatterns) {
          return false; // Not enough expressions left
        }

        // Collect the spread items
        const spreadItems: AstNode[] = [];
        const spreadCount = remainingExprs - remainingPatterns;

        for (let i = 0; i < spreadCount; i++) {
          spreadItems.push(exprArgs[ei++]);
        }

        // Bind the spread variable to a list
        bindings.set(varName, AstNode.create('list', 'list', spreadItems));
        pi++;
        continue;
      }

      // Regular pattern
      if (!this.matchPatternInternal(pat, exprArgs[ei], bindings)) {
        return false;
      }

      pi++;
      ei++;
    }

    // Both must be exhausted (unless there are trailing spread patterns)
    return pi === patArgs.length && ei === exprArgs.length;
  }

  private astEquals(a: AstNode, b: AstNode): boolean {
    if (a.kind !== b.kind) return false;

    if (a.kind === 'number') {
      return a.value === b.value;
    }

    if (a.kind === 'symbol') {
      const aSym = a.value as ASymbol;
      const bSym = b.value as ASymbol;
      return aSym.name === bSym.name;
    }

    if (a.kind === 'func' || a.kind === 'eq') {
      if (a.value !== b.value) return false;

      const aArgs = a.children ?? [];
      const bArgs = b.children ?? [];

      if (aArgs.length !== bArgs.length) return false;

      for (let i = 0; i < aArgs.length; i++) {
        if (!this.astEquals(aArgs[i], bArgs[i])) return false;
      }

      return true;
    }

    return a.toString() === b.toString();
  }

  /**
   * Convenience methods for state management
   */

  // addState(name: string, patternStr: string, params: string[] = [], guard?: StateGuard): void {
  //   this.stateManager.addState(name, patternStr, params, guard);
  // }

  // addTransition(fromState: string, rule: string, toState: string, weight: number = 1.0): void {
  //   this.stateManager.addTransition(fromState, rule, toState, weight);
  // }

  // updateTransitionWeight(fromState: string, rule: string, deltaWeight: number): void {
  //   this.stateManager.updateTransitionWeight(fromState, rule, deltaWeight);
  // }

  // printStateGraph(): string {
  //   return this.stateManager.printGraph();
  // }
}
