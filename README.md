The current focus on fooljs is perform arithmetic computation using a human like patterns. Such as combining terms which produce nice round values first. 
The goal is not to build a solver, but to develop a framework for recursive a* search with modelling

we have list of tokens, which is basically lisp program. This is where lisp was ahead, mix of code and data
but now we add model on it, where compute can go ahead and then go back. And this is from inside the program
which is where my previous attempt ended. 

The latest iteration is a hiearchy of

clause - rule -> pattern for chanding ast

skill - sequence of rules with name

action:

verbs:

solve(x, e) {
  descriptions: [

  ]
  inputs: [
    //eq(?lhs, ?rhs) where x
  ]
  plans: [{
    move to left
    
    collect(is_number()) 
  }]
}

solve_linear.move_left {

}

collect {
  plans: [
    {
      task: collect()
      goal: ?c where is_number(?c)
    }
  ]
  samples: [
    {
      task: 1 + 2 + 3
    }
  ]

}

action - verb + params

simplify:
1 + 2 + 3 => 6 
   simplify(sum(1, 2, 3)) => collect([1, 2, 3]) -> sum

1 + 3 => 4 : collect([1,3]) => sum()
1 + 