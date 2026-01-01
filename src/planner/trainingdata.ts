import { VerbKind } from "./verb.js";

// Training data item
export interface TrainingDataItem {
  sample: string;  // Example expression to train on
  verb: VerbKind;  // Expected verb for this example
  body: string;    // Rule/statement body
}

// Training data array (exported for testing)
export const trainingData: TrainingDataItem[] = [
  // BLOCK 1: evaluate
  {
    sample: "sum(1, 1)",
    verb: "evaluate",
    body: "sum(?a, ?b) => sum(?a, ?b) where[is_number(?a), is_number(?b)]"
  },
  {
    sample: "sum(1, 2, 3)",
    verb: "evaluate",
    body: "sum(?a, ?b, ?c) => sum(?a, ?b, ?c) where[is_number(?a), is_number(?b), is_number(?c)]"
  },
  // BLOCK 2: collect
  {
    sample: "sum(1, 2, x)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(sum(?a, ?b), ?c) where[is_number(?a), is_number(?b)]"
  },
  {
    sample: "sum(1, x, 2)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(sum(?a, ?c), ?b) where[is_number(?a), is_number(?c)]"
  },
  {
    sample: "sum(x, 1, 2)",
    verb: "collect",
    body: "sum(?a, ?b, ?c) => sum(?a, sum(?b, ?c)) where[is_number(?b), is_number(?c)]"
  },
];
