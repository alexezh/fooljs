// Example meta-action: NormalizeEq (move RHS to LHS, eq(lhs,rhs)->eq(lhs-rhs,0))

import { ActionResult, Goal, MetaAction, Path, Runtime } from "./plannercore.js";

// This uses your existing rule by ID.
export class NormalizeEq implements MetaAction {
  id = "NormalizeEq";

  constructor(
    private readonly ruleIdEqNormalize: string, // e.g. "ruleEqNormalize"
  ) { }

  applicable(runtime: Runtime, root: any, goal: Goal, focus: Path): boolean {
    const node = runtime.getAt(root, focus);
    // Must be an equation; and ideally not already in zero-form.
    if (!runtime.matches("eq(?lhs, ?rhs)", node)) return false;
    if (runtime.matches("eq(?lhs, 0)", node)) return false;
    // Usually useful for solve/normalize/simplify; harmless elsewhere.
    return goal.kind !== "compute";
  }

  apply(runtime: Runtime, root: any, goal: Goal, focus: Path): ActionResult | null {
    const next = runtime.tryApplyRuleAt(this.ruleIdEqNormalize, root, focus);
    if (!next) return null;
    return { nextRoot: next, info: { appliedRuleIds: [this.ruleIdEqNormalize], focus } };
  }
}
