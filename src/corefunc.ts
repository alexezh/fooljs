import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";

// Helper to check if node is a number
function isNumber(node: AstNode): boolean {
  return node.kind === 'number';
}

// Helper to check if node is a symbol
function isSymbol(node: AstNode): boolean {
  return node.kind === 'symbol';
}

// Helper to check if node is a func with specific name
function isFunc(node: AstNode, name: string): boolean {
  return node.kind === 'func' && node.value === name;
}

// Helper to get function args
function getArgs(node: AstNode): AstNode[] {
  return node.children ?? [];
}

// Helper to check if all nodes are equal
function allEqual(nodes: AstNode[]): boolean {
  if (nodes.length === 0) return true;
  const first = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    if (first.kind !== nodes[i].kind) return false;
    if (first.kind === 'number' && nodes[i].kind === 'number') {
      if (first.value !== nodes[i].value) return false;
    } else if (first.kind === 'symbol' && nodes[i].kind === 'symbol') {
      const firstSym = first.value as ASymbol;
      const nodeSym = nodes[i].value as ASymbol;
      if (firstSym.name !== nodeSym.name) return false;
    } else {
      if (first.toString() !== nodes[i].toString()) return false;
    }
  }
  return true;
}

// sum(?a, ?b, ?c) => sum(add(?a, ?b), ?c)
function ruleAssocLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 3) return undefined;

  const [a, b, c] = args;
  return new AstNode('func', 'sum', [
    new AstNode('func', 'add', [a, b]),
    c
  ]);
}

// sum(?a, ?b, ?c) => sum(add(?a, ?c), ?b)
function ruleAssocMid(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 3) return undefined;

  const [a, b, c] = args;
  return new AstNode('func', 'sum', [
    new AstNode('func', 'add', [a, c]),
    b
  ]);
}

// sum(?a, ?b) => sum(?b, ?a)
function ruleCommutative(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return new AstNode('func', 'sum', [b, a]);
}

// sum(?a, 0) => ?a
function ruleNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(b) || b.value !== 0) return undefined;

  return a;
}

// sum(0, ?a) => ?a
function ruleNeutralLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(a) || a.value !== 0) return undefined;

  return b;
}

// sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name
function ruleLiftSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  // This rule requires a fresh symbol name - skip for now as it needs context
  // We'd need a way to generate fresh symbol names
  return undefined;
}

// eval(?n) => ?n where ?n is number
function ruleEvalNumber(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const n = args[0];
  if (!isNumber(n)) return undefined;

  return n;
}

// eval(sym(?x)) => sym(?x) where ?x is symbol_name
function ruleEvalSymbol(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isFunc(arg, 'sym')) return undefined;

  const symArgs = getArgs(arg);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return arg;
}

// eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name
function ruleEvalProgressive(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const funcCall = args[0];
  if (funcCall.kind !== 'func') return undefined;

  const funcArgs = getArgs(funcCall);
  if (funcArgs.length === 0) return undefined;

  const [first, ...rest] = funcArgs;

  // Create eval(?f(eval(?a), ?rest...))
  return new AstNode('func', 'eval', [
    new AstNode('func', funcCall.value, [
      new AstNode('func', 'eval', [first]),
      ...rest
    ])
  ]);
}

// eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name
function ruleEvalDef(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const defCall = args[0];
  if (!isFunc(defCall, 'def')) return undefined;

  const defArgs = getArgs(defCall);
  if (defArgs.length !== 2) return undefined;

  const [sym, expr] = defArgs;
  if (!isFunc(sym, 'sym')) return undefined;

  const symArgs = getArgs(sym);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return new AstNode('func', 'def', [
    sym,
    new AstNode('func', 'eval', [expr])
  ]);
}

// eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name
function ruleEvalDefSimplify(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const defCall = args[0];
  if (!isFunc(defCall, 'def')) return undefined;

  const defArgs = getArgs(defCall);
  if (defArgs.length !== 2) return undefined;

  const [sym, expr] = defArgs;
  if (!isFunc(sym, 'sym')) return undefined;

  const symArgs = getArgs(sym);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return new AstNode('func', 'eval', [expr]);
}

// mul(?a, ?b, ?c) => mul(prod(?a, ?b), ?c)
function ruleMulAssocLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 3) return undefined;

  const [a, b, c] = args;
  return new AstNode('func', 'mul', [
    new AstNode('func', 'prod', [a, b]),
    c
  ]);
}

// mul(?a, ?b) => mul(?b, ?a)
function ruleMulCommutative(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return new AstNode('func', 'mul', [b, a]);
}

// mul(?a, 1) => ?a
function ruleMulNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(b) || b.value !== 1) return undefined;

  return a;
}

// mul(1, ?a) => ?a
function ruleMulNeutralLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(a) || a.value !== 1) return undefined;

  return b;
}

// mul(?a, 0) => 0
function ruleMulZeroRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(b) || b.value !== 0) return undefined;

  return new AstNode('number', 0);
}

// mul(0, ?a) => 0
function ruleMulZeroLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(a) || a.value !== 0) return undefined;

  return new AstNode('number', 0);
}

