import { AstNode } from "./ast.js";
import { JsWriter } from "./jswriter.js";
import { RuleNode } from "./runtime.js";

function matcherThrow(msg: string): never {
  debugger;
  throw msg;
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

export function astCreateMatcher(rule: RuleNode): Function {
  const writer = new JsWriter();
  writer.appendLine('{')
  processPatternNode(rule.pattern, "expr", writer);
  processContraintsNode(rule.where, "expr", writer);
  writer.writeBuffer('return ');
  processReplaceNode(rule.match, writer);
  writer.appendLine('}')
  const func = new Function("sym", "expr", writer.toString());
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
      matcherThrow('pattern: unknown kind:' + pattern.kind);
  }
}

/**
 * // sum(?a, ?mid..., ?b) => sum(eval(sum(?a, ?b)), ?rest...)
  *
   const [a, b, ...rest] = args;
   const [a, ...rest, b] = args;
  */
function processPatternFuncArgs(pattern: AstNode, exprName: string, writer: JsWriter): void {
  processPatternList(pattern, exprName, writer);
}

function processPatternList(pattern: AstNode, exprName: string, writer: JsWriter): void {
  // both in terms of expr index
  let startSpreadName: string | undefined;
  let endSpreadName: string | undefined;
  let patternSpread: AstNode | undefined;
  if (!pattern.children) {
    return;
  }

  let fixedArgs = 0;
  for (let idx = 0; idx < pattern.children.length; idx++) {
    let v = pattern.children[idx];
    if (v.kind === 'spread') {
      patternSpread = v;
      startSpreadName = writer.addNumberVar(idx);
      break;
    }
    processPatternFuncArg(v, exprName, idx, writer);
    fixedArgs++;
  }

  if (patternSpread) {
    let exprIdx = -1;
    for (let idx = pattern.children.length - 1; idx >= 0; idx--) {
      let v = pattern.children[idx];
      if (v.kind === 'spread') {
        // value negative, printed with - so we skil -
        endSpreadName = writer.addExprVar(`${exprName}.children.length ${exprIdx}`)
        break;
      }
      processPatternFuncArg(v, exprName, exprIdx, writer)
      exprIdx--;
      fixedArgs++;
    }

    writer.appendLine(`if (${exprName}.children.length < ${fixedArgs}) { return undefined; }`);
    writer.appendComment(patternSpread.toString());
    writer.writeVar(patternSpread.children![0].value as string, `${exprName}.children.slice(${startSpreadName}, ${endSpreadName});`)
  } else {
    writer.appendLine(`if (${exprName}.children.length !== ${pattern.children.length}) { return undefined; }`);
  }
}

/**
 * exprIdx can be negative; meaning from the end
 */
function processPatternFuncArg(argNode: AstNode, exprName: string, exprIdx: number, writer: JsWriter): void {
  switch (argNode.kind) {
    case 'number': {
      // use pattern name as variable
      writer.appendLine(`if (${exprName}.children[${exprIdx}].value !== ${argNode.value}) { return undefined; }`);
      break;
    }
    case 'patvar': {
      // use pattern name as variable
      writer.appendComment("patvar: " + argNode.toString());
      writer.writeVar(argNode.value as string, `${exprName}.children[${exprIdx}]`)
      break;
    }
    case 'list': {
      writer.appendComment("list: " + argNode.toString());
      // special case, matching []
      if (argNode.children!.length === 0) {
        writer.appendLine(`if(${exprName}.children.length !== 0) { return undefined; }`);
      } else {
        let listExpr = writer.addExprVar(`${exprName}.children[${exprIdx}]`)
        writer.appendLine(`if (!${listExpr}.children) { return undefined; }`)
        processPatternList(argNode, listExpr, writer);
      }
      break;
    }
    default: {
      writer.appendComment(argNode.toString());
      let exprChildName = writer.addExprVar(`${exprName}.children[${exprIdx}]`);
      processPatternNode(argNode, exprChildName, writer);
      break;
    }
  }
}

