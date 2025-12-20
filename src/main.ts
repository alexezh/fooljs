import { AstNode, ASymbol } from "./ast.js";
import { parse } from "./parser.js";
import { initRules } from "./ruletable.js";
import { Runtime } from "./runtime.js";
import { aStarSearch, getSolutionString } from "./search.js";

function parseEquation(s: string): AstNode {
  let ast = parse(s);
  if (ast.kind === 'eq' && ast.value === 'eq') {
    ast = AstNode.create('func', 'solve', [
      ast,
      AstNode.create('func', 'solved_for', [
        AstNode.create('symbol', new ASymbol('x'))
      ])
    ]);
  }

  return ast;
}

function main(): void {
  //const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';
  //const exprStr = '7x + 2x^2 – 14 + 3x^2 = x – 2'
  const exprStr = '7x + 2 = 3'
  //const exprStr = '7x^2 - 2 = 0'

  initRules(Runtime.instance);
  //initStates(Runtime.instance);
  let ast = parseEquation(exprStr);

  const res = aStarSearch(ast);
  if (res) {
    const solStr = getSolutionString(res);
  }

  //const match = Runtime.instance.matchRule(ast);
  //console.log(match?.length);
}

main();