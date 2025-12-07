import { AstNode, ASymbol } from "./ast.js";
import { parse } from "./parser.js";

export class Runtime {
  rules: AstNode[] = [];

  static instance: Runtime = new Runtime();

  init(): void {
    //this.rules.push(new AstNode("sum", [new AstNode(new ASymbol("a")), new AstNode(new ASymbol("b"))]))
    this.addCoreRule(computeSum, "add", "a", "b")
    this.addCoreRule(computeMul, "add", "a", "b")
  }
  addRule(args: string | AstNode): void {
    let ruleAst: AstNode;
    if (typeof (args) === "string") {
      ruleAst = parse(args);
    } else {
      ruleAst = args;
    }

    if (ruleAst.kind !== "rule") {
      throw "Should be rule"
    }

    this.rules.push(ruleAst);
  }

  matchRule(inp: AstNode): AstNode[] {
    const results: AstNode[] = [];

    for (const rule of this.rules) {
      if (!rule.children || rule.children.length < 2) {
        continue;
      }

      const pattern = rule.children[0];
      const replacement = rule.children[1];
      const constraints = rule.constraints;

      const bindings = this.match(pattern, inp);
      if (bindings !== null) {
        // Check constraints if they exist
        if (constraints && !this.checkConstraints(bindings, constraints)) {
          continue;
        }

        // Apply bindings to replacement
        const result = this.substitute(replacement, bindings);
        results.push(result);
      }
    }

    return results;
  }

  private match(pattern: AstNode, input: AstNode): Map<string, AstNode> | null {
    const bindings = new Map<string, AstNode>();

    if (this.matchInternal(pattern, input, bindings)) {
      return bindings;
    }

    return null;
  }

