export type AstNodeKind = 'patvar' | 'number' | 'symbol' | 'func' | 'rule' | 'list' | 'tuple' | 'spread';

export type TypeName = 'number' | 'var' | 'symbol_name' | 'func_name';

export class ASymbol {
  name: string;
  index?: AstNode[];
  constructor(name: string, index?: AstNode[]) {
    this.name = name;
    this.index = index;
  }

  toString(): string {
    let indexStr: string | undefined;
    if (this.index) {
      indexStr = '{' + this.index.map(x => x.toString()).join(',') + '}'
    }
    return this.name + (indexStr ?? '');
  }
}

export class Constraint {
  patvar: string;
  type: TypeName;
  constructor(patvar: string, type: TypeName) {
    this.patvar = patvar;
    this.type = type;
  }
  toString(): string {
    return `${this.patvar} is ${this.type}`
  }
}

export type AFunc = ASymbol;

export class AstNode {
  kind: AstNodeKind;
  value: number | string | ASymbol | AstNode;
  children: AstNode[] | undefined;
  constraints?: Constraint[];

  constructor(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.constraints = constraints;
  }

  toString(): string {
    if (this.kind === 'list') {
      const items = this.children ?? [];
      const contents = items.map(x => x.toString()).join(',');
      return `[${contents}]`;
    }

    if (this.kind === 'tuple') {
      const items = this.children ?? [];
      const contents = items.map(x => x.toString()).join(',');
      return `(${contents})`;
    }

    if (this.kind === 'spread') {
      const target = this.children && this.children[0];
      const targetStr = target ? target.toString() : '';
      return `${targetStr}...`;
    }

    let childrenStr: string | undefined;
    if (this.children) {
      childrenStr = '(' + this.children.map(x => x.toString()).join(',') + ')';
    }

    let constrStr: string | undefined;
    if (this.constraints) {
      constrStr = 'where ' + this.constraints.map(x => x.toString()).join(',');
    }

    let prefix = this.kind === 'patvar' ? '?' : '';
    const valueStr = this.value instanceof AstNode ? this.value.toString() : this.value.toString();
    return prefix + valueStr + (childrenStr ?? '') + (constrStr ?? '');
  }
}
