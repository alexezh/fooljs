// ----------------------------
// 5) RL decides when to use accepted abstractions (skills)
// ----------------------------
//
// You already have a policy skeleton. The idea is:
// - SkillRegistry holds accepted meta-actions/macros
// - Policy chooses among them during solve
// - We log experience and update policy
//
// Here, "availableSkills" is everything in the registry that is relevant to this goal.

import { AstNode, Constraint } from "./ast.js";
import { astMatch } from "./ast_match.js";
import { astReplace } from "./ast_match.js";
import { parse } from "./parser.js";
import { Goal } from "./planner/plannercore.js";
import { Runtime, SkillId } from "./runtime.js";
import { SkillDescriptor } from "./skilldescriptor.js";

export class SkillExecutor {
  constructor(private readonly runtime: Runtime) { }

  /**
   * Check if constraints are satisfied given current bindings
   */
  private checkConstraints(constraints: Constraint[], bindings: Map<string, AstNode>): boolean {
    for (const constraint of constraints) {
      if (!this.checkConstraint(constraint, bindings)) {
        return false;
      }
    }
    return true;
  }

  private checkConstraint(constraint: Constraint, bindings: Map<string, AstNode>): boolean {
    switch (constraint.kind) {
      case 'type': {
        // Check if variable matches type
        const varName = constraint.varName!;
        const type = constraint.type!;
        const value = bindings.get(varName);
        if (!value) return false;

        switch (type) {
          case 'number':
            return value.kind === 'number';
          case 'var':
          case 'symbol_name':
            return value.kind === 'symbol';
          case 'func_name':
            return value.kind === 'func';
          default:
            return false;
        }
      }

      case 'rule': {
        // Rule constraint: left => right
        // This means: evaluate left, and it should match right
        // For function calls like map_div_by_x([?terms...], ?x) => [?qs...]
        // We need to call the function and check if result matches the right side
        const left = constraint.left!;
        const right = constraint.right!;

        // Replace variables in left side with bindings
        const leftEvaluated = astReplace(left, bindings);

        // If left is a function call, try to evaluate it
        if (leftEvaluated.kind === 'func') {
          const funcName = leftEvaluated.value as string;
          const args = leftEvaluated.children || [];

          // Call the constraint function (these should be registered somewhere)
          const result = this.evaluateConstraintFunction(funcName, args);
          if (!result) return false;

          // Check if result matches right side pattern
          const rightBindings = astMatch(right, result);
          if (!rightBindings) return false;

          // Add new bindings from the constraint match
          for (const [key, value] of rightBindings.entries()) {
            bindings.set(key, value);
          }
          return true;
        }
        return false;
      }

      case 'call': {
        // Call constraint: just call a function and check if it returns truthy
        const callExpr = constraint.left!;
        const evaluated = astReplace(callExpr, bindings);

        if (evaluated.kind === 'func') {
          const funcName = evaluated.value as string;
          const args = evaluated.children || [];
          const result = this.evaluateConstraintFunction(funcName, args);

          // Check if result is truthy
          // undefined/null = false
          // number 0 = false
          // everything else = true
          if (result === undefined || result === null) {
            return false;
          }
          if (result.kind === 'number' && result.value === 0) {
            return false;
          }
          return true;
        }
        return false;
      }

      case 'or': {
        const constraints = constraint.constraints!;
        return this.checkConstraint(constraints[0], bindings) ||
          this.checkConstraint(constraints[1], bindings);
      }

      case 'and': {
        const constraints = constraint.constraints!;
        return this.checkConstraint(constraints[0], bindings) &&
          this.checkConstraint(constraints[1], bindings);
      }

      case 'not': {
        return !this.checkConstraint(constraint.nested!, bindings);
      }

      default:
        return true;
    }
  }

  /**
   * Evaluate constraint functions like map_div_by_x, all_divisible_by, etc.
   */
  private evaluateConstraintFunction(funcName: string, args: ReadonlyArray<AstNode>): AstNode | undefined {
    // Look up the constraint function in the registry
    const func = this.runtime.constraintRegistry.get(funcName);
    if (!func) {
      return undefined;
    }

    // Call the constraint function with the arguments
    try {
      return func(args);
    } catch (e) {
      // If the function throws, treat it as a failed constraint
      return undefined;
    }
  }

