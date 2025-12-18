import { AstNode, FuncName, isFunc, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs, isSymbol } from "./corerules.js";

// eval(?n) => ?n where ?n is number
export function ruleEvalNumber(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const n = args[0];
  if (!isNumber(n)) return undefined;

  return {
    replace: n,
    cost: 0 // No new nodes, just unwrapping
  };
}

// eval(sym(?x)) => sym(?x) where ?x is symbol_name
export function ruleEvalSymbol(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isFunc(arg, 'sym')) return undefined;

  const symArgs = getArgs(arg);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return {
    replace: arg,
    cost: 0 // No new nodes, just unwrapping
  };
}

// eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name
export function ruleEvalProgressive(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const funcCall = args[0];
  if (funcCall.kind !== 'func') return undefined;

  const funcArgs = getArgs(funcCall);
  if (funcArgs.length === 0) return undefined;

  const [first, ...rest] = funcArgs;

  // Create eval(?f(eval(?a), ?rest...))
  return {
    replace: AstNode.create('func', 'eval', [
      AstNode.create('func', funcCall.value as FuncName, [
        AstNode.create('func', 'eval', [first]),
        ...rest
      ])
    ]),
    cost: 3 // Creates 3 new nodes: outer eval, inner func, inner eval
  };
}

// eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name
export function ruleEvalDef(ast: AstNode): MatchFuncRet | undefined {
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

  return {
    replace: AstNode.create('func', 'def', [
      sym,
      AstNode.create('func', 'eval', [expr])
    ]),
    cost: 2 // Creates 2 new nodes: def and eval
  };
}

// eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name
export function ruleEvalDefSimplify(ast: AstNode): MatchFuncRet | undefined {
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

  return {
    replace: AstNode.create('func', 'eval', [expr]),
    cost: 1 // Creates 1 new eval node
  };
}

// eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number
export function ruleEvalSum(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const sumCall = args[0];
  if (!isFunc(sumCall, 'sum')) return undefined;

  const sumArgs = getArgs(sumCall);
  if (sumArgs.length !== 2) return undefined;

  const [a, b] = sumArgs;
  if (!isNumber(a) || !isNumber(b)) return undefined;

  const result = (a.value as number) + (b.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(neg(?a)) => calc_neg(?a) where ?a is number
export function ruleEvalNeg(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const negCall = args[0];
  if (!isFunc(negCall, 'neg')) return undefined;

  const negArgs = getArgs(negCall);
  if (negArgs.length !== 1) return undefined;

  const a = negArgs[0];
  if (!isNumber(a)) return undefined;

  const result = -(a.value as number);
  return {
    replace: AstNode.create('number', result),
    cost: 1 // Creates 1 new number node
  };
}

// eval(eval(?x)) => eval(?x)
// Collapse redundant eval wrappers
export function ruleEvalCollapse(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'eval')) return undefined;

  // Return the inner eval
  return {
    replace: inner,
    cost: 0 // No new nodes, just unwrapping
  };
}
