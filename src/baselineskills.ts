import { SkillId } from "./runtime";
import { SkillRegistry } from "./skillregistry";

export async function seedBaselineSkills(registry: SkillRegistry) {
  // Use serialized AST patterns instead of ruleIds for skill identification
  // These patterns are used for embedding-based lookup

  // ---------------------------------------------------------------------------
  // Equation normalization (already)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_zero_form_inline" as SkillId,
    name: "Normalize equation to zero-form",
    payload: {
      kind: "macro_action",
      budget: 1,
      match: "eq(?a, ?b)",
      steps: [{
        ruleBody: "eq(?a, ?b) => eq(sum(?a, neg(?b)), 0)",
        focus: "same",
      }],
    },
    tags: ["eq", "normalize"],
  });

  // ---------------------------------------------------------------------------
  // Local simplification (already)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "local_simplify_bounded_inline" as SkillId,
    name: "Local simplification pass (bounded)",
    payload: {
      kind: "macro_action",
      match: "paren(?a) | neg(neg(?a)) | neg(0) | sum(?args..., 0, ?rest...) | sum(?a, ?b)",
      budget: 12,
      steps: [
        { ruleBody: "paren(?a) => ?a", focus: "same" },
        { ruleBody: "neg(neg(?a)) => ?a", focus: "same" },
        { ruleBody: "neg(0) => 0", focus: "same" },
        { ruleBody: "sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)", focus: "same" },
        { ruleBody: "sum(?a, ?b) => calc_sum(?a, ?b) where ?a is number, ?b is number", focus: "same" },
      ],
    },
    tags: ["simplify"],
  });

  // ---------------------------------------------------------------------------
  // Basic numeric evaluation helpers (so eval_rhs step feels natural)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eval_numeric_basics_inline" as SkillId,
    name: "Evaluate basic numeric forms",
    payload: {
      kind: "macro_action",
      match: "eval(sum(?a, ?b)) | eval(mul(?a, ?b)) | eval(div(?a, ?b)) | eval(neg(?a))",
      budget: 8,
      steps: [
        { ruleBody: "eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number", focus: "same" },
        { ruleBody: "eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number", focus: "same" },
        { ruleBody: "eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number", focus: "same" },
        { ruleBody: "eval(neg(?a)) => calc_neg(?a) where ?a is number", focus: "same" },
        { ruleBody: "eval(eval(?x)) => eval(?x)", focus: "same" },
      ],
    },
    tags: ["eval", "number", "arithmetic"],
  });

  // ---------------------------------------------------------------------------
  // Canonical algebraic rearrangements (small, general)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_symmetry_inline" as SkillId,
    name: "Swap equation sides",
    payload: {
      kind: "macro_action",
      match: "eq(?a, ?b)",
      budget: 1,
      steps: [{ ruleBody: "eq(?a, ?b) => eq(?b, ?a)", focus: "same" }],
    },
    tags: ["eq", "normalize"],
  });

  await registry.add({
    id: "sub_to_sum_inline" as SkillId,
    name: "Rewrite subtraction as sum + neg",
    payload: {
      kind: "macro_action",
      match: "sub(?a, ?b)",
      budget: 1,
      steps: [{ ruleBody: "sub(?a, ?b) => sum(?a, neg(?b))", focus: "same" }],
    },
    tags: ["normalize", "sum"],
  });

  // ---------------------------------------------------------------------------
  // Discharge solve when variable is isolated (works for any solver macro)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "solve_discharge_isolated_inline" as SkillId,
    name: "Discharge solve when isolated",
    payload: {
      kind: "macro_action",
      match: "solve(eq(?x, ?rhs), solved_for(?x)) | solve(eq(?lhs, ?x), solved_for(?x))",
      budget: 2,
      steps: [
        { ruleBody: "solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs", focus: "same" },
        { ruleBody: "solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs", focus: "same" },
      ],
    },
    tags: ["solve", "eq", "isolate"],
  });

  // ---------------------------------------------------------------------------
  // Move-addend step (used by linear solve, but also generally useful)
  // (t + c) = 0  =>  t = -c
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_move_addend_from_zero_inline" as SkillId,
    name: "Move addend off LHS when RHS is zero",
    payload: {
      kind: "macro_action",
      match: "eq(sum(?t, ?c), 0)",
      budget: 1,
      steps: [{ ruleBody: "eq(sum(?t, ?c), 0) => eq(?t, neg(?c))", focus: "same" }],
    },
    tags: ["eq", "isolate", "progress"],
  });

  // Same but under solve(...) (keeps goal in term)
  await registry.add({
    id: "solve_move_addend_from_zero_inline" as SkillId,
    name: "In solve: move addend off LHS when RHS is zero",
    payload: {
      kind: "macro_action",
      match: "solve(eq(sum(?t, ?c), 0), solved_for(?x))",
      budget: 1,
      steps: [{
        ruleBody: "solve(eq(sum(?t, ?c), 0), solved_for(?x)) => solve(eq(?t, neg(?c)), solved_for(?x))",
        focus: "same",
      }],
    },
    tags: ["solve", "eq", "isolate", "progress"],
  });

  // ---------------------------------------------------------------------------
  // Divide-both-sides isolation step (generic; linear solver uses it)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "eq_divide_both_sides_inline" as SkillId,
    name: "Divide both sides to isolate variable",
    payload: {
      kind: "macro_action",
      match: "solve(eq(mul(?k, ?x), ?b), solved_for(?x)) | solve(eq(mul(?x, ?k), ?b), solved_for(?x))",
      budget: 2,
      steps: [
        { ruleBody: "solve(eq(mul(?k, ?x), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))", focus: "same" },
        { ruleBody: "solve(eq(mul(?x, ?k), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))", focus: "same" },
      ],
    },
    tags: ["solve", "eq", "isolate", "progress"],
  });

  // ---------------------------------------------------------------------------
  // group_same helper action (so it’s a natural preceding capability)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "group_same_inline" as SkillId,
    name: "Group identical terms in a sum (exact match)",
    payload: {
      kind: "macro_action",
      match: "sum(?terms...)",
      budget: 1,
      steps: [{
        ruleBody: "sum(?terms...) => group_same(sum(?terms...), ?x) where ?x is symbol", // choose target externally
        focus: "same",
      }],
    },
    tags: ["sum", "group"],
  });

  // ---------------------------------------------------------------------------
  // Factor-out-x helper action (explicitly introduces the map_div_by_x capability)
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "factor_out_x_from_sum_inline" as SkillId,
    name: "Factor x out of sum of x-multiples",
    payload: {
      kind: "macro_action",
      match: "solve(eq(sum(?terms...), ?b), solved_for(?x))",
      budget: 1,
      steps: [{
        ruleBody:
          "solve(eq(sum(?terms...), ?b), solved_for(?x)) => " +
          "solve(eq(mul(?x, sum(?qs...)), ?b), solved_for(?x)) " +
          "where map_div_by_x([?terms...], ?x) => [?qs...]",
        focus: "same",
      }],
    },
    tags: ["solve", "sum", "factor", "progress"],
  });

  // ---------------------------------------------------------------------------
  // Solve ax + c = 0 (existing macro) — now feels like a composition
  // of normalize → group → move-addend → factor → divide → eval → discharge.
  // ---------------------------------------------------------------------------
  await registry.add({
    id: "macro_solve_ax_plus_c_zero_inline_factor_then_eval" as SkillId,
    name: "Solve ax + c = 0 (factor x, isolate, then eval RHS)",
    payload: {
      kind: "macro_action",
      match: "solve(eq(?lhs, ?rhs), solved_for(?x))",
      budget: 14,
      steps: [
        // 1) Normalize equation to zero form
        {
          ruleBody: "solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(sub(?a, ?b), 0), solved_for(?x)) => solve(eq(sum(?a, neg(?b)), 0), solved_for(?x))",
          focus: "same",
        },

        // 2) (Optional) group exact x terms to the front (cheap helper)
        {
          ruleBody: "solve(eq(sum(?terms...), 0), solved_for(?x)) => solve(eq(group_same(sum(?terms...), ?x), 0), solved_for(?x))",
          focus: "same",
        },

        // 3) Move constant tail to RHS: (t + c) = 0 => t = -c
        {
          ruleBody: "solve(eq(sum(?t, ?c), 0), solved_for(?x)) => solve(eq(?t, neg(?c)), solved_for(?x))",
          focus: "same",
        },

        // 4) Factor out x from a sum of x-multiples:
        {
          ruleBody:
            "solve(eq(sum(?terms...), ?b), solved_for(?x)) => " +
            "solve(eq(mul(?x, sum(?qs...)), ?b), solved_for(?x)) " +
            "where map_div_by_x([?terms...], ?x) => [?qs...]",
          focus: "same",
        },

        // 5) Isolate x by dividing both sides by the other factor
        {
          ruleBody: "solve(eq(mul(?x, ?k), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(mul(?k, ?x), ?b), solved_for(?x)) => solve(eq(?x, div(?b, ?k)), solved_for(?x))",
          focus: "same",
        },

        // 6) Evaluate RHS as a whole
        {
          ruleBody: "solve(eq(?x, ?rhs), solved_for(?x)) => solve(eq(?x, eval(?rhs)), solved_for(?x))",
          focus: "same",
        },

        // 7) Discharge
        {
          ruleBody: "solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs",
          focus: "same",
        },
        {
          ruleBody: "solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs",
          focus: "same",
        },
      ],
    },
    tags: ["solve", "linear", "procedure", "generic", "inline_rules", "factor", "eval_rhs"],
  });
}
