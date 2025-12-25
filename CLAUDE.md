# Design Pattern

Rule = single local rewrite: Expr -> Expr with guards/constraints. Cheap, composable, no opinion about “when”.

Skill = named strategy (a function) that runs a sequence + choice over rules (and maybe calls other skills). I.e. State -> State? (Kleisli-ish) where failure is allowed and backtracking is expected.