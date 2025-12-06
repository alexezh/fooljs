import { Runtime } from "./runtime";

export function initCore(runtime: Runtime) {
  runtime.addRule("sum(a, b, c) => sum(sum(a, b), c)")
  runtime.addRule("sum(a, b, c) => sum(sum(a, c), b")
  runtime.addRule("sum(a, b) => def(sym(y), sum(a, b))")
}