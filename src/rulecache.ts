import { AstNode, MatchFuncRet } from "./ast.js";
import { astCreateMatcher } from "./ast_match2.js";
import { matcherSymbols, MatcherSymbols } from "./matchersymbols.js";
import { parse } from "./parser.js";
import { RuleBody, RuleId, RuleMeta, RuleNode, RuleTag } from "./runtime.js";

let funcSource = Symbol("FuncSource");

/**
 * cache of compiled rules
 */
export class RuleCache {
  private nextId: number = 1;
  private rules: Map<string, RuleNode> = new Map();
  private exprCache: Map<string, AstNode> = new Map();


  // matchRule(inp: AstNode): MatchFuncRet[] {
  //   const results: MatchFuncRet[] = [];

  //   for (const rule of this.rules) {
  //     const result = rule.matchFunc!(inp);
  //     if (result !== undefined) {
  //       result.ruleDef = rule.def;
  //       results.push(result);
  //     }
  //     continue;
  //   }

  //   return results;
  // }

  compileRule(ruleInp: RuleBody | AstNode): RuleNode {
    // Check cache
    let ruleExpr: AstNode | undefined;
    if (typeof (ruleInp) === "string") {
      ruleExpr = this.exprCache.get(ruleInp);
      if (!ruleExpr) {
        ruleExpr = parse(ruleInp);
        this.exprCache.set(ruleInp, ruleExpr);
      }
    } else {
      ruleExpr = ruleInp;
    }

    if (ruleExpr.kind !== "rule") {
      throw "Should be rule"
    }

    let ruleId = ruleExpr.toString();
    let node = this.rules.get(ruleId);
    if (node) {
      return node;
    }

    node = {
      rule: ruleExpr,
      pattern: ruleExpr.children![0],
      match: ruleExpr.children![1],
      where: ruleExpr.guard,
      matchFunc: undefined!
    }

    const matcher = astCreateMatcher(node);
    node.matchFunc = (ast: AstNode) => matcher(matcherSymbols, ast);

    node.matchFunc[funcSource] = ruleId;

    this.rules.set(ruleId, node);
    return node;
  }
}