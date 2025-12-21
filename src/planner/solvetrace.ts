export interface TraceStep {
  focus: number[];
  appliedRuleId: string;
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

