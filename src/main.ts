import { initCore } from "./corefunc.js";
import { Runtime } from "./runtime.js";

function main(): void {
  const exprStr = '-4 + 3 * 4 + x + y - 3 + 5y';
  // const exprStr = '4 + 3 * 4';

  initCore(Runtime.instance);
}

main();