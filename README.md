The current focus on fooljs is perform arithmetic computation using a human like patterns. Such as combining terms which produce nice round values first. 
The goal is not to build a solver, but to develop a framework for recursive a* search with modelling

we have list of tokens, which is basically lisp program. This is where lisp was ahead, mix of code and data
but now we add model on it, where compute can go ahead and then go back. And this is from inside the program
which is where my previous attempt ended. So all I need is to combine things. Another thing which was not good 
about lisp is that basic ops were (+, a, b) rather than (sum, a, b, c)

sum a*x, b*x = sum( sum(a + b), x) 
substitute sum(a, b) = y1 where y = 

sum, a, b, c = sum((a + b), c) - number of choices is limited, 1, skip 1, ???
def sum
