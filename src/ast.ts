import { getCost } from "./ast_cost.js";

export type AstNodeKind =
  'patvar'
  | 'number'
  | 'symbol'
  | 'func'
  | 'eq'
  | 'rule'
  | 'bind'
  | 'list'
  | 'tuple'
  | 'spread'
  | 'do'
  | 'matchroot'
  | 'index';

export type TypeName = 'number' |
  'var' |
  'symbol_name' |
  'func_name';

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
  | 'step'
  | 'fold'
  | 'acc'
  | 'bucket_same'
  | 'pick'
  | 'rest'
  | 'solve_linear'
  | 'rebuild_group'
  | 'collect_sum_numbers'
  | 'collect_mul_numbers';

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

export type TagValue = boolean | number | string;

export class AstNode {
  kind: AstNodeKind;
  value: number | string | ASymbol | AstNode;
  children: ReadonlyArray<AstNode> | undefined;
  public readonly guard?: AstNode[];
  private cost?: number;
  //private changedNodes?: number;
  private totalNodes?: number;
  public source?: string;
  public tags?: Map<string, TagValue>;

  private constructor(
    kind: AstNodeKind,
    value: number | string | ASymbol | AstNode,
    children?: ReadonlyArray<AstNode>,
    guard?: AstNode[]) {
    this.kind = kind;
    this.value = value;
    this.children = children;
    this.guard = guard;
  }

  static create(kind: 'func', value: FuncName, children?: AstNode[]): AstNode;
  static create(kind: 'patvar', value: string | ASymbol | AstNode, children?: AstNode[]): AstNode;
  static create(kind: 'number', value: number, children?: AstNode[]): AstNode;
  // static create(kind: 'solve', value: 'solve', children?: AstNode[]): AstNode;
  // static create(kind: 'solve_for', value: 'solve_for', children?: AstNode[]): AstNode;
  static create(kind: 'eq', value: 'eq', children?: AstNode[]): AstNode;
  static create(kind: 'rule', value: 'rule', children?: AstNode[], where?: AstNode[]): AstNode;
  static create(kind: 'bind', value: 'bind', children?: AstNode[]): AstNode;
  static create(kind: 'list', value: 'list', children?: AstNode[]): AstNode;
  static create(kind: 'tuple', value: 'tuple', children?: AstNode[]): AstNode;
  static create(kind: 'spread', value: '...', children?: AstNode[]): AstNode;
  static create(kind: 'do', value: 'do', children?: AstNode[]): AstNode;
  static create(kind: 'symbol', value: ASymbol, children?: AstNode[]): AstNode;
  static create(kind: 'matchroot', value: '$', children?: AstNode[]): AstNode;
  static create(kind: 'index', value: '$', children?: AstNode[]): AstNode;
  static create(kind: AstNodeKind,
    value: number | string | ASymbol | AstNode,
    children?: AstNode[], guard?: AstNode[]): AstNode {
    return new AstNode(kind, value, children, guard);
  }

  clone(children?: AstNode[]): AstNode {
    const cloned = new AstNode(this.kind, this.value, children ?? this.children, this.guard);
    // Don't copy tags - clones should start fresh
    return cloned;
  }

  setTag(key: string, value: TagValue): void {
    if (!this.tags) {
      this.tags = new Map();
    }
    this.tags.set(key, value);
  }

  getTag(key: string): TagValue | undefined {
    return this.tags?.get(key);
  }

  hasTag(key: string): boolean {
    return this.tags?.has(key) ?? false;
  }

  removeTag(key: string): void {
    this.tags?.delete(key);
  }

  clearTags(prefix?: string): void {
    if (!this.tags) return;
    if (prefix) {
      for (const key of this.tags.keys()) {
        if (key.startsWith(prefix)) {
          this.tags.delete(key);
        }
      }
    } else {
      this.tags.clear();
    }
  }

  getCost(): number {
    if (this.cost !== undefined) {
      return this.cost;
    }

    this.cost = getCost(this);
    return this.cost;
  }