  // Execute a skill at focus. For macro_action, apply its steps.
  tryExecute(skill: SkillDescriptor | SkillId, root: AstNode, focus: number[], goal: Goal): { nextRoot: AstNode; applied: boolean } {
    const s = (typeof (skill) === "string" ? this.runtime.skillRegistry.get(skill) : skill);
    if (!s) return { nextRoot: root, applied: false };

    if (s.payload.kind === "rewrite_rule") {
      throw 'Not implemented';
    } else if (s.payload.kind === "macro_action") {
      // Parse the skill body to get the AST
      const skillAst = parse(s.payload.skillBody);

      // Should be a rule: pattern => do [...]
      if (skillAst.kind !== 'rule') {
        return { nextRoot: root, applied: false };
      }

      const [pattern, doBlock] = skillAst.children || [];
      if (!pattern || !doBlock) {
        return { nextRoot: root, applied: false };
      }

      // Get the node at focus
      let current = this.runtime.getAt(root, focus);

      // Match the pattern against the focused node
      const patternMatch = astMatch(pattern, current);
      if (!patternMatch) {
        return { nextRoot: root, applied: false };
      }

      // Determine the working content to transform
      // If pattern is a wrapper function like solve(...) or eval(...), extract the inner content
      let workingContent = current;
      let wrapperFunc: string | null = null;
      let wrapperArgs: AstNode[] = [];

      // List of known wrapper functions that we should unwrap
      const wrapperFunctions = new Set(['solve', 'eval', 'def', 'step']);

      // Check if pattern is a wrapper function
      if (pattern.kind === 'func' &&
        wrapperFunctions.has(pattern.value as string) &&
        pattern.children &&
        pattern.children.length > 0) {
        // Pattern like solve(eq(?lhs, ?rhs), solved_for(?x))
        // Extract first arg as working content, rest as wrapper context
        wrapperFunc = pattern.value as string;
        const patternArgs = pattern.children;

        if (current.kind === 'func' && current.value === wrapperFunc) {
          const currentArgs = current.children || [];
          if (currentArgs.length > 0) {
            workingContent = currentArgs[0]; // Extract inner content (e.g., the equation)
            wrapperArgs = currentArgs.slice(1); // Keep wrapper args (e.g., solved_for(?x))
          }
        }
      }

      // If doBlock is a 'do' node, apply rules sequentially to working content
      if (doBlock.kind === 'do') {
        const rules = doBlock.children || [];
        let applied = false;

        for (let i = 0; i < Math.min(s.payload.budget, rules.length); i++) {
          const rule = rules[i];

          if (rule.kind !== 'rule') continue;

          const [rulePattern, ruleReplacement] = rule.children || [];
          if (!rulePattern || !ruleReplacement) continue;

          // Try to match this rule against working content
          const ruleBindings = astMatch(rulePattern, workingContent);

          if (ruleBindings) {
            // Merge with pattern match bindings (for wrapper variables like ?x from solved_for(?x))
            const allBindings = new Map([...patternMatch.entries(), ...ruleBindings.entries()]);

            // Check constraints if present
            const constraints = rule.constraints;
            if (constraints && constraints.length > 0) {
              if (!this.checkConstraints(constraints, allBindings)) {
                // Constraints not satisfied, skip this rule
                continue;
              }
            }

            // Apply the replacement with merged bindings
            const next = astReplace(ruleReplacement, allBindings);
            workingContent = next;
            applied = true;
          }
          // If no match, continue with same workingContent (rules are optional)
        }

        if (applied) {
          // Wrap the result back if there was a wrapper
          // BUT: If the wrapper was solve(...) and the result is no longer an equation,
          // it means we've "discharged" the solve, so don't wrap it back
          let result = workingContent;
          if (wrapperFunc) {
            const shouldWrap = !(wrapperFunc === 'solve' && workingContent.kind !== 'eq');
            if (shouldWrap) {
              result = AstNode.create('func', wrapperFunc as any, [workingContent, ...wrapperArgs]);
            }
          }

          // Update the tree at focus
          const nextRoot = this.runtime.setAt(root, focus, result);
          return { nextRoot, applied: true };
        }
      }

      return { nextRoot: root, applied: false };
    }

    // tagger doesn't execute
    return { nextRoot: root, applied: false };
  }
}


// ============================================================================
// Orchestrator wiring (policy owns rollback/backtrack)
// ============================================================================

// export class Orchestrator {
//   constructor(
//     private readonly policy: HierarchicalBacktrackingPolicy,
//     private readonly executor: Executor,
//     private readonly runtime: Runtime,
//     private readonly cost: CostModel
//   ) { }

//   async run(input: { root: AstNode; goal: Goal; focusCandidates: number[][]; maxSteps: number }): Promise<AstNode> {
//     let root = input.root;

//     for (let step = 0; step < input.maxSteps; step++) {
//       const choice = await this.policy.chooseSkill({
//         root,
//         goal: input.goal,
//         focusCandidates: input.focusCandidates,
//         runtime: this.runtime,
//       });

//       if (!choice) break;

//       const before = root;
//       const costBefore = this.cost.cost(before, input.goal);

//       const { nextRoot, applied } = this.executor.tryExecute(choice.skill, root, choice.focus, input.goal);
//       if (!applied) {
//         this.policy.observe?.({
//           rootBefore: before,
//           rootAfter: before,
//           goal: input.goal,
//           chosen: choice,
//           reward: -0.05,
//           success: false,
//         });
//         continue;
//       }

//       const costAfter = this.cost.cost(nextRoot, input.goal);

//       // if worse, rollback and let policy penalize the path
//       if (this.cost.isWorse(costBefore, costAfter)) {
//         const rb = this.policy.backtrack({ currentRootAfter: nextRoot, goal: input.goal });
//         if (rb) root = rb.rollbackRoot; // revert
//         continue;
//       }

//       // accept
//       root = nextRoot;
//       this.policy.observe?.({
//         rootBefore: before,
//         rootAfter: nextRoot,
//         goal: input.goal,
//         chosen: choice,
//         reward: this.cost.reward(costBefore, costAfter),
//         success: true,
//       });
//     }

//     return root;
//   }
// }