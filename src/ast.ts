import { getCost } from "./ast_cost.js";

export type AstNodeKind =
  'patvar'
  | 'number'
  | 'symbol'
  | 'func'
  | 'eq'
  | 'rule'
  | 'list'
  | 'tuple'
  | 'spread';

export type TypeName = 'number' | 'var' | 'symbol_name' | 'func_name' | 'nonzero_number';
export type FuncName =
  | 'sum'
  | 'mul'
  | 'div'
  | 'add'
  | 'sub'
  | 'pow'
  | 'eval'
  | 'def'
  | 'neg'
  | 'paren'
  | 'sqrt'
  | 'log'
  | 'exp'
  | 'solve'
  | 'holds'
  | 'solved_for'
  | 'step';

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

export type ConstraintKind = 'type' | 'rule' | 'match' | 'assign';

export class Constraint {
  kind: ConstraintKind;
  varName?: string;
  type?: TypeName;
  left?: AstNode;
  right?: AstNode;

  private constructor(kind: ConstraintKind, options: {
    varName?: string;
    type?: TypeName;
    left?: AstNode;
    right?: AstNode;
  }) {
    this.kind = kind;
    this.varName = options.varName;
    this.type = options.type;
    this.left = options.left;
    this.right = options.right;
  }

  static typeConstraint(varName: string, type: TypeName): Constraint {
    return new Constraint('type', { varName, type });
  }

  static ruleConstraint(left: AstNode, right: AstNode): Constraint {
    return new Constraint('rule', { left, right });
  }

  static matchConstraint(left: AstNode, right: AstNode): Constraint {
    return new Constraint('match', { left, right });
  }

  static assignConstraint(left: AstNode, right: AstNode): Constraint {
    return new Constraint('assign', { left, right });
  }

  toString(): string {
    switch (this.kind) {
      case 'type':
        return `${this.varName} is ${this.type}`;
      case 'rule':
        return `${this.left?.toString()}=>${this.right?.toString()}`;
      case 'match':
        return `${this.left?.toString()} matches ${this.right?.toString()}`;
      case 'assign':
        return `${this.left?.toString()}=${this.right?.toString()}`;
      default:
        return '';
    }
  }
}

export type AFunc = ASymbol;

// ============================================================================
// Cost constants - tunable parameters for model optimization
// ============================================================================

export const COST = {
  // Addition costs
  ADD_ZERO: 1,                    // Adding 0 to anything
  ADD_SINGLE_DIGIT: 1,            // Adding two single-digit numbers
  ADD_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit addition

  // Subtraction costs
  SUB_IDENTICAL: 1,               // Subtracting identical numbers (A - A = 0)
  SUB_DIFF_BY_ONE: 2,             // Subtracting numbers that differ by 1
  SUB_PER_DIGIT: 1,               // Cost multiplier per digit for multi-digit subtraction

  // Multiplication costs
  MUL_BY_ZERO: 1,                 // Multiplying by 0
  MUL_BY_ONE: 1,                  // Multiplying by 1
  MUL_SINGLE_DIGIT: 2,            // Multiplying two single-digit numbers
  MUL_DIGIT_EXPONENT: 2,          // Exponent for digit-based cost (cost = digits^exp)

  // Variable costs
  VAR_BASE_COST: 10,              // Base cost for operations involving variables
  VAR_COMBINE_COST: 3,            // Cost to combine like terms (x + x = 2x)
  VAR_CANCEL_REWARD: -5,          // Negative cost (reward) for cancelling terms (x - x = 0)

  // Expression costs
  EXPR_COMBINE_COST: 2,           // Cost to combine compatible expressions

  // Other operation costs
  COEFF_VAR_MUL: 2,               // Cost for coefficient * variable (3 * x = 3x)
  SAME_VAR_MUL: 2,                // Cost for same variable multiplication (x * x = x^2)
  DIV_COST: 2,                    // Base division cost
} as const;

export class AstNode {
  kind: AstNodeKind;
  value: number | string | ASymbol | AstNode;
  children: ReadonlyArray<AstNode> | undefined;
  constraints?: Constraint[];
  private cost?: number;

  private constructor(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: ReadonlyArray<AstNode>, constraints?: Constraint[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.constraints = constraints;
  }

  static create(kind: 'func', value: FuncName, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'patvar', value: string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'number', value: number, children?: AstNode[], constraints?: Constraint[]): AstNode;
  // static create(kind: 'solve', value: 'solve', children?: AstNode[], constraints?: Constraint[]): AstNode;
  // static create(kind: 'solve_for', value: 'solve_for', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'eq', value: 'eq', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'rule', value: 'rule', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'list', value: 'list', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'tuple', value: 'tuple', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'spread', value: '...', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'symbol', value: ASymbol, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]): AstNode {
    return new AstNode(kind, value, children);
  }

  clone(children?: AstNode[]): AstNode {
    return new AstNode(this.kind, this.value, children ?? this.children, this.constraints);
  }

  getCost(): number {
    if (this.cost !== undefined) {
      return this.cost;
    }

    this.cost = getCost(this);
    return this.cost;
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

export function createMul(left: AstNode, right: AstNode): AstNode {
  return AstNode.create('func', 'mul', [left, right]);
}

export function createAdd(left: AstNode, right: AstNode): AstNode {
  return AstNode.create('func', 'add', [left, right]);
}

export function createSub(left: AstNode, right: AstNode): AstNode {
  return AstNode.create('func', 'sub', [left, right]);
}

export function createDiv(left: AstNode, right: AstNode): AstNode {
  return AstNode.create('func', 'div', [left, right]);
}

export function createNeg(node: AstNode): AstNode {
  return AstNode.create('func', 'neg', [node]);
}

export function createPow(base: AstNode, exponent: number): AstNode {
  return AstNode.create('func', 'pow', [base, AstNode.create('number', exponent)]);
}

export function createSqrt(node: AstNode): AstNode {
  return AstNode.create('func', 'sqrt', [node]);
}


export function isFunc(node: AstNode, name: string): boolean {
  return node.kind === 'func' && node.value === name;
}

export function isNumber(node: AstNode): node is AstNode {
  return node.kind === 'number';
}

export function cloneAst(node: AstNode): AstNode {
  return node.clone();
}