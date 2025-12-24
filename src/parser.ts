import * as ohm from 'ohm-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AstNode, ASymbol, Constraint, FuncName, TypeName } from "./ast.js";

// Examples:
// "1" → AstNode(kind='number', value=1)
// "42" → AstNode(kind='number', value=42)
// "x" → AstNode(kind='symbol', value=ASymbol("x"))
// "?v" → AstNode(kind='patvar', value="v")
// "?x1" → AstNode(kind='patvar', value="x1")
// "a1" → AstNode(kind='symbol', value=ASymbol("a", [AstNode('number', 1)]))
// "x2" → AstNode(kind='symbol', value=ASymbol("x", [AstNode('number', 2)]))
// "a{x, 1}" → AstNode(kind='symbol', value=ASymbol("a", [AstNode('symbol', ASymbol("x")), AstNode('number', 1)]))
// "f{1, 2, 3}" → AstNode(kind='symbol', value=ASymbol("f", [AstNode('number', 1), AstNode('number', 2), AstNode('number', 3)]))
// "sum(a, b)" → AstNode(kind='func', value="sum", children=[AstNode('symbol', ASymbol("a")), AstNode('symbol', ASymbol("b"))])
// "sum(?x, ?y)" → AstNode(kind='func', value="sum", children=[AstNode('patvar', "x"), AstNode('patvar', "y")])
// "add(1, 2)" → AstNode(kind='func', value="add", children=[AstNode('number', 1), AstNode('number', 2)])
// "mul(x1, 3)" → AstNode(kind='func', value="mul", children=[AstNode('symbol', ASymbol("x", [AstNode('number', 1)])), AstNode('number', 3)])
// "sum(?a, ?b) => add(?a, ?b)" → AstNode(kind='rule', value="rule", children=[...])
// "sum(?a, ?b) => add(?a, ?b) where ?a is number, ?b is number" → AstNode with constraints

// Recognition / canonicalization:
// [ (?a, ?x)... ]
//   => alt_fixed(?a, [?x...])
//   where ?a is number,
//         ?x is number

// // Optional expansion back to a flat sequence:
// alt_fixed(?a, [?x...])
//   => [ (?a, ?x)... ]

// Load grammar (grammar.ohm should be in same directory as compiled output)
const grammarPath = join(process.cwd(), 'out', 'grammar.ohm');
const grammarSource = readFileSync(grammarPath, 'utf-8');
const grammar = ohm.grammar(grammarSource);

