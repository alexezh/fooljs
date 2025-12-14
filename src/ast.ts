export type AstNodeKind = 'patvar' | 'number' | 'symbol' | 'func' | 'eq' | 'rule' | 'list' | 'tuple' | 'spread';

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
  | 'exp';

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
  children: AstNode[] | undefined;
  constraints?: Constraint[];
  private cost?: number;

  private constructor(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.constraints = constraints;
  }

  static create(kind: 'func', value: FuncName, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'patvar', value: string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'number', value: number, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'eq', value: 'eq', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'rule', value: 'rule', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'list', value: 'list', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'tuple', value: 'tuple', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'spread', value: '...', children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: 'symbol', value: ASymbol, children?: AstNode[], constraints?: Constraint[]): AstNode;
  static create(kind: AstNodeKind, value: number | string | ASymbol | AstNode, children?: AstNode[], constraints?: Constraint[]): AstNode {
    return new AstNode(kind, value, children);
  }

  clone(): AstNode {
    return new AstNode(this.kind, this.value, this.children ? [...this.children] : undefined, this.constraints);
  }

  getCost(): number {
    if (this.cost !== undefined) {
      return this.cost;
    }

    // Base cases
    if (this.kind === 'number') {
      // Cost based on number of digits
      const numValue = Math.abs(this.value as number);
      const digits = numValue === 0 ? 1 : Math.floor(Math.log10(numValue)) + 1;
      this.cost = digits;
      return this.cost;
    }

    if (this.kind === 'symbol' || this.kind === 'patvar') {
      this.cost = COST.VAR_BASE_COST;
      return this.cost;
    }

    if (this.kind === 'list' || this.kind === 'tuple' || this.kind === 'spread') {
      // Cost is sum of children costs
      const childrenCost = (this.children ?? []).reduce((sum, child) => sum + child.getCost(), 0);
      this.cost = childrenCost;
      return this.cost;
    }

    // Function calls - calculate based on operation type
    if (this.kind === 'func') {
      const funcName = this.value as string;
      const args = this.children ?? [];

      switch (funcName) {
        case 'sum':
          this.cost = this.calculateSumCost(args);
          break;

        case 'mul':
          this.cost = this.calculateMulCost(args);
          break;

        case 'div':
          this.cost = this.calculateDivCost(args);
          break;

        case 'neg':
          this.cost = args.length > 0 ? args[0].getCost() + 1 : 1;
          break;

        case 'paren':
          this.cost = args.length > 0 ? args[0].getCost() : 0;
          break;

        default:
          // Default cost: sum of children costs plus base expression cost
          const childrenCost = args.reduce((sum, child) => sum + child.getCost(), 0);
          this.cost = childrenCost + COST.EXPR_COMBINE_COST;
          break;
      }

      return this.cost;
    }

    // Default for other node types
    this.cost = 1;
    return this.cost;
  }

  private calculateSumCost(args: AstNode[]): number {
    if (args.length === 0) return 0;
    if (args.length === 1) return args[0].getCost();

    let cost = 0;

    // Check for special cases
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check if adding zero
      if (arg.kind === 'number' && arg.value === 0) {
        cost += COST.ADD_ZERO;
        continue;
      }

      // Check for variable cancellation (x + neg(x) = 0)
      if (i < args.length - 1) {
        const next = args[i + 1];
        if (this.areInverses(arg, next)) {
          cost += COST.VAR_CANCEL_REWARD;
          continue;
        }
      }

      // Check if number
      if (arg.kind === 'number') {
        const argNum = Math.abs(arg.value as number);
        const digits = argNum === 0 ? 1 : Math.floor(Math.log10(argNum)) + 1;

        if (digits === 1) {
          cost += COST.ADD_SINGLE_DIGIT;
        } else {
          cost += digits * COST.ADD_PER_DIGIT;
        }
      } else if (arg.kind === 'symbol') {
        // Variable operations
        cost += COST.VAR_BASE_COST;

        // Check for like terms (e.g., x + x)
        for (let j = i + 1; j < args.length; j++) {
          if (this.areEqual(arg, args[j])) {
            cost += COST.VAR_COMBINE_COST;
            break;
          }
        }
      } else {
        // Expression
        cost += arg.getCost() + COST.EXPR_COMBINE_COST;
      }
    }

    return cost;
  }

  private calculateMulCost(args: AstNode[]): number {
    if (args.length === 0) return 0;
    if (args.length === 1) return args[0].getCost();

    let cost = 0;

    // Check for special cases
    for (const arg of args) {
      // Check if multiplying by zero
      if (arg.kind === 'number' && arg.value === 0) {
        return COST.MUL_BY_ZERO;
      }

      // Check if multiplying by one
      if (arg.kind === 'number' && arg.value === 1) {
        cost += COST.MUL_BY_ONE;
        continue;
      }
    }

    // Calculate cost based on operands
    const numberArgs = args.filter(a => a.kind === 'number');
    const varArgs = args.filter(a => a.kind === 'symbol');
    const exprArgs = args.filter(a => a.kind !== 'number' && a.kind !== 'symbol');

    // Number multiplication
    if (numberArgs.length >= 2) {
      const num1 = Math.abs(numberArgs[0].value as number);
      const num2 = Math.abs(numberArgs[1].value as number);
      const digits1 = num1 === 0 ? 1 : Math.floor(Math.log10(num1)) + 1;
      const digits2 = num2 === 0 ? 1 : Math.floor(Math.log10(num2)) + 1;

      if (digits1 === 1 && digits2 === 1) {
        cost += COST.MUL_SINGLE_DIGIT;
      } else {
        cost += Math.pow(digits1 * digits2, COST.MUL_DIGIT_EXPONENT);
      }
    }

    // Coefficient * variable (e.g., 3 * x)
    if (numberArgs.length > 0 && varArgs.length > 0) {
      cost += COST.COEFF_VAR_MUL;
    }

    // Same variable multiplication (e.g., x * x)
    if (varArgs.length >= 2 && this.areEqual(varArgs[0], varArgs[1])) {
      cost += COST.SAME_VAR_MUL;
    }

    // Variable base cost
    cost += varArgs.length * COST.VAR_BASE_COST;

    // Expression costs
    cost += exprArgs.reduce((sum, expr) => sum + expr.getCost() + COST.EXPR_COMBINE_COST, 0);

    return cost;
  }

  private calculateDivCost(args: AstNode[]): number {
    if (args.length !== 2) return COST.DIV_COST;

    const [dividend, divisor] = args;
    let cost = COST.DIV_COST;

    // Add cost of operands
    cost += dividend.getCost();
    cost += divisor.getCost();

    // Division by 1 is cheap
    if (divisor.kind === 'number' && divisor.value === 1) {
      this.cost = 1;
      return 1;
    }

    // Self division (x / x = 1) is cheap
    if (this.areEqual(dividend, divisor)) {
      this.cost = 1;
      return 1;
    }

    return cost;
  }

  private areEqual(a: AstNode, b: AstNode): boolean {
    if (a.kind !== b.kind) return false;

    if (a.kind === 'number' && b.kind === 'number') {
      return a.value === b.value;
    }

    if (a.kind === 'symbol' && b.kind === 'symbol') {
      const aSym = a.value as ASymbol;
      const bSym = b.value as ASymbol;
      return aSym.name === bSym.name;
    }

    // For other types, use string comparison as fallback
    return a.toString() === b.toString();
  }

  private areInverses(a: AstNode, b: AstNode): boolean {
    // Check if b is neg(a)
    if (b.kind === 'func' && b.value === 'neg' && b.children && b.children.length === 1) {
      return this.areEqual(a, b.children[0]);
    }

    // Check if a is neg(b)
    if (a.kind === 'func' && a.value === 'neg' && a.children && a.children.length === 1) {
      return this.areEqual(a.children[0], b);
    }

    return false;
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