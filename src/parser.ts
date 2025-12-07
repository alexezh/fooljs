import * as ohm from 'ohm-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AstNode, ASymbol, Constraint, TypeName } from "./ast.js";

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
    return new AstNode('rule', 'rule', [leftNode, rightNode], constraints);
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

  Constraint(patvar, _is, typeName) {
    const varName = patvar.toAst().value as string;
    const type = typeName.sourceString as TypeName;
    return new Constraint(varName, type);
  },

  Expression(expr) {
    return expr.toAst();
  },

  Primary(expr) {
    return expr.toAst();
  },

  FuncCall(target, _lparen, args, _rparen) {
    const callee = target.toAst();
    const argNodes = args.asIteration().children.map((arg: any) => arg.toAst());
    const funcValue = callee instanceof AstNode ? callee : (callee as string);
    return new AstNode('func', funcValue, argNodes);
  },

  Symbol_indexed(name, _lbrace, indices, _rbrace) {
    const symbolName = name.sourceString;
    const indexNodes = indices.asIteration().children.map((idx: any) => idx.toAst());
    const symbol = new ASymbol(symbolName, indexNodes);
    return new AstNode('symbol', symbol);
  },

  Symbol_numbered(name, num) {
    const symbolName = name.sourceString;
    const indexValue = parseInt(num.sourceString, 10);
    const symbol = new ASymbol(symbolName, [new AstNode('number', indexValue)]);
    return new AstNode('symbol', symbol);
  },

  Symbol_plain(name) {
    const symbolName = name.sourceString;
    const symbol = new ASymbol(symbolName);
    return new AstNode('symbol', symbol);
  },

  List(_lbrack, elements, _rbrack) {
    const elementNodes = elements.asIteration().children.map((element: any) => element.toAst());
    return new AstNode('list', 'list', elementNodes);
  },

  Tuple(_lparen, elements, _rparen) {
    const elementNodes = elements.asIteration().children.map((element: any) => element.toAst());
    return new AstNode('tuple', 'tuple', elementNodes);
  },

  Spread(expr, _dots) {
    const target = expr.toAst();
    return new AstNode('spread', '...', [target]);
  },

  PatVar(_question, name, num) {
    let varName = name.sourceString;
    if (num.children.length > 0) {
      varName += num.sourceString;
    }
    return new AstNode('patvar', varName);
  },

  number(_digits) {
    return new AstNode('number', parseInt(this.sourceString, 10));
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