function processContraintsNode(where: AstNode[] | undefined, exprName: string, writer: JsWriter): void {
  if (!where) {
    return;
  }
  //if(constraints.kind !== )
  for (const st of where) {
    switch (st.kind) {
      // case 'eq':
      case 'func': {
        //processPatternFuncArgs(pattern, exprName, writer);
        let funcRes = writer.makeVar();
        writer.writeBuffer(`const ${funcRes} = `);
        writer.writeCallStart(`sym.${st.value}` as string);
        processConstraintFuncArgs(st, writer);
        writer.writeCallEnd();
        writer.appendLine(`if( !${funcRes}) { return undefined; }`);

        break;
      }
      case 'bind': {
        if (st.children?.length !== 2) {
          throw 'Invalid bind. Requires two args';
        }
        let right = st.children[1];
        if (right.kind !== 'func') {
          throw 'Invalid bind. Right part has to be function';
        }

        let target = st.children[0];
        if (target.kind === 'patvar') {
          // Simple pattern variable: ?f := gcd_factor(...)
          writer.writeBuffer(`const ${target.value} = `);
          writer.writeCallStart(`sym.${right.value}` as string);
          processConstraintFuncArgs(right, writer);
          writer.writeCallEnd();
          writer.writeBuffer(`;`);
          writer.writeBuffer(`if (${target.value} === undefined) { return undefined; } `);
        } else if (target.kind === 'list') {
          // List with spread: [?quot...] := map_div(...)
          let spread = target.children![0];
          if (spread.kind !== 'spread') {
            throw 'Invalid bind target; has to be spread for now';
          }
          // now we have variable, set it
          let patvar = spread.children![0];
          writer.writeBuffer(`const ${patvar.value} = `);
          writer.writeCallStart(`sym.${right.value}` as string);
          processConstraintFuncArgs(right, writer);
          writer.writeCallEnd();
          writer.writeBuffer(`;`);
          writer.writeBuffer(`if (${patvar.value} === undefined) { return undefined; } `);
        } else {
          throw 'Invalid bind target; has to be patvar or list';
        }
        break;
      }
      //   break;
      // case 'number': {
      //   // check number
      //   writer.appendLine(`if( ${pattern.value} !== ${exprName}.value) { return undefined; }`);
      // }
      //   break;
      default:
        debugger;
        break;
    }
  }
}

/**
 * exprIdx can be negative; meaning from the end
 */
function processConstraintFuncArgs(callNode: AstNode, writer: JsWriter): void {
  for (let arg of callNode.children!) {
    switch (arg.kind) {
      case 'patvar': {
        // unwrap patvar to name of variable
        writer.writeCallArg(arg.value);
        break;
      }
      case 'number': {
        writer.writeCallArg(arg.value);
        break;
      }
      case 'list': {
        // if this is [patvar...], create a list AstNode from the array variable
        // this is simple case
        if (arg.children?.length === 1) {
          let spread = arg.children[0];
          if (spread.kind !== 'spread') {
            throw "Constrains. Only [patvar...] supported"
          }
          let patvar = spread.children![0];
          // we already have list, just pass it
          writer.writeCallArg(patvar.value);
        } else {
          // make new array and pass it
          writer.writeArrayStart();
          for (let elem of arg.children!) {
            switch (elem.kind) {
              case 'patvar':
                writer.writeArrayElemenent(elem.value as string)
                break;
              case 'spread': {
                let patvar = elem.children![0];
                // we already have list, just pass it
                writer.writeCallArg(`...${patvar.value}`);
                break;
              }
              default:
                matcherThrow('contraints: unsupported array element - ' + elem.kind);
            }
          }
          writer.writeArrayEnd();
        }
        break;
      }
      case 'func': {
        writer.writeCallStart(`sym.${arg.value}` as string);
        processConstraintFuncArgs(arg, writer);
        writer.writeCallEnd();
        break;
      }
      default: {
        debugger;
        break;
      }
    }
  }
}

/**
 * 
 */
function processReplaceNode(replace: AstNode, writer: JsWriter): void {
  switch (replace.kind) {
    case 'eq':
    case 'func': {
      writer.writeCallStart('sym.makeNode', `'${replace.kind}'`, `'${replace.value}'`);
      writer.writeArrayStart();
      processReplaceFuncArgs(replace, writer);
      writer.writeArrayEnd();
      writer.writeCallEnd();
    }
      break;
    case 'number': {
      writer.writeBuffer((replace.value as number).toString());
      break;
    }
    case 'patvar': {
      writer.writeBuffer(replace.value as string);
      break;
    }
    case 'list': {
      if (replace.children!.length === 1 && replace.children![0].kind === 'patvar') {
        writer.writeBuffer(replace.value as string);
      } else {
        writer.writeArrayStart()
        for (let elem of replace.children!) {
          switch (elem.kind) {
            case 'number': {
              writer.writeArrayElemenent(elem.value);
              break;
            }
            case 'spread': {
              let patvar = elem.children![0];
              writer.writeArrayElemenent(`...${patvar.value}`);
              break;
            }
            default:
              matcherThrow('replace: unsupported list element type ' + elem.kind);
          }
        }
        writer.writeArrayEnd();
      }
      break;
    }
    case 'do': {
      // for do, we are going to run rule by rule
      // REVIEW: this might create problems with scopes
      writer.writeBuffer('true');
      break;
    }
    default:
      debugger;
      break;
  }
}

function processReplaceFuncArgs(replace: AstNode, writer: JsWriter): void {

  for (let idx = 0; idx < replace.children!.length; idx++) {
    let argNode = replace.children![idx];

    switch (argNode.kind) {
      case 'patvar': {
        // use pattern name as variable
        writer.writeCallArg(argNode.value)
        break;
      }
      case 'number': {
        // check number
        writer.writeCallArg(argNode.value);
        break;
      }
      case 'spread': {
        // spread is generated variable of array type
        // expand it with JS spread
        writer.writeCallArg('...' + argNode.children![0].value);
        break;
      }
      default: {
        processReplaceNode(argNode, writer);
        break;
      }
    }
  }
}