The current focus on fooljs is perform arithmetic computation using a human like patterns. Such as combining terms which produce nice round values first. 
The goal is not to build a solver, but to develop a framework for recursive a* search with modelling

now I can say .. here are three memories, what are common patterns?

Generalizing compute
- first we find that first + last or every second makes easy compute - which is first plus last, 
- then we represent it as (1 + x) + (2 + x-1) = 2*d ?
- now we need to jump that 2 is 4/2 ?? 

first, last require deeper model of world. We are going to use LLM for this. Question, how do we jump to counts. this
comes from I've done this N times and pairs. Which is again our experience on groupping. Or that we think about numbers
as magical ... numerology. 

I can say - this operation (as sequence makes best results, make me function)