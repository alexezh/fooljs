// Example meta-action: ExpandForCancellation (apply distributive expansion rules if useful)

import { ActionResult, Goal, MetaAction, Path, Runtime } from "./plannercore.js";

// Here we keep it as a placeholder; you wire your own rule ids + heuristics.
export class ExpandForCancellation implements MetaAction {
  id = "ExpandForCancellation";
  constructor(
    private readonly expansionRuleIds: string[],
    private readonly stepBudget: number = 3
  ) { }

  applicable(runtime: Runtime, root: any, goal: Goal, focus: Path): boolean {
    const node = runtime.getAt(root, focus);
    // A typical trigger: subtraction of products, or mul(sum(...), ...)
    return (
      runtime.matches("sub(mul(?a, ?b), mul(?c, ?d))", node) ||
      runtime.matches("mul(?a, sum(?t...))", node) ||
      runtime.matches("mul(sum(?t...), ?a)", node)
    );
  }

  apply(runtime: Runtime, root: any, goal: Goal, focus: Path): ActionResult | null {
    let cur = root;
    const applied: string[] = [];

    for (let i = 0; i < this.stepBudget; i++) {
      let changed = false;
      for (const rid of this.expansionRuleIds) {
        const next = runtime.tryApplyRuleAt(rid, cur, focus);
        if (next) {
          cur = next;
          applied.push(rid);
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }

    if (applied.length === 0) return null;
    return { nextRoot: cur, info: { appliedRuleIds: applied, focus } };
  }
}
