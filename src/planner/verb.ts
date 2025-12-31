import { AstNode } from "../ast";

export type ClauseId = number & {
  __tag_clauseid: never;
}

export type Clause = {
  id: ClauseId;
  body: AstNode;
}

export type VerbKind =
  | 'normalize'
  | 'collect'
  | 'expand'
  | 'factor'
  | 'move'
  | 'isolate'
  | 'eliminate'
  | 'reduce'
  | 'classify'
  | 'substitute'
  | 'split'
  | 'evaluate'
  | 'check'
  | 'finish'
  | 'reframe';

export type VerbId = number & {
  __tag_verbid: never;
}

export class Verb {
  public id: VerbId;
  public kind: VerbKind;
  public intent: string;
  public input: AstNode;
  public goal: AstNode;
  public plan: ReadonlyArray<Clause>;
  public sample: AstNode;
}

export class VerbRegistry {
  private _verbs = new Map<VerbKind, Verb[]>();

  addVerb(sent: Verb): void {
    let e = this._verbs.get(sent.kind);
    if (!e) {
      e = [];
      this._verbs.set(sent.kind, e);
    }
    e.push(sent);
  }
}

export type VerbFeature = {
  verb: "collect"
  selected_size: 3
  selected_type: "number"
  container: "sum"
  depth: 2
  rest_size: 1
}

// use the same space for IDs
let nextId = 1;
export function makeVerbId(): VerbId {
  let id = nextId++;
  return id as VerbId;
}

export function makeClauseId(): VerbId {
  let id = nextId++;
  return id as VerbId;
}

