import { AstNode, ASymbol, Constraint, MatchFunc, MatchFuncRet } from "./ast.js";
import { parse } from "./parser.js";
//import { StateManager, StateGuard } from "./state.js";

type RuleNode = {
  def: string,
  pattern: AstNode,
  match: AstNode,
  constraints?: Constraint[],
  matchFunc: MatchFunc | undefined
}

export class Runtime {
  private rules: RuleNode[] = [];
  private byFunc = new Map<string, RuleNode>();
  //private stateManager: StateManager;

  static instance: Runtime = new Runtime();

  constructor() {
    //this.stateManager = new StateManager(this);
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

  addRule(args: string, matchFunc: MatchFunc | undefined): void {
    let ruleAst: AstNode;
    if (typeof (args) === "string") {
      ruleAst = parse(args);
    } else {
      ruleAst = args;
    }

    if (ruleAst.kind !== "rule") {
      throw "Should be rule"
    }

    let node: RuleNode = {
      def: args,
      pattern: ruleAst.children![0],
      match: ruleAst.children![1],
      constraints: ruleAst.constraints,
      matchFunc: matchFunc
    }
    this.rules.push(node);
    if (node.pattern.kind === "func") {
      if (typeof (node.pattern.value) !== "string") {
        debugger;
      } else {
        this.byFunc.set(node.pattern.value as string, node);
      }
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
