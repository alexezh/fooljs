Selection Variables Specification

Core Views

When a selection is active, the system defines:

Name	Meaning	Shortcut
$selected	Elements chosen by the selector	.
$unselected	Elements not chosen by the selector	^
$all	Original input before selection	(none)

Aliases:
	•	. ≡ $selected
	•	^ ≡ $unselected

select semantics

select <predicate> (or select(<predicate>)) applied to an ordered collection X produces:
	•	$selected = [ x in X | predicate(x) ] (stable order)
	•	$unselected = [ x in X | !predicate(x) ] (stable order)
	•	$all = X

Selection is stable and total (each element goes to exactly one of the two lists).

Defaults when no selection is performed

If no select has occurred in the current scope:
	•	$all = the current input collection (or the current focused list, if your verb provides one)
	•	$selected = []
	•	$unselected = $all

So “everything is unselected” by default.

Scope rules
	•	$selected/$unselected/$all are scoped to the current do block
	•	Each select overwrites the previous selection variables
	•	Nested blocks shadow outer selection variables

Example

simplify(sum(?args...))
do
  select is_number
  collect(.) -> c
  -> sum(^..., c)

Input: sum(1, 2, x, 3)
After select is_number:
	•	. = [1,2,3]
	•	^ = [x]

Result: sum(x, 6)

