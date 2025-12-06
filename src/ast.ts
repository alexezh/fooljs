export type AstNodeKind = 'var' | 'number' | 'symbol' | 'func' | 'rule';

export class ASymbol {
  name: string;
  index?: AstNode[];
  constructor(name: string, index?: AstNode[]) {
    this.name = name;
    this.index = index;
  }
}

export type AFunc = ASymbol;

export class AstNode {
  kind: AstNodeKind;
  value: number | string | ASymbol;
  children: AstNode[] | undefined;

  constructor(kind: AstNodeKind, value: number | string | ASymbol, children?: AstNode[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
  }
}

