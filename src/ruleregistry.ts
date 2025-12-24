import { AstNode, MatchFuncRet } from "./ast.js";
import { parse } from "./parser.js";
import { RuleBody, RuleId, RuleMeta, RuleNode, RuleTag } from "./runtime.js";

export class RuleRegistry {
  private rules: RuleNode[] = [];
  private byFunc = new Map<string, RuleNode>();
  private byId: Map<RuleId, RuleMeta> = new Map();
  private byTag: Map<RuleTag, RuleNode[]> = new Map();
  private byShape: Map<string, RuleNode[]> = new Map();
  private exprCache: Map<string, AstNode> = new Map();


  addRule(m: RuleMeta): void {
    /** Optional: keep meta accessible for features/policy */
    this.byId.set(m.id, m);

    let ruleAst: AstNode;
    ruleAst = parse(m.rule);

    if (ruleAst.kind !== "rule") {
      throw "Should be rule"
    }

    let node: RuleNode = {
      def: m.rule,
      id: m.id,
      tags: m.tags,
      pattern: ruleAst.children![0],
      match: ruleAst.children![1],
      constraints: ruleAst.constraints,
      matchFunc: m.fn!
    }
    this.rules.push(node);
    if (node.pattern.kind === "func") {
      if (typeof (node.pattern.value) !== "string") {
        debugger;
      } else {
        this.byFunc.set(node.pattern.value as string, node);
      }
    }

    for (let tag of m.tags) {
      let e = this.byTag.get(tag);
      if (!e) {
        e = [];
        this.byTag.set(tag, e);
      }
      e.push(node);
    }

    // Index by shape
    const shape = node.pattern.toShapeString();
    if (!this.byShape.has(shape)) {
      this.byShape.set(shape, []);
    }
    this.byShape.get(shape)!.push(node);
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

  findRule(exprStr: RuleBody): RuleNode[] {
    // Check cache
    let ruleExpr = this.exprCache.get(exprStr);
    if (!ruleExpr) {
      ruleExpr = parse(exprStr);
      this.exprCache.set(exprStr, ruleExpr);
    }

    if (ruleExpr.kind !== 'rule') {
      throw "Should be rule";
    }

    const left = ruleExpr.children![0];
    // Get canonical shape representation
    const leftShape = left.toShapeString();

    // Get candidate rules by shape
    const candidates = this.byShape.get(leftShape) || [];

    // Filter by running matchFunc - there might be multiple rules with same shape
    const results: RuleNode[] = [];
    for (const node of candidates) {
      if (node.matchFunc) {
        const result = node.matchFunc(left);
        if (result !== undefined) {
          results.push(node);
        }
      }
    }

    return results;
  }
}