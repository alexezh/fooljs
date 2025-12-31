Extended spec: trainSumVerb is a learning loop that evaluates results and updates

Purpose

trainSumVerb(orchestrator, llmClient) executes a multi-block curriculum for sum(...) where each block:
	1.	runs seed examples via trainVerb (online updates),
	2.	evaluates outcomes on a verify set (behavioral + verb accuracy),
	3.	requests generalization from the LLM to produce new candidate statements,
	4.	filters + integrates accepted generalized statements,
	5.	repeats (next block), gradually expanding coverage (eventually varargs).

⸻

1) Required behavior of trainVerb inside this loop

Each call to trainVerb(...) must:
	•	Run orchestrator.solveOne(...) with a simplify/eval-appropriate goal (not solve_for(x) unless explicitly requested).
	•	Locate the first decision point where:
	•	focused node matches the statement’s match,
	•	statement where holds.
	•	Compute predictedVerb (what policy would choose pre-update) if available.
	•	Perform an online update to the verb policy using supervision:
	•	expectedVerb = verbKind (passed in).
	•	Return a TrainVerbResult including at least:
	•	decisionFound, predictedVerb, expectedVerb, success, traceId.

⸻

2) Evaluation phase (mandatory after each block)

After finishing the seed statements in a block, trainSumVerb must evaluate:

A) Verb-choice accuracy

On a verify set of expressions (sum-only), measure:
	•	accuracy = (# decision points where predictedVerb == expectedVerb) / (# decision points found)

This requires each verify item to have an expected verb label. For example:
	•	sum(1,1) → evaluate
	•	sum(1,2,x) → collect (if you train collect)
	•	sum(1,x) → check/noop (depending on your design)

B) Semantic effect checks (lightweight)

For each verify run, compute quick structural checks:
	•	For evaluate examples: output is numeric (or fully reduced constant form).
	•	For collect examples: count of numeric leaves outside the selected group decreases, and unselected terms are preserved.

Evaluation must produce a BlockReport:

interface BlockReport {
  blockId: string;
  trainedExamples: number;
  decisionFoundRate: number;
  verbAccuracy?: number;
  semanticPassRate?: number;
  failures: Array<{ exprStr: string; reason: string }>;
}

If evaluation drops below a threshold, the block is considered unstable and generalization results must not be applied.

⸻

3) Generalization checkpoint semantics

requestGeneralize(llmClient, verb, examples) returns generalized: string[] (candidate training statements).

trainSumVerb must then:
	1.	Parse each generalized statement.
	2.	Validate constraints:
	•	No varargs introduced unless this phase permits it.
	•	Uses only allowed constructs (where, do, select, sum, len, predicates…).
	3.	Dry-run evaluation:
	•	Add candidate statements temporarily,
	•	Run the verify set,
	•	Keep only candidates that improve or maintain metrics.

Accepted generalized statements become part of the next training block.

Rejected candidates are logged with reasons (parse error, violates constraints, regresses verify metrics, etc.).

⸻

4) trainSumVerb block structure requirements

A block must have this shape:
	1.	Seed training: several trainVerb(...) calls
	2.	Evaluate + update report
	3.	Generalize
	4.	Filter generalized statements using evaluation
	5.	Proceed

⸻

5) Updated trainSumVerb pseudocode contract

Given your current structure, the intended flow is:

export async function trainSumVerb(orchestrator: Orchestrator<Verb>, llmClient: LlmClient): Promise<void> {
  // BLOCK 1: evaluate seeds
  await trainVerb(...); // updates policy
  await trainVerb(...); // updates policy

  // Evaluate policy after seeds
  const report1 = await evalSumBlock(orchestrator, /*verifySet*/);

  // Generalize based on seed statements
  const gen1 = await requestGeneralize(llmClient, "evaluate", [ ...seedStmts ]);

  // Filter candidates using eval + constraints
  const accepted1 = await acceptGeneralizations(orchestrator, gen1.generalized, /*verifySet*/, report1);

  // (optional) Train on accepted generalizations (online updates)
  for (const stmt of accepted1) {
    await trainVerb(orchestrator, pickExprFor(stmt), "evaluate", stmt);
  }

  // Next blocks...
}

Notes
	•	pickExprFor(stmt) can be:
	•	the original seeds,
	•	or auto-generated expressions consistent with stmt.match (recommended later).
	•	The important part: generalization is not automatically trusted; it is accepted only if it passes evaluation.

⸻

6) Explicitly required for your shown code

In your snippet, you currently call trainVerb(...) without await. In this spec, trainSumVerb must:
	•	await trainVerb(...) (training is sequential; ordering matters for learning).

So block 1 becomes:

await trainVerb(...);
await trainVerb(...);
const report = await evalSumBlock(...);
const gen = await requestGeneralize(...);
const accepted = await acceptGeneralizations(...);
