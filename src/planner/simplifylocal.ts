// Example meta-action: SimplifyLocal (apply a small set of simplification rules repeatedly)

import { ActionResult, Goal, MetaAction, Path, Runtime } from "./plannercore.js";

// The rules list is provided by you (existing rule IDs).
export class SimplifyLocal implements MetaAction {
  id = "SimplifyLocal";

  constructor(
    private readonly ruleIds: string[],
    private readonly stepBudget: number = 8
  ) { }

  applicable(runtime: Runtime, root: any, goal: Goal, focus: Path): boolean {
    // You can be cheap: always allow it, or check for obvious forms:
    const node = runtime.getAt(root, focus);
    return (
      runtime.matches("sum(?a, ?b, ?rest...)", node) ||
      runtime.matches("mul(?a, ?b, ?rest...)", node) ||
      runtime.matches("neg(neg(?x))", node) ||
      runtime.matches("eval(?e)", node) ||
      runtime.matches("eq(?a, ?b)", node)
    );
  }

  apply(runtime: Runtime, root: any, goal: Goal, focus: Path): ActionResult | null {
    let cur = root;
    const applied: string[] = [];

    for (let i = 0; i < this.stepBudget; i++) {
      let changed = false;

      for (const rid of this.ruleIds) {
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