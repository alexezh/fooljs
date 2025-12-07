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

  private addCoreRule(func: (ast: AstNode) => void, name: string, ...vars: string[]): void {

  }
}

function computeSum(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}

function computeMul(astNode: AstNode): AstNode {
  throw new Error('Not implemented');
}