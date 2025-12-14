import { initCore } from "./corefunc.js";
import { parse } from "./parser.js";
import { Runtime } from "./runtime.js";
import { aStarSearch } from "./search.js";

function main(): void {
  //const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';
  const exprStr = '7x + 2x^2 – 14 + 3x^2 = x – 2'

  initCore(Runtime.instance);
  const ast = parse(exprStr);
  const res = aStarSearch(ast);
  const match = Runtime.instance.matchRule(ast);
  console.log(match?.length);
}

main();