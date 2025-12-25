import { AstNode, MatchFuncRet } from "./ast.js";
import { astMatch, astReplace } from "./ast_match.js";
import { parse } from "./parser.js";
import { RuleBody, RuleId, RuleMeta, RuleNode, RuleTag } from "./runtime.js";

/**
 * cache of compiled rules
 */
export class RuleCache {
  private nextId: number = 1;
  private rules: RuleNode[] = [];
  private exprCache: Map<string, AstNode> = new Map();


  addRule(m: RuleMeta, ruleAst?: AstNode): RuleNode {

    ruleAst ??= parse(m.rule);

    if (ruleAst.kind !== "rule") {
      throw "Should be rule"
    }

    let node: RuleNode = {
      def: m.rule,
      pattern: ruleAst.children![0],
      match: ruleAst.children![1],
      constraints: ruleAst.constraints,
      matchFunc: m.fn!
    }
    this.rules.push(node);
    return node;
  }

  matchRule(inp: AstNode): MatchFuncRet[] {
    const results: MatchFuncRet[] = [];

    for (const rule of this.rules) {
      const result = rule.matchFunc!(inp);
      if (result !== undefined) {
        result.ruleDef = rule.def;
        results.push(result);
      }
      continue;
    }

    return results;
  }

  compileRule(ruleStr: RuleBody): RuleNode {
    // Check cache
    let ruleExpr = this.exprCache.get(ruleStr);
    if (!ruleExpr) {
      ruleExpr = parse(ruleStr);
      this.exprCache.set(ruleStr, ruleExpr);
    }

    const node = this.addRule({
      id: this.nextId.toString() as RuleId,
      rule: ruleStr,
      tags: [],
      fn: (inputAst: AstNode) => {
        let res = astMatch(ruleExpr!.children![0], inputAst);
        if (!res) {
          return undefined;
        }
        const replace = astReplace(ruleExpr!.children![0], res)
        return {
          ruleDef: ruleStr,
          replace: replace,
          cost: 1
        }
      }
    });

    return node;
  }
}