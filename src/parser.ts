import { AstNode, ASymbol } from "./ast";

// Examples:
// "1" → AstNode(kind='number', value=1)
// "42" → AstNode(kind='number', value=42)
// "x" → AstNode(kind='symbol', value=ASymbol("x"))
// "?v" → AstNode(kind='var', value="v")
// "?x1" → AstNode(kind='var', value="x1")
// "a1" → AstNode(kind='symbol', value=ASymbol("a", [AstNode('number', 1)]))
// "x2" → AstNode(kind='symbol', value=ASymbol("x", [AstNode('number', 2)]))
// "a{x, 1}" → AstNode(kind='symbol', value=ASymbol("a", [AstNode('symbol', ASymbol("x")), AstNode('number', 1)]))
// "f{1, 2, 3}" → AstNode(kind='symbol', value=ASymbol("f", [AstNode('number', 1), AstNode('number', 2), AstNode('number', 3)]))
// "sum(a, b)" → AstNode(kind='func', value="sum", children=[AstNode('symbol', ASymbol("a")), AstNode('symbol', ASymbol("b"))])
// "sum(?x, ?y)" → AstNode(kind='func', value="sum", children=[AstNode('var', "x"), AstNode('var', "y")])
// "add(1, 2)" → AstNode(kind='func', value="add", children=[AstNode('number', 1), AstNode('number', 2)])
// "mul(x1, 3)" → AstNode(kind='func', value="mul", children=[AstNode('symbol', ASymbol("x", [AstNode('number', 1)])), AstNode('number', 3)])
// "sum(a, b, c) => sum(sum(a, b), c)" →
//      AstNode(kind='rule', value="rule", children=[
//          AstNode('func', "sum", children=[AstNode('symbol', ASymbol("a")), AstNode('symbol', ASymbol("b")), AstNode('symbol', ASymbol("c"))]),
//          AstNode('func', "sum", children=[AstNode('func', "sum", children=[AstNode('symbol', ASymbol("a")), AstNode('symbol', ASymbol("b"))]), AstNode('symbol', ASymbol("c"))])])

type Token = {
  type: 'number' | 'identifier' | 'lparen' | 'rparen' | 'lbrace' | 'rbrace' | 'comma' | 'arrow' | 'question' | 'eof';
  value: string;
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number
    if (/\d/.test(char)) {
      let num = '';
      while (i < text.length && /\d/.test(text[i])) {
        num += text[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifier (letter followed by optional number)
    if (/[a-zA-Z]/.test(char)) {
      let id = '';
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        id += text[i];
        i++;
      }
      tokens.push({ type: 'identifier', value: id });
      continue;
    }

    // Arrow =>
    if (char === '=' && i + 1 < text.length && text[i + 1] === '>') {
      tokens.push({ type: 'arrow', value: '=>' });
      i += 2;
      continue;
    }

    // Question mark for pattern variables
    if (char === '?') {
      tokens.push({ type: 'question', value: '?' });
      i++;
      continue;
    }

    // Parentheses, braces, and comma
    if (char === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (char === '{') {
      tokens.push({ type: 'lbrace', value: '{' });
      i++;
      continue;
    }
    if (char === '}') {
      tokens.push({ type: 'rbrace', value: '}' });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Unknown character, skip
    i++;
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): void {
    this.pos++;
  }

  private expect(type: Token['type']): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    this.advance();
    return token;
  }

  // Parse top-level expression (rule or expression)
  parse(): AstNode {
    const left = this.parseExpression();

    // Check for rule arrow
    if (this.current().type === 'arrow') {
      this.advance();
      const right = this.parseExpression();
      return new AstNode('rule', 'rule', [left, right]);
    }

    return left;
  }

  // Parse expression (number, symbol, pattern variable, or function call)
  private parseExpression(): AstNode {
    const token = this.current();

    // Number
    if (token.type === 'number') {
      this.advance();
      return new AstNode('number', parseInt(token.value, 10));
    }

    // Pattern variable (?v, ?x1, etc.)
    if (token.type === 'question') {
      this.advance();
      const nameToken = this.expect('identifier');
      // Check if followed by number for indexed pattern variable
      let varName = nameToken.value;
      if (this.current().type === 'number') {
        const numToken = this.current();
        this.advance();
        varName = nameToken.value + numToken.value;
      }
      return new AstNode('var', varName);
    }

    // Identifier (could be symbol or function)
    if (token.type === 'identifier') {
      const name = token.value;
      this.advance();

      // Check if followed by number (indexed symbol like "a1")
      if (this.current().type === 'number') {
        const indexToken = this.current();
        this.advance();
        const symbol = new ASymbol(name, [new AstNode('number', parseInt(indexToken.value, 10))]);
        return new AstNode('symbol', symbol);
      }

      // Check if followed by '{' (complex index like "a{x, 1}")
      if (this.current().type === 'lbrace') {
        this.advance();
        const indices: AstNode[] = [];

        // Parse index expressions
        if (this.current().type !== 'rbrace') {
          indices.push(this.parseExpression());

          while (this.current().type === 'comma') {
            this.advance();
            indices.push(this.parseExpression());
          }
        }

        this.expect('rbrace');
        const symbol = new ASymbol(name, indices);
        return new AstNode('symbol', symbol);
      }

      // Check if followed by '(' (function call)
      if (this.current().type === 'lparen') {
        this.advance();
        const args: AstNode[] = [];

        // Parse arguments
        if (this.current().type !== 'rparen') {
          args.push(this.parseExpression());

          while (this.current().type === 'comma') {
            this.advance();
            args.push(this.parseExpression());
          }
        }

        this.expect('rparen');
        return new AstNode('func', name, args);
      }

      // Plain identifier (symbol without index)
      const symbol = new ASymbol(name);
      return new AstNode('symbol', symbol);
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }
}

export function parse(text: string): AstNode {
  const tokens = tokenize(text);
  const parser = new Parser(tokens);
  return parser.parse();
}