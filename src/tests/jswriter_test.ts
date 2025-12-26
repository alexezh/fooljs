import { AstNode } from "../ast.js";

// Copy the JsWriter class for testing (since it's not exported from ast_match2.ts)
interface FuncState {
  prefix: string;
  args: string[];
  buffer: string;
}

class JsWriter {
  private lines: string[] = [];
  private nextVar: number = 0;
  private stack: FuncState[] = [];

  public appendLine(l: string) {
    this.lines.push(l);
  }

  public makeVar(): string {
    const name = '_t' + this.nextVar.toString();
    this.nextVar++;
    return name;
  }

  public startFunc(prefix: string): void {
    this.stack.push({
      prefix,
      args: [],
      buffer: prefix
    });
  }

  public addFuncArg(arg: string): void {
    if (this.stack.length === 0) {
      throw new Error('addFuncArg called without startFunc');
    }

    const state = this.stack[this.stack.length - 1];

    const separator = state.args.length > 0 ? ', ' : '';
    const addition = separator + arg;

    if (state.buffer.length + addition.length > 80) {
      this.lines.push(state.buffer + (state.args.length > 0 ? ',' : ''));
      state.buffer = '  ' + arg;
    } else {
      state.buffer += addition;
    }

    state.args.push(arg);
  }

  public endFunc(suffix: string = '])'): string {
    if (this.stack.length === 0) {
      throw new Error('endFunc called without startFunc');
    }

    const state = this.stack.pop()!;

    // If it fits on one line, return inline
    const inlineVersion = state.prefix + state.args.join(', ') + suffix;
    if (inlineVersion.length <= 80) {
      return inlineVersion;
    }

    // Otherwise, it's multiline - finalize buffer and create variable
    const completed = state.buffer + suffix;
    const varName = this.makeVar();
    this.lines.push(`let ${varName} = ${completed};`);
    return varName;
  }

  public toString(): string {
    return this.lines.join("\n");
  }
}

console.log("=== Testing JsWriter Stack-based Function Building ===\n");

// Test 1: Short function that fits on one line
try {
  console.log("Test 1: Short function (should be inline)");
  const writer1 = new JsWriter();

  writer1.startFunc("sum(");
  writer1.addFuncArg("a");
  writer1.addFuncArg("b");
  const result1 = writer1.endFunc(")");

  console.log("Result:", result1);
  console.log("Expected: sum(a, b)");

  if (result1 === "sum(a, b)") {
    console.log("✓ Test 1 passed\n");
  } else {
    console.log("✗ Test 1 failed\n");
  }
} catch (e) {
  console.log("✗ Test 1 failed with error:", e);
  console.log();
}

// Test 2: Long function that exceeds 80 characters
try {
  console.log("Test 2: Long function (should use multiline)");
  const writer2 = new JsWriter();

  writer2.startFunc("AstNode.create('func', 'very_long_function_name', [");
  writer2.addFuncArg("very_long_argument_name_1");
  writer2.addFuncArg("very_long_argument_name_2");
  writer2.addFuncArg("very_long_argument_name_3");
  const result2 = writer2.endFunc("])");

  console.log("Result:", result2);
  console.log("Lines:");
  console.log(writer2.toString());

  if (result2.startsWith("_t")) {
    console.log("✓ Test 2 passed (created variable)\n");
  } else {
    console.log("✗ Test 2 failed (should have created variable)\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test 3: Nested functions
try {
  console.log("Test 3: Nested functions");
  const writer3 = new JsWriter();

  writer3.startFunc("outer(");
  writer3.addFuncArg("arg1");

  // Start inner function
  writer3.startFunc("inner(");
  writer3.addFuncArg("x");
  writer3.addFuncArg("y");
  const innerResult = writer3.endFunc(")");

  // Add inner result as arg to outer
  writer3.addFuncArg(innerResult);
  const outerResult = writer3.endFunc(")");

  console.log("Result:", outerResult);
  console.log("Lines:");
  console.log(writer3.toString());

  if (outerResult.includes("inner(x, y)")) {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

// Test 4: Buffer flushing at 80 character limit
try {
  console.log("Test 4: Buffer flushing at 80 chars");
  const writer4 = new JsWriter();

  writer4.startFunc("AstNode.create('func', 'test', [");
  writer4.addFuncArg("short");
  // This arg should cause buffer to exceed 80 and flush
  writer4.addFuncArg("this_is_a_very_long_argument_name_that_will_exceed_eighty_characters_limit");
  const result4 = writer4.endFunc("])");

  console.log("Result:", result4);
  console.log("Lines:");
  const output4 = writer4.toString();
  console.log(output4);

  // Check that output has multiple lines
  if (output4.includes("\n")) {
    console.log("✓ Test 4 passed (flushed to multiple lines)\n");
  } else {
    console.log("✗ Test 4 failed (should have multiple lines)\n");
  }
} catch (e) {
  console.log("✗ Test 4 failed with error:", e);
  console.log();
}

// Test 5: Error handling - addFuncArg without startFunc
try {
  console.log("Test 5: Error handling (addFuncArg without startFunc)");
  const writer5 = new JsWriter();

  try {
    writer5.addFuncArg("arg");
    console.log("✗ Test 5 failed (should have thrown error)\n");
  } catch (e) {
    if (e instanceof Error && e.message.includes("without startFunc")) {
      console.log("✓ Test 5 passed (threw expected error)\n");
    } else {
      console.log("✗ Test 5 failed (wrong error):", e, "\n");
    }
  }
} catch (e) {
  console.log("✗ Test 5 failed with unexpected error:", e);
  console.log();
}

console.log("=== All JsWriter tests completed ===");
