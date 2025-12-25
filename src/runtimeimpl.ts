import { astEquals, AstNode, ASymbol, MatchFuncRet } from "./ast.js";
import { astMatch } from "./ast_match.js";
import { parse } from "./parser.js";
import { Path, Goal } from "./planner/plannercore.js";
import { RuleCache } from "./rulecache.js";
import { RuleBody, RuleId, RuleMeta, RuleNode, RuleTag, Runtime } from "./runtime.js";
import { SkillRegistry } from "./skillregistry.js";

export class RuntimeImpl implements Runtime {
  static instance: Runtime = new RuntimeImpl();

  public readonly skillRegistry = new SkillRegistry();
  public readonly ruleCache = new RuleCache();

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
    return astMatch(pattern, node) !== undefined;
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
    if (astEquals(a, b)) {
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
   * Parse an expression string into an AST.
   * Used by StateManager to parse state patterns.
   */
  parseExpr(exprStr: string): AstNode {
    return parse(exprStr);
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