  toString(): string {
    if (this.kind === 'matchroot') {
      return '$';
    }

    if (this.kind === 'index') {
      const indexExpr = this.children && this.children[0];
      const indexStr = indexExpr ? indexExpr.toString() : '?';
      return `$[${indexStr}]`;
    }

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

    if (this.kind === 'do') {
      const rules = this.children ?? [];
      const contents = rules.map(x => x.toString()).join(',');
      return `do [${contents}]`;
    }

    let childrenStr: string | undefined;
    if (this.children) {
      childrenStr = '(' + this.children.map(x => x.toString()).join(',') + ')';
    }

    let constrStr: string | undefined;
    if (this.guard) {
      constrStr = 'where ' + this.guard.map(x => x.toString()).join(',');
    }

    let prefix = this.kind === 'patvar' ? '?' : '';
    const valueStr = this.value instanceof AstNode ? this.value.toString() : this.value.toString();
    return prefix + valueStr + (childrenStr ?? '') + (constrStr ?? '');
  }

  /**
   * Returns a canonical shape representation of the AST.
   * Numbers are replaced with "NUM", symbols with "SYM".
   * Arguments are sorted in canonical order for commutative operations (sum, mul).
   *
   * Examples:
   * - "eq(sum(mul(2,x),4),0)" -> "eq(sum(NUM,mul(NUM,SYM)),NUM)"
   * - "eq(sum(mul(3,x),mul(2,x),5),0)" -> "eq(sum(NUM,mul(NUM,SYM),mul(NUM,SYM)),NUM)"
   */
  toShapeString(): string {
    // Commutative operations that should have their arguments sorted
    const commutativeOps = new Set(['sum', 'mul']);

    if (this.kind === 'number') {
      return 'NUM';
    }

    if (this.kind === 'symbol') {
      return 'SYM';
    }

    if (this.kind === 'patvar') {
      return '?VAR';
    }

    if (this.kind === 'list') {
      const items = this.children ?? [];
      const shapes = items.map(x => x.toShapeString());
      return `[${shapes.join(',')}]`;
    }

    if (this.kind === 'tuple') {
      const items = this.children ?? [];
      const shapes = items.map(x => x.toShapeString());
      return `(${shapes.join(',')})`;
    }

    if (this.kind === 'spread') {
      const target = this.children && this.children[0];
      const targetShape = target ? target.toShapeString() : '';
      return `${targetShape}...`;
    }

    // For functions and other nodes with children
    const valueStr = this.value instanceof AstNode ? this.value.toShapeString() : this.value.toString();

    if (this.children && this.children.length > 0) {
      let childShapes = this.children.map(x => x.toShapeString());

      // Sort arguments for commutative operations to ensure canonical order
      if (this.kind === 'func' && typeof this.value === 'string' && commutativeOps.has(this.value)) {
        childShapes = [...childShapes].sort();
      }

      return `${valueStr}(${childShapes.join(',')})`;
    }

    return valueStr;
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

export type MatchFuncRet = { ruleDef?: string, replace: AstNode, cost: number }
export type MatchFunc = (ast: AstNode) => MatchFuncRet | undefined;

export function astEquals(a: AstNode, b: AstNode): boolean {
  if (a.kind !== b.kind) return false;

  if (a.kind === 'number') {
    return a.value === b.value;
  }

  if (a.kind === 'symbol') {
    const aSym = a.value as ASymbol;
    const bSym = b.value as ASymbol;
    return aSym.name === bSym.name;
  }

  if (a.kind === 'func' || a.kind === 'eq') {
    if (a.value !== b.value) return false;

    const aArgs = a.children ?? [];
    const bArgs = b.children ?? [];

    if (aArgs.length !== bArgs.length) return false;

    for (let i = 0; i < aArgs.length; i++) {
      if (!astEquals(aArgs[i], bArgs[i])) return false;
    }

    return true;
  }

  return a.toString() === b.toString();
}

