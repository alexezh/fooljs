import { AstNode, ASymbol, Constraint } from "./ast.js";
import { parse } from "./parser.js";

type RuleNode = {
  pattern: AstNode,
  match: AstNode,
  constraints?: Constraint[],
  matchFunc: (ast: AstNode) => AstNode | undefined
}

export class Runtime {
  private rules: RuleNode[] = [];
  private byFunc = new Map<string, RuleNode>();

  static instance: Runtime = new Runtime();

  init(): void {
    //this.rules.push(new AstNode("sum", [new AstNode(new ASymbol("a")), new AstNode(new ASymbol("b"))]))
  }

  addRule(args: string | AstNode, matchFunc: (ast: AstNode) => AstNode | undefined): void {
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

  matchRule(inp: AstNode): AstNode[] {
    const results: AstNode[] = [];

    for (const rule of this.rules) {
      const result = rule.matchFunc(inp);
      if (result !== undefined) {
        results.push(result);
      }
      continue;
    }

    return results;
  }
}

function computeSum(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}

function computeMul(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}