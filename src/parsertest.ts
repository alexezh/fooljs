import { parse } from "./parser.js";

function validateAst(inp: string, output: string): void {
  let ast = parse(inp);
  console.assert(ast.toString() === output);
}
function parsertest(): void {
  validateAst("1", "1");
}

parsertest();