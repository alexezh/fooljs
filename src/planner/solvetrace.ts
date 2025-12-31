import { ClauseId, VerbId } from "./verb";

export interface TraceStep {
  focus: number[];
  appliedChoiceId: ClauseId | VerbId;
  before: any;
  after: any;
}

export interface SolveTrace {
  traceId: string;
  goal: any;
  start: any;
  steps: TraceStep[];
  success: boolean;
}

