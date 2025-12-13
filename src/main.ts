import { initCore } from "./corefunc.js";
import { parse } from "./parser.js";
import { Runtime } from "./runtime.js";

function main(): void {
  const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';

  initCore(Runtime.instance);
  const ast = parse(exprStr);
  const match = Runtime.instance.matchRule(ast);
  console.log(match?.length);
}

main();