  private matchInternal(pattern: AstNode, input: AstNode, bindings: Map<string, AstNode>): boolean {
    // Pattern variable matches anything
    if (pattern.kind === 'patvar') {
      const varName = pattern.value as string;

      // Check if variable already bound
      if (bindings.has(varName)) {
        // Must match existing binding
        const existing = bindings.get(varName)!;
        return this.astEqual(existing, input);
      }

      // Bind the variable
      bindings.set(varName, input);
      return true;
    }

    // Numbers must match exactly
    if (pattern.kind === 'number') {
      return input.kind === 'number' && pattern.value === input.value;
    }

    // Symbols must match name and indices
    if (pattern.kind === 'symbol') {
      if (input.kind !== 'symbol') {
        return false;
      }

      const patSymbol = pattern.value as ASymbol;
      const inpSymbol = input.value as ASymbol;

      if (patSymbol.name !== inpSymbol.name) {
        return false;
      }

      // Match indices
      const patIndices = patSymbol.index ?? [];
      const inpIndices = inpSymbol.index ?? [];

      if (patIndices.length !== inpIndices.length) {
        return false;
      }

      for (let i = 0; i < patIndices.length; i++) {
        if (!this.matchInternal(patIndices[i], inpIndices[i], bindings)) {
          return false;
        }
      }

      return true;
    }

    // Function calls must match name and arguments
    if (pattern.kind === 'func') {
      if (input.kind !== 'func') {
        return false;
      }

      // Handle pattern variable as function name
      if (pattern.value instanceof AstNode && pattern.value.kind === 'patvar') {
        const varName = pattern.value.value as string;
        const funcName = input.value;

        if (bindings.has(varName)) {
          const existing = bindings.get(varName)!;
          if (existing.kind !== 'symbol' || (existing.value as ASymbol).name !== funcName) {
            return false;
          }
        } else {
          // Bind function name as a symbol
          bindings.set(varName, new AstNode('symbol', new ASymbol(funcName as string)));
        }
      } else if (pattern.value !== input.value) {
        return false;
      }

      const patArgs = pattern.children ?? [];
      const inpArgs = input.children ?? [];

      // Check for spread patterns
      if (patArgs.length > 0 && patArgs[patArgs.length - 1].kind === 'spread') {
        // Pattern has spread at the end
        const spreadPattern = patArgs[patArgs.length - 1];
        const regularPatterns = patArgs.slice(0, -1);

        // Must have at least as many input args as regular patterns
        if (inpArgs.length < regularPatterns.length) {
          return false;
        }

        // Match regular patterns
        for (let i = 0; i < regularPatterns.length; i++) {
          if (!this.matchInternal(regularPatterns[i], inpArgs[i], bindings)) {
            return false;
          }
        }

        // Bind spread to remaining arguments
        const spreadTarget = spreadPattern.children![0];
        if (spreadTarget.kind === 'patvar') {
          const varName = spreadTarget.value as string;
          const remainingArgs = inpArgs.slice(regularPatterns.length);

          if (bindings.has(varName)) {
            // Check existing binding matches
            const existing = bindings.get(varName)!;
            if (existing.kind !== 'list') {
              return false;
            }
            const existingItems = existing.children ?? [];
            if (existingItems.length !== remainingArgs.length) {
              return false;
            }
            for (let i = 0; i < existingItems.length; i++) {
              if (!this.astEqual(existingItems[i], remainingArgs[i])) {
                return false;
              }
            }
          } else {
            bindings.set(varName, new AstNode('list', 'list', remainingArgs));
          }

          return true;
        }

        return false;
      }

      // No spread - must match exactly
      if (patArgs.length !== inpArgs.length) {
        return false;
      }

      for (let i = 0; i < patArgs.length; i++) {
        if (!this.matchInternal(patArgs[i], inpArgs[i], bindings)) {
          return false;
        }
      }

      return true;
    }

    // Lists must match element by element
    if (pattern.kind === 'list') {
      if (input.kind !== 'list') {
        return false;
      }

      const patItems = pattern.children ?? [];
      const inpItems = input.children ?? [];

      if (patItems.length !== inpItems.length) {
        return false;
      }

      for (let i = 0; i < patItems.length; i++) {
        if (!this.matchInternal(patItems[i], inpItems[i], bindings)) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  private astEqual(a: AstNode, b: AstNode): boolean {
    if (a.kind !== b.kind) {
      return false;
    }

    if (a.kind === 'symbol' && b.kind === 'symbol') {
      const aSymbol = a.value as ASymbol;
      const bSymbol = b.value as ASymbol;

      if (aSymbol.name !== bSymbol.name) {
        return false;
      }

      const aIndices = aSymbol.index ?? [];
      const bIndices = bSymbol.index ?? [];

      if (aIndices.length !== bIndices.length) {
        return false;
      }

      for (let i = 0; i < aIndices.length; i++) {
        if (!this.astEqual(aIndices[i], bIndices[i])) {
          return false;
        }
      }

      return true;
    }

    if (a.value !== b.value) {
      return false;
    }

    const aChildren = a.children ?? [];
    const bChildren = b.children ?? [];

    if (aChildren.length !== bChildren.length) {
      return false;
    }

    for (let i = 0; i < aChildren.length; i++) {
      if (!this.astEqual(aChildren[i], bChildren[i])) {
        return false;
      }
    }

    return true;
  }

  private checkConstraints(bindings: Map<string, AstNode>, constraints: import("./ast.js").Constraint[]): boolean {
    for (const constraint of constraints) {
      const binding = bindings.get(constraint.patvar);

      if (!binding) {
        return false;
      }

      if (!this.checkType(binding, constraint.type)) {
        return false;
      }
    }

    return true;
  }

  private checkType(node: AstNode, type: import("./ast.js").TypeName): boolean {
    switch (type) {
      case 'number':
        return node.kind === 'number';
      case 'var':
        return node.kind === 'symbol';
      case 'symbol_name':
        return node.kind === 'symbol';
      case 'func_name':
        return node.kind === 'symbol';
      default:
        return false;
    }
  }

  private substitute(template: AstNode, bindings: Map<string, AstNode>): AstNode {
    // Pattern variable - replace with binding
    if (template.kind === 'patvar') {
      const varName = template.value as string;
      const binding = bindings.get(varName);

      if (binding) {
        return binding;
      }

      // Keep unbound pattern variable as is
      return template;
    }

    // Spread - substitute the target
    if (template.kind === 'spread') {
      const target = template.children![0];
      const substituted = this.substitute(target, bindings);
      return new AstNode('spread', '...', [substituted]);
    }

    // Numbers and plain symbols without children
    if (template.kind === 'number') {
      return template;
    }

    if (template.kind === 'symbol') {
      const symbol = template.value as ASymbol;
      const indices = symbol.index ?? [];

      if (indices.length === 0) {
        return template;
      }

      const newIndices = indices.map(idx => this.substitute(idx, bindings));
      const newSymbol = new ASymbol(symbol.name, newIndices);
      return new AstNode('symbol', newSymbol);
    }

    // Function calls - substitute name and arguments
    if (template.kind === 'func') {
      let newValue = template.value;

      // Handle pattern variable as function name
      if (template.value instanceof AstNode && template.value.kind === 'patvar') {
        const varName = template.value.value as string;
        const binding = bindings.get(varName);

        if (binding && binding.kind === 'symbol') {
          newValue = (binding.value as ASymbol).name;
        }
      }

      const args = template.children ?? [];
      const newArgs: AstNode[] = [];

      for (const arg of args) {
        if (arg.kind === 'spread') {
          // Expand spread arguments
          const spreadTarget = arg.children![0];
          if (spreadTarget.kind === 'patvar') {
            const varName = spreadTarget.value as string;
            const binding = bindings.get(varName);

            if (binding && binding.kind === 'list') {
              // Spread the list items
              const items = binding.children ?? [];
              newArgs.push(...items);
              continue;
            }
          }

          // Keep spread as is if not bound to list
          newArgs.push(this.substitute(arg, bindings));
        } else {
          newArgs.push(this.substitute(arg, bindings));
        }
      }

      return new AstNode('func', newValue, newArgs);
    }

    // Lists
    if (template.kind === 'list') {
      const items = template.children ?? [];
      const newItems = items.map(item => this.substitute(item, bindings));
      return new AstNode('list', 'list', newItems);
    }

    // Tuples
    if (template.kind === 'tuple') {
      const items = template.children ?? [];
      const newItems = items.map(item => this.substitute(item, bindings));
      return new AstNode('tuple', 'tuple', newItems);
    }

    return template;
  }

  private addCoreRule(func: (ast: AstNode) => void, name: string, ...vars: string[]): void {

  }
}

function computeSum(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}

function computeMul(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}