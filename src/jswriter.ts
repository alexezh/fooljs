interface FuncState {
  args: number;
}

export class JsWriter {
  private lines: string[] = [];
  private nextVar: number = 0;
  private buffer: string = '';
  private stack: FuncState[] = [];

  public appendLine(l: string) {
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

  public appendNumberVar(v: number): string {
    const name = this.makeVar();
    this.appendLine(`let ${name} = ${v};`)
    return name;
  }

  public appendExprVar(v: string): string {
    const name = this.makeVar();
    this.appendLine(`let ${name} = ${v};`)
    return name;
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
    this.writeBuffer(name);
    this.writeBuffer('(');
    this.stack.push({
      args: 0
    });
    for (let arg of args) {
      this.writeCallArg(arg);
    }
  }

  public writeCallArgStart(): void {
    if (this.stack.length === 0) {
      throw new Error('addFuncArg called without startFunc');
    }

    const state = this.stack[this.stack.length - 1];
    if (state.args > 0) {
      this.writeBuffer(',');
    }
    state.args++;
  }

  /**
   * Add an argument to the current function
   * If the buffer exceeds 80 characters, flush it to lines
   */
  public writeCallArg(arg: any): void {
    this.writeCallArgStart();
    this.writeBuffer(arg);
  }

  /**
   * Finish building the current function
   * Returns the variable name or inline expression
   */
  public writeCallEnd(suffix: string = '])'): void {
    if (this.stack.length === 0) {
      throw new Error('endFunc called without startFunc');
    }

    const state = this.stack.pop()!;

    this.writeBuffer(suffix);
  }

  public writeArrayStart(): void {
    this.writeCallStart('[');
  }

  public writeArrayElemenent(element: string): void {
    this.writeCallArg(element);
  }

  public writeArrayEnd(): void {
    this.writeCallEnd(']');
  }

  public toString(): string {
    return this.lines.join("\n");
  }
}

