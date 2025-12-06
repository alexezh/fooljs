export type AstNodeKind = 'patvar' | 'number' | 'symbol' | 'func' | 'rule';

export type TypeName = 'number' | 'var';

export class ASymbol {
  name: string;
  index?: AstNode[];
  constructor(name: string, index?: AstNode[]) {
    this.name = name;
    this.index = index;
  }
}

export class Constraint {
  patvar: string;
  type: TypeName;
  constructor(patvar: string, type: TypeName) {
    this.patvar = patvar;
    this.type = type;
  }
}

export type AFunc = ASymbol;

export class AstNode {
  kind: AstNodeKind;
  value: number | string | ASymbol;
  children: AstNode[] | undefined;
  constraints?: Constraint[];

  constructor(kind: AstNodeKind, value: number | string | ASymbol, children?: AstNode[], constraints?: Constraint[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.constraints = constraints;
  }
}

