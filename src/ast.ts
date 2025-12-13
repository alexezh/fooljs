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
  children: AstNode[] | undefined;
  constraints?: Constraint[];
  private cost?: number;

  constructor(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.constraints = constraints;
  }

  getCost(): number {
    if (this.cost !== undefined) {
      return this.cost;
    }
    // TODO: implement cost calculation based on node complexity
    this.cost = 1;
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
