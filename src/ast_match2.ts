import { AstNode } from "./ast.js";
import { JsWriter } from "./jswriter.js";

interface IMatcherFuncs {
  or(v1: AstNode, v2: AstNode): boolean;
}

/**
  *
  * rule: "eq(sum(?t, ?c), $rhs) => eq(?t, sum(?rhs, neg(?c)))",
  *
  * translated into
  *   if(expr.value !== "eq") { return false; }
  *   let sum_expr = eq.children[0]
  *   if(sum_expr.value !== "sum") { return false; }
  *   ..
  *
  *   _t5 = AstNode.create('func', 'sum', [rhs, AstNode.create('func', 'neg', [c])]);
  *
  * The overall idea is that patvar become variables in generated code which we can use
  * to make new nodes. The rest we recreate
 */

export function astCreateMatcher(pattern: AstNode, replace: AstNode): Function {
  const writer = new JsWriter();
  writer.appendLine('{')
  processPatternNode(pattern, "expr", writer);
  writer.writeBuffer('return ');
  processReplaceNode(replace, writer);
  writer.appendLine('}')
  const func = new Function("expr", writer.toString());
  return func;
}

function processPatternNode(pattern: AstNode, exprName: string, writer: JsWriter): void {
  switch (pattern.kind) {
    case 'eq':
    case 'func': {
      writer.appendLine(`if( '${pattern.value}' !== ${exprName}.value) { return undefined; }`);
      processPatternFuncArgs(pattern, exprName, writer);
    }
      break;
    case 'number': {
      // check number
      writer.appendLine(`if( ${pattern.value} !== ${exprName}.value) { return undefined; }`);
    }
      break;
    default:
      debugger;
      break;
  }
}

/**
 * // sum(?a, ?mid..., ?b) => sum(eval(sum(?a, ?b)), ?rest...)
  *
   const [a, b, ...rest] = args;
   const [a, ...rest, b] = args;
  */
function processPatternFuncArgs(pattern: AstNode, exprName: string, writer: JsWriter): void {
  // both in terms of expr index
  let startSpreadName: string | undefined;
  let endSpreadName: string | undefined;
  let patternSpread: AstNode | undefined;
  if (!pattern.children) {
    return;
  }

  for (let idx = 0; idx < pattern.children.length; idx++) {
    let v = pattern.children[idx];
    if (v.kind === 'spread') {
      patternSpread = v;
      startSpreadName = writer.appendNumberVar(idx);
      break;
    }
    processPatternFuncArg(v, exprName, idx, writer)
  }

  if (patternSpread) {
    let exprIdx = -1;
    for (let idx = pattern.children.length - 1; idx >= 0; idx--) {
      let v = pattern.children[idx];
      if (v.kind === 'spread') {
        // value negative, printed with - so we skil -
        endSpreadName = writer.appendExprVar(`${exprName}.children.length ${exprIdx}`)
        break;
      }
      processPatternFuncArg(v, exprName, exprIdx, writer)
      exprIdx--;
    }

    writer.appendLine(`let ${patternSpread.children![0].value} = ${exprName}.children.slice(${startSpreadName}, ${endSpreadName});`)
  }
}

/**
 * exprIdx can be negative; meaning from the end
 */
function processPatternFuncArg(argNode: AstNode, exprName: string, exprIdx: number, writer: JsWriter): void {
  if (argNode.kind === 'patvar') {
    // use pattern name as variable
    writer.appendLine(`let ${argNode.value} = ${exprName}.children[${exprIdx}];`)
  } else {
    let exprChildName = writer.appendExprVar(`${exprName}.children[${exprIdx}]`);
    processPatternNode(argNode, exprChildName, writer);
  }
}

/**
 * 
 */
function processReplaceNode(replace: AstNode, writer: JsWriter): void {
  switch (replace.kind) {
    case 'eq':
    case 'func': {
      writer.writeCallStart('AstNode.create', `'${replace.kind}'`, `'${replace.value}'`);
      writer.writeCallArgStart();
      writer.writeArrayStart();
      processReplaceFuncArgs(replace, writer);
      writer.writeArrayEnd();
      writer.writeCallEnd();
    }
      break;
    default:
      debugger;
      break;
  }
}

function processReplaceFuncArgs(replace: AstNode, writer: JsWriter): void {

  for (let idx = 0; idx < replace.children!.length; idx++) {
    let argNode = replace.children![idx];

    if (argNode.kind === 'patvar') {
      // use pattern name as variable
      writer.writeCallArg(argNode.value as string)
    } else if (argNode.kind === 'number') {
      // check number
      writer.writeCallArg(replace.value as any);
    } else {
      processReplaceNode(argNode, writer);
    }
  }
}