# Design Pattern

Rule = single local rewrite: Expr -> Expr with guards/constraints. Cheap, composable, no opinion about “when”.

Skill = named strategy (a function) that runs a sequence + choice over rules (and maybe calls other skills). I.e. State -> State? (Kleisli-ish) where failure is allowed and backtracking is expected.

Such as the body for skill "solve equation" is defined as:

   solve(eq(?lhs, ?rhs)) => do
      eq(?lhs, ?rhs) => eq(sub(?lhs, ?rhs), 0)
      eq(sub(?a, ?b), 0) => eq(sum(?a, neg(?b)), 0)
      eq(sum(?terms...), 0) => eq(group_same(sum(?terms...), ?x), 0)
      eq(sum(?t, ?c), 0) => eq(?t, neg(?c))
      eq(sum(?terms...), ?b) => 
         eq(mul(?x, sum(?qs...)), ?b)
         where map_div_by_x([?terms...], ?x) => [?qs...]
      eq(mul(?x, ?k), ?b) => eq(?x, div(?b, ?k))
      eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k))
      eq(?x, ?rhs) => eq(?x, eval(?rhs))
      eq(?x, ?rhs) => ?rhs
