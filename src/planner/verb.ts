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
  public match: AstNode;
  public goal: AstNode;
  public plan: ReadonlyArray<Clause>;
  public sample: AstNode;
}

export class VerbRegistry {
  private _verbByKind = new Map<VerbKind, Verb[]>();
  private _verbs: Verb[] = [];

  public static instance: VerbRegistry = new VerbRegistry();

  getVerbs(): ReadonlyArray<Verb> {
    return this._verbs;
  }

  addVerb(verb: Verb): void {
    let e = this._verbByKind.get(verb.kind);
    if (!e) {
      e = [];
      this._verbByKind.set(verb.kind, e);
    }
    e.push(verb);
    this._verbs.push(verb);
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

