import { Runtime } from "./runtime.js";

export function initCore(runtime: Runtime) {
  const coreRules = [
    // Associativity variants
    "sum(?a, ?b, ?c) => sum(add(?a, ?b), ?c)",
    "sum(?a, ?b, ?c) => sum(add(?a, ?c), ?b)",

    // Commutativity and neutral element
    "sum(?a, ?b) => sum(?b, ?a)",
    "sum(?a, 0) => ?a",
    "sum(0, ?a) => ?a",

    // Lift sums into the evaluation flow
    "sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name",

    // Eval base cases
    "eval(?n) => ?n where ?n is number",
    "eval(sym(?x)) => sym(?x) where ?x is symbol_name",

    // Eval structural progression (left-to-right argument evaluation)
    "eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name",

    // Eval handling for definitions
    "eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name",
    "eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name",
  ];

  for (const rule of coreRules) {
    runtime.addRule(rule);
  }
}
