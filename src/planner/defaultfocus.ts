import { Runtime } from "../runtime.js";
import { FocusSelector, Goal, Path } from "./plannercore.js";

// A reasonable default: try root + all eq nodes + all pow nodes + limited depth.
export class DefaultFocusSelector implements FocusSelector {
  select(runtime: Runtime, root: any, goal: Goal, maxFocus: number): Path[] {
    const paths: Path[] = [[]]; // always include root
    runtime.walk(root, (node, path) => {
      // Heuristic: focus on equations and powers first (customize freely)
      if (runtime.matches("eq(?a, ?b)", node)) paths.push(path);
      else if (runtime.matches("pow(?a, ?b)", node)) paths.push(path);
      // Add more hooks as needed: mul, sum, eval wrappers, etc.
    });
    // de-dup + cap
    const uniq = new Map<string, Path>();
    for (const p of paths) uniq.set(p.join(","), p);
    return [...uniq.values()].slice(0, maxFocus);
  }
}