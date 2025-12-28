interface FuncState {
  args: number;
}

export class JsWriter {
  private lines: string[] = [];
  private nextVar: number = 0;
  private buffer: string = '';
  private stack: FuncState[] = [];
  private vars: Set<string> = new Set();

  public appendLine(l: string) {
    if (this.stack.length > 0) {
      throw 'Invalid state';
    }
    if (this.buffer) {
      this.lines.push(this.buffer);
      this.buffer = '';
    }
    this.lines.push(l);
  }

  public makeVar(): string {
    const name = '_t' + this.nextVar.toString();
    this.nextVar++;
    return name;
  }

  public addNumberVar(v: number): string {
    const name = this.makeVar();
    this.appendLine(`let ${name} = ${v};`)
    return name;
  }

  public addExprVar(v: string): string {
    const name = this.makeVar();
    this.appendLine(`let ${name} = ${v};`)
    return name;
  }

  public writeVar(name: string, val: string): void {
    if (this.vars.has(name)) {
      return;
    }
    this.vars.add(name);
    this.appendLine(`let ${name} = ${val};`);
  }

  public writeBuffer(s: string): void {
    if (this.buffer.length > 40) {
      this.lines.push(this.buffer);
      this.buffer = '';
    }
    this.buffer += s;
  }

  /**
   * Start building a function call
   * @param prefix The function opening (e.g., "AstNode.create('func', 'sum', [")
   */
  public writeCallStart(name: string, ...args: any[]): void {
    if (this.stack.length > 0) {
      const state = this.stack[this.stack.length - 1];
      if (state.args > 0) {
        this.writeBuffer(',');
      }
      state.args++;
    }

    this.writeBuffer(name);
    this.writeBuffer('(');
    this.stack.push({
      args: 0
    });
    for (let arg of args) {
      this.writeCallArg(arg);
    }
  }

  /**
   * Add an argument to the current function
   * If the buffer exceeds 80 characters, flush it to lines
   */
  public writeCallArg(arg: any): void {
    if (this.stack.length === 0) {
      throw new Error('addFuncArg called without startFunc');
    }

    const state = this.stack[this.stack.length - 1];
    if (state.args > 0) {
      this.writeBuffer(',');
    }
    state.args++;
    this.writeBuffer(arg);
  }

  /**
   * Finish building the current function
   * Returns the variable name or inline expression
   */
  public writeCallEnd(): void {
    this.writeListEnd(')');
  }

  private writeListEnd(suffix: string = '])'): void {
    if (this.stack.length === 0) {
      throw new Error('endFunc called without startFunc');
    }

    const state = this.stack.pop()!;

    this.writeBuffer(suffix);
  }

  public writeArrayStart(): void {
    if (this.stack.length > 0) {
      const state = this.stack[this.stack.length - 1];
      if (state.args > 0) {
        this.writeBuffer(',');
      }
      state.args++;
    }

    this.writeBuffer('[');
    this.stack.push({
      args: 0
    });
  }

  public writeArrayElemenent(element: string): void {
    this.writeCallArg(element);
  }

  public writeArrayEnd(): void {
    this.writeListEnd(']');
  }

  public toString(): string {
    return this.lines.join("\n");
  }
}

