import { astCreateMatcher } from "./ast_match2";
import { matcherSymbols } from "./matchersymbols";
import { parse } from "./parser";
import { RuleNode } from "./runtime";

function testRule(rule: string, expr: string): void {

  let ruleAst = parse(rule);
  let node: RuleNode = {
    def: rule,
    pattern: ruleAst.children![0],
    match: ruleAst.children![1],
    where: ruleAst.where,
    constraints: ruleAst.constraints,
    matchFunc: undefined!
  }

  let func = astCreateMatcher(node);
  let exprAst = parse(expr);
  func(matcherSymbols, exprAst);
}

export function testMatcherCodegen(): void {
  // set up runtime
  testRule()
}