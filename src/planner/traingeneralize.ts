import { ChatMessage, ChatResponse, LlmClient } from "../llmclient.js";

export interface GeneralizeResult {
  verb: string;
  generalized: string[]; // new DSL statements
  notes?: string[];
  from: string[];
}

function assertStringArray(x: any, name: string): asserts x is string[] {
  if (!Array.isArray(x) || x.some((v) => typeof v !== "string")) {
    throw new Error(`Expected ${name} to be string[]`);
  }
}

// -------------------- requestGeneralize --------------------
// No "goal" parameter: the model infers likely generalization.
export async function requestGeneralize(
  llm: LlmClient,
  verb: string,
  examples: string[]
): Promise<GeneralizeResult> {
  const system: ChatMessage = {
    role: "system",
    content: [
      "You are a DSL generalizer. You receive examples of training statements for ONE verb.",
      "You must propose one or more generalized training statements that cover the examples.",
      "",
      "Output ONLY JSON (no prose).",
      "",
      "DSL format:",
      "  <match> [where <predicates...>] do <stmt1>; <stmt2>; ...; <final_expr>",
      "The last expression is the implicit return.",
      "",
      "Selection model:",
      "  select(<list_or_seq>, <predicate>) binds:",
      "    .  == $selected",
      "    ^  == $unselected",
      "    $all is the original list/seq.",
      "",
      "Generalization moves (use these aggressively, but safely):",
      "1) Replace concrete constants/symbols with parameters (?a, ?b, ?c...).",
      "2) Unify near-identical shapes by renaming parameters consistently.",
      "3) Combine multiple constants into a list for selection/fold patterns when appropriate.",
      "4) Prefer canonical operators: sum/fold for collection, select for focus selection.",
      "5) Keep the verb unchanged.",
      "",
      "Constraints:",
      "- DO NOT introduce varargs (?args...) unless the examples ALREADY contain varargs.",
      "- Prefer the smallest arity-generalization that still subsumes ALL examples.",
      "- Do not invent new DSL keywords; only use tokens already present in the examples plus:",
      "  select, sum, len, is_number, is_symbol (if needed for guards).",
      "",
      "If you cannot generalize without introducing varargs, return generalized: [] and add a note explaining why.",
    ].join("\n"),
  };

  const user: ChatMessage = {
    role: "user",
    content: JSON.stringify(
      {
        verb,
        examples,
        output_schema: {
          verb: "string",
          generalized: ["string"],
          notes: ["string (optional)"],
        },
      },
      null,
      2
    ),
  };

  const resp = await llm.chat([system, user], { temperature: 0 });
  const obj = resp.raw;

  if (typeof obj?.verb !== "string") throw new Error("LLM JSON missing `verb`");
  if (obj.verb !== verb) throw new Error(`LLM changed verb: expected ${verb}, got ${obj.verb}`);

  assertStringArray(obj.generalized, "generalized");
  if (obj.notes !== undefined) assertStringArray(obj.notes, "notes");

  return {
    verb: obj.verb,
    generalized: obj.generalized,
    notes: obj.notes,
    from: examples,
  };
}

// -------------------- Example usage --------------------
export async function example(llm: LlmClient) {
  return await requestGeneralize(llm, "evaluate", [
    "sum(?a, ?b) where is_number(a), is_number(b) do sum(?a, ?b)",
    "sum(?a, ?b, ?c) where is_number(a), is_number(b), is_number(c) do sum(?a, ?b, ?c)",
  ]);
}