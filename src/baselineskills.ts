import { SkillId } from "./runtime";
import { SkillRegistry } from "./skillregistry";

export async function seedBaselineSkills(registry: SkillRegistry) {
  // Use serialized AST patterns instead of ruleIds for skill identification
  // These patterns are used for embedding-based lookup

  // ---------------------------------------------------------------------------
  // Equation normalization
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_zero_form_inline" as SkillId,
    name: "Normalize equation to zero-form",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "eq(?a, ?b) => do [eq(?a, ?b) => eq(sum(?a, neg(?b)), 0)]" as any,
    },
    tags: ["eq", "normalize"],
  });

  // ---------------------------------------------------------------------------
  // Local simplification
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "local_simplify_bounded_inline" as SkillId,
    name: "Local simplification pass (bounded)",
    payload: {
      kind: "macro_action",
      budget: 12,
      skillBody: "?x => do [paren(?a) => ?a, neg(neg(?a)) => ?a, neg(0) => 0, sum(?args..., 0, ?rest...) => sum(?args..., ?rest...), sum(?a, ?b) => calc_sum(?a, ?b) where [type(?a, number), type(?b, number)]]" as any,
    },
    tags: ["simplify"],
  });

  // ---------------------------------------------------------------------------
  // Basic numeric evaluation helpers
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eval_numeric_basics_inline" as SkillId,
    name: "Evaluate basic numeric forms",
    payload: {
      kind: "macro_action",
      budget: 8,
      skillBody: "eval(?x) => do [eval(sum(?a, ?b)) => calc_sum(?a, ?b) where [type(?a, number), type(?b, number)], eval(mul(?a, ?b)) => calc_mul(?a, ?b) where [type(?a, number), type(?b, number)], eval(div(?a, ?b)) => calc_div(?a, ?b) where [type(?a, number), type(?b, number)], eval(neg(?a)) => calc_neg(?a) where [type(?a, number)], eval(eval(?x)) => eval(?x)]" as any,
    },
    tags: ["eval", "number", "arithmetic"],
  });

  // ---------------------------------------------------------------------------
  // Canonical algebraic rearrangements
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_symmetry_inline" as SkillId,
    name: "Swap equation sides",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "eq(?a, ?b) => do [eq(?a, ?b) => eq(?b, ?a)]" as any,
    },
    tags: ["eq", "normalize"],
  });

  await registry.add({
    id: "sub_to_sum_inline" as SkillId,
    name: "Rewrite subtraction as sum + neg",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "sub(?a, ?b) => do [sub(?a, ?b) => sum(?a, neg(?b))]" as any,
    },
    tags: ["normalize", "sum"],
  });

  // ---------------------------------------------------------------------------
  // Discharge solve when variable is isolated
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "solve_discharge_isolated_inline" as SkillId,
    name: "Discharge solve when isolated",
    payload: {
      kind: "macro_action",
      budget: 2,
      skillBody: "solve(eq(?x, ?rhs), solved_for(?x)) => do [eq(?x, ?rhs) => ?rhs, eq(?lhs, ?x) => ?lhs]" as any,
    },
    tags: ["solve", "eq", "isolate"],
  });

  // ---------------------------------------------------------------------------
  // Move-addend step
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_move_addend_from_zero_inline" as SkillId,
    name: "Move addend off LHS when RHS is zero",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "eq(sum(?t, ?c), 0) => do [eq(sum(?t, ?c), 0) => eq(?t, neg(?c))]" as any,
    },
    tags: ["eq", "isolate", "progress"],
  });

  await registry.add({
    id: "solve_move_addend_from_zero_inline" as SkillId,
    name: "In solve: move addend off LHS when RHS is zero",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "solve(eq(sum(?x, ?c), 0), solved_for(?x)) => do [eq(sum(?x, ?c), 0) => eq(?x, neg(?c))]" as any,
    },
    tags: ["solve", "eq", "isolate", "progress"],
  });

  // ---------------------------------------------------------------------------
  // Divide-both-sides isolation step
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_divide_both_sides_inline" as SkillId,
    name: "Divide both sides to isolate variable",
    payload: {
      kind: "macro_action",
      budget: 2,
      skillBody: "solve(eq(mul(?k, ?x), ?b), solved_for(?x)) => do [eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k)), eq(mul(?x, ?k), ?b) => eq(?x, div(?b, ?k))]" as any,
    },
    tags: ["solve", "eq", "isolate", "progress"],
  });

  // ---------------------------------------------------------------------------
  // group_same helper action
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "group_same_inline" as SkillId,
    name: "Group identical terms in a sum (exact match)",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "sum(?terms...) => do [sum(?terms...) => group_same(sum(?terms...), ?x) where [type(?x, symbol)]]" as any,
    },
    tags: ["sum", "group"],
  });

  // ---------------------------------------------------------------------------
  // Factor-out-x helper action
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "factor_out_x_from_sum_inline" as SkillId,
    name: "Factor x out of sum of x-multiples",
    payload: {
      kind: "macro_action",
      budget: 1,
      skillBody: "solve(eq(sum(?terms...), ?b), solved_for(?x)) => do [eq(sum(?terms...), ?b) => eq(mul(?x, sum(?qs...)), ?b) where [map_div_by_x(?terms, ?x) => ?qs]]" as any,
    },
    tags: ["solve", "sum", "factor", "progress"],
  });

  // ---------------------------------------------------------------------------
  // Solve ax + c = 0 - composition of normalize → group → move-addend →
  // factor → divide → eval → discharge
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "macro_solve_ax_plus_c_zero_inline_factor_then_eval" as SkillId,
    name: "Solve ax + c = 0 (normalize, move addend, divide, discharge)",
    payload: {
      kind: "macro_action",
      budget: 20,
      skillBody: `solve(eq(?lhs, ?rhs), solved_for(?x)) => do [
        eq(sum(?t, ?c), 0) => eq(?t, neg(?c)) where [type(?c, number)],
        eq(sum(mul(?k, ?y), ?c), 0) => eq(mul(?k, ?y), neg(?c)),
        eq(mul(?k, ?y), ?b) => eq(?y, div(?b, ?k)),
        eq(?y, ?rhs) => ?rhs
      ]` as any,
    },
    tags: ["solve", "linear", "procedure", "generic", "inline_rules"],
  });
}