// div(?a, 1) => ?a
function ruleDivNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'div')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(b) || b.value !== 1) return undefined;

  return a;
}

// div(?a, ?a) => 1
function ruleDivSelfToOne(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'div')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  // Check if both arguments are identical
  if (a.kind !== b.kind) return undefined;

  if (a.kind === 'number' && b.kind === 'number') {
    if (a.value !== b.value || a.value === 0) return undefined;
    return new AstNode('number', 1);
  } else if (a.kind === 'symbol' && b.kind === 'symbol') {
    const aSym = a.value as ASymbol;
    const bSym = b.value as ASymbol;
    if (aSym.name !== bSym.name) return undefined;
    return new AstNode('number', 1);
  }

  return undefined;
}

// paren(?a) => ?a
function ruleParenRemove(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'paren')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  return args[0];
}

// sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)
// where ?a is number, ?rest is number, all_equal(?a, ?rest...)
function ruleSumToMul(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Check all args are numbers
  for (const arg of args) {
    if (!isNumber(arg)) return undefined;
  }

  // Check all args are equal
  if (!allEqual(args)) return undefined;

  const value = args[0];
  const count = args.length;

  return new AstNode('func', 'mul', [
    new AstNode('number', count),
    value
  ]);
}

// mul(?n, ?a) => sum(?a, ?a, ...) where ?n is number (inverse of sum->mul)
// This expands multiplication by a small constant into repeated addition
function ruleMulToSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [n, a] = args;
  if (!isNumber(n)) return undefined;

  const count = n.value as number;
  if (count < 2 || count > 10) return undefined; // Only expand for small counts

  // Create sum with 'count' copies of 'a'
  const sumArgs = Array(count).fill(a);
  return new AstNode('func', 'sum', sumArgs);
}

export const coreRuleFunctions = [
  ruleAssocLeft,
  ruleAssocMid,
  ruleCommutative,
  ruleNeutralRight,
  ruleNeutralLeft,
  ruleLiftSum,
  ruleEvalNumber,
  ruleEvalSymbol,
  ruleEvalProgressive,
  ruleEvalDef,
  ruleEvalDefSimplify,
  ruleMulAssocLeft,
  ruleMulCommutative,
  ruleMulNeutralRight,
  ruleMulNeutralLeft,
  ruleMulZeroRight,
  ruleMulZeroLeft,
  ruleDivNeutralRight,
  ruleDivSelfToOne,
  ruleParenRemove,
  ruleSumToMul,
  ruleMulToSum
];

export function initCore(runtime: Runtime) {
  const coreRules: [string, (ast: AstNode) => AstNode | undefined][] = [
    // Sum: Associativity variants
    ["sum(?a, ?b, ?c) => sum(add(?a, ?b), ?c)", ruleAssocLeft],
    ["sum(?a, ?b, ?c) => sum(add(?a, ?c), ?b)", ruleAssocMid],

    // Sum: Commutativity and neutral element
    ["sum(?a, ?b) => sum(?b, ?a)", ruleCommutative],
    ["sum(?a, 0) => ?a", ruleNeutralRight],
    ["sum(0, ?a) => ?a", ruleNeutralLeft],

    // Sum: Lift sums into the evaluation flow
    ["sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name", ruleLiftSum],

    // Eval base cases
    ["eval(?n) => ?n where ?n is number", ruleEvalNumber],
    ["eval(sym(?x)) => sym(?x) where ?x is symbol_name", ruleEvalSymbol],

    // Eval structural progression (left-to-right argument evaluation)
    ["eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name", ruleEvalProgressive],

    // Eval handling for definitions
    ["eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name", ruleEvalDef],
    ["eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name", ruleEvalDefSimplify],

    // Multiply: Associativity
    ["mul(?a, ?b, ?c) => mul(prod(?a, ?b), ?c)", ruleMulAssocLeft],

    // Multiply: Commutativity
    ["mul(?a, ?b) => mul(?b, ?a)", ruleMulCommutative],

    // Multiply: Neutral element (1)
    ["mul(?a, 1) => ?a", ruleMulNeutralRight],
    ["mul(1, ?a) => ?a", ruleMulNeutralLeft],

    // Multiply: Zero element
    ["mul(?a, 0) => 0", ruleMulZeroRight],
    ["mul(0, ?a) => 0", ruleMulZeroLeft],

    // Divide: Neutral element
    ["div(?a, 1) => ?a", ruleDivNeutralRight],

    // Divide: Self division
    ["div(?a, ?a) => 1", ruleDivSelfToOne],

    // Parenthesis: Remove unnecessary parens
    ["paren(?a) => ?a", ruleParenRemove],

    // Special: Sum to multiply conversion
    ["sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)", ruleSumToMul],

    // Special: Multiply to sum expansion (expands mul(n, a) to repeated sum)
    ["mul(?n, ?a) => sum(?a, ?rest...) where ?n is number", ruleMulToSum],
  ];

  for (const [ruleStr, ruleFunc] of coreRules) {
    runtime.addRule(ruleStr, ruleFunc);
  }
}
