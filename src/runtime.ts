import { AstNode, ASymbol } from "./ast";
import { parse } from "./parser";

export class Runtime {
  rules: AstNode[] = [];

  init(): void {
    //this.rules.push(new AstNode("sum", [new AstNode(new ASymbol("a")), new AstNode(new ASymbol("b"))]))
    this.addCoreRule(computeSum, "add", "a", "b")
    this.addCoreRule(computeMul, "add", "a", "b")
  }
  addRule(args: string | { astSrc: AstNode, astDest: AstNode }): void {
    if (typeof (args) === "string") {
      let val = parse(args);
    }
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