// Semantic actions
const semantics = grammar.createSemantics().addOperation('toAst', {
  Program(expr) {
    return expr.toAst();
  },

  Rule(left, _arrow, right, whereClause) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();
    const constraints = whereClause.children.length > 0 ? whereClause.children[0].toAst() : undefined;
    return AstNode.create('rule', 'rule', [leftNode, rightNode], constraints);
  },

  Equation(left, _eq, right) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();
    return AstNode.create('eq', 'eq', [leftNode, rightNode]);
  },

  WhereClause(_where, constraintList) {
    return constraintList.toAst();
  },

  ConstraintList(first, _commas, rest) {
    const constraints: Constraint[] = [first.toAst()];
    for (const c of rest.children) {
      constraints.push(c.toAst());
    }
    return constraints;
  },

  Constraint(orConstraint) {
    return orConstraint.toAst();
  },

  OrConstraint_or(left, _or, right) {
    return Constraint.orConstraint(left.toAst(), right.toAst());
  },

  OrConstraint(andConstraint) {
    return andConstraint.toAst();
  },

  AndConstraint_and(left, _and, right) {
    return Constraint.andConstraint(left.toAst(), right.toAst());
  },

  AndConstraint(baseConstraint) {
    return baseConstraint.toAst();
  },

  BaseConstraint_type(patvar, _is, typeName) {
    const varName = patvar.toAst().value as string;
    const type = typeName.sourceString as TypeName;
    return Constraint.typeConstraint(varName, type);
  },

  BaseConstraint_rule(left, _arrow, right) {
    return Constraint.ruleConstraint(left.toAst(), right.toAst());
  },

  BaseConstraint_match(left, _matches, right) {
    return Constraint.matchConstraint(left.toAst(), right.toAst());
  },

  BaseConstraint_assign(left, _eq, right) {
    return Constraint.assignConstraint(left.toAst(), right.toAst());
  },

  BaseConstraint_not(_not, constraint) {
    return Constraint.notConstraint(constraint.toAst());
  },

  BaseConstraint_eq_ast(_eq_ast, _lparen, left, _comma, right, _rparen) {
    return Constraint.eqAstConstraint(left.toAst(), right.toAst());
  },

  BaseConstraint_call(funcCall) {
    return Constraint.callConstraint(funcCall.toAst());
  },

  BaseConstraint_paren(_lparen, constraint, _rparen) {
    return constraint.toAst();
  },

  Expression(expr) {
    return expr.toAst();
  },

  AddExpr_add(left, _op, right) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();

    // Flatten: collect all terms into a single sum
    const terms: AstNode[] = [];

    // Collect terms from left side
    if (leftNode.kind === 'func' && leftNode.value === 'sum') {
      terms.push(...(leftNode.children || []));
    } else {
      terms.push(leftNode);
    }

    // Collect terms from right side
    if (rightNode.kind === 'func' && rightNode.value === 'sum') {
      terms.push(...(rightNode.children || []));
    } else {
      terms.push(rightNode);
    }

    return AstNode.create('func', 'sum', terms);
  },

  AddExpr_sub(left, _op, right) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();

    // Flatten: collect all terms into a single sum
    const terms: AstNode[] = [];

    // Collect terms from left side
    if (leftNode.kind === 'func' && leftNode.value === 'sum') {
      terms.push(...(leftNode.children || []));
    } else {
      terms.push(leftNode);
    }

    // Add negated right side
    const negRight = AstNode.create('func', 'neg', [rightNode]);
    terms.push(negRight);

    return AstNode.create('func', 'sum', terms);
  },

  MulExpr_mul(left, _op, right) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();

    // Flatten: collect all factors into a single mul
    const factors: AstNode[] = [];

    // Collect factors from left side
    if (leftNode.kind === 'func' && leftNode.value === 'mul') {
      factors.push(...(leftNode.children || []));
    } else {
      factors.push(leftNode);
    }

    // Collect factors from right side
    if (rightNode.kind === 'func' && rightNode.value === 'mul') {
      factors.push(...(rightNode.children || []));
    } else {
      factors.push(rightNode);
    }

    return AstNode.create('func', 'mul', factors);
  },

  MulExpr_div(left, _op, right) {
    const leftNode = left.toAst();
    const rightNode = right.toAst();

    // Division doesn't flatten the same way
    // a / b / c = (a / b) / c, not a / (b * c)
    return AstNode.create('func', 'div', [leftNode, rightNode]);
  },

  PowExpr_pow(base, _op, exponent) {
    const baseNode = base.toAst();
    const expNode = exponent.toAst();

    // Power is right-associative: a^b^c = a^(b^c)
    // The grammar already handles this with PowExpr on the right
    return AstNode.create('func', 'pow', [baseNode, expNode]);
  },

  UnaryExpr_neg(_op, expr) {
    return AstNode.create('func', 'neg', [expr.toAst()]);
  },

  ImplicitMul_implicit(num, expr) {
    return AstNode.create('func', 'mul', [num.toAst(), expr.toAst()]);
  },

  SpreadExpr_spread(expr, _dots) {
    const target = expr.toAst();
    return AstNode.create('spread', '...', [target]);
  },

  Primary_paren(_lparen, expr, _rparen) {
    return AstNode.create('func', 'paren', [expr.toAst()]);
  },

  Primary(expr) {
    return expr.toAst();
  },

  FuncCall(target, _lparen, args, _rparen) {
    const callee = target.toAst();
    const argNodes = args.asIteration().children.map((arg: any) => arg.toAst());
    const funcValue = callee instanceof AstNode ? callee : (callee as string);
    if (funcValue === 'eq') {
      return AstNode.create('eq', 'eq', argNodes);
    } else {
      return AstNode.create('func', funcValue as FuncName, argNodes);
    }
  },

  Symbol_indexed(name, _lbrace, indices, _rbrace) {
    const symbolName = name.sourceString;
    const indexNodes = indices.asIteration().children.map((idx: any) => idx.toAst());
    const symbol = new ASymbol(symbolName, indexNodes);
    return AstNode.create('symbol', symbol);
  },

  Symbol_numbered(name, num) {
    const symbolName = name.sourceString;
    const indexValue = parseInt(num.sourceString, 10);
    const symbol = new ASymbol(symbolName, [AstNode.create('number', indexValue)]);
    return AstNode.create('symbol', symbol);
  },

  Symbol_plain(name) {
    const symbolName = name.sourceString;
    const symbol = new ASymbol(symbolName);
    return AstNode.create('symbol', symbol);
  },

  List(_lbrack, elements, _rbrack) {
    const elementNodes = elements.asIteration().children.map((element: any) => element.toAst());
    return AstNode.create('list', 'list', elementNodes);
  },

  Tuple(_lparen, elements, _rparen) {
    const elementNodes = elements.asIteration().children.map((element: any) => element.toAst());
    return AstNode.create('tuple', 'tuple', elementNodes);
  },

  PatVar(_question, name, num) {
    let varName = name.sourceString;
    if (num.children.length > 0) {
      varName += num.sourceString;
    }
    return AstNode.create('patvar', varName);
  },

  number(_digits) {
    return AstNode.create('number', parseInt(this.sourceString, 10));
  },

  ident(_first, _rest) {
    return this.sourceString;
  },

  _iter(...children) {
    return children.map(c => c.toAst());
  }
});

export function parse(text: string): AstNode {
  const match = grammar.match(text);
  if (match.failed()) {
    throw new Error(`Parse error: ${match.message}`);
  }
  return semantics(match).toAst();
}

export function parseEquation(s: string): AstNode {
  let ast = parse(s);
  if (ast.kind === 'eq') {
    ast = AstNode.create('func', 'solve', [
      ast,
      AstNode.create('func', 'solved_for', [
        AstNode.create('symbol', new ASymbol('x'))
      ])
    ]);
  }

  return ast;
}
