// ============================================================================
// Hierarchical policy tree (routing nodes + leaf pickers) with backtracking
// ============================================================================

import { AstNode } from "../ast.js";
import { Runtime } from "../runtime.js";
import { SkillDescriptor } from "../skilldescriptor.js";
import { ChildId, CostModel, DecisionRecord, FeatureFn, StepRecord } from "./hpolicy.js";
import { LeafNode } from "./leafnode.js";
import { Goal } from "./plannercore.js";
import { BoolVec, Choice, Policy } from "./policy.js";
import { RoutingNode } from "./routingnode.js";


// Tree structure: internal routing nodes point to child nodes; leaves hold skill picker.
export type PolicyTreeNode =
  | { kind: "route"; node: RoutingNode; children: Record<ChildId, PolicyTreeNode> }
  | {
    kind: "leaf"; node: LeafNode; // leaf sees full registry, may filter by tags
    skillFilter?: (s: SkillDescriptor, goal: Goal) => boolean
  };

// ============================================================================
// Concrete Policy: hierarchical selection + backtracking-aware observe()
// ============================================================================

export class HierarchicalBacktrackingPolicy implements Policy {
  private history: StepRecord[] = []; // stack for rollback + updates

  constructor(
    private readonly tree: PolicyTreeNode,
    private readonly fx: FeatureFn,
    private readonly cost: CostModel,
    private readonly params?: {
      maxDepth?: number;
      // backtracking: how many alternative attempts per step (if you want)
      // for skeleton we store only the last step; you can extend to beams.
      backtrackPenalty?: number;      // e.g. -0.5
      noOpPenalty?: number;           // e.g. -0.05
      maxFocusPerSkill?: number;      // e.g. 8
    }
  ) { }

  async chooseSkill(input: {
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
    runtime: Runtime;
  }): Promise<Choice | null> {
    const x = this.fx.extract(input.root, input.goal);
    const skillsAll = input.runtime.skillRegistry.listAll();

    const beforeCost = this.cost.cost(input.root, input.goal);

    const { choice, decisions } = this.descendTree({
      node: this.tree,
      x,
      root: input.root,
      goal: input.goal,
      focusCandidates: input.focusCandidates,
      skillsAll,
      depth: 0,
      maxDepth: this.params?.maxDepth ?? 6,
    });

    if (!choice) return null;

    // Push checkpoint for rollback & credit assignment later
    this.history.push({
      checkpointRoot: input.root,
      checkpointCost: beforeCost,
      decisions,
      chosen: choice,
    });

    return choice;
  }

  observe?(evt: {
    rootBefore: AstNode;
    rootAfter: AstNode;
    goal: Goal;
    chosen: Choice;
    reward: number;
    success: boolean;
  }): void {
    // Orchestrator can call this for no-ops etc.
    // For "applied but got worse", call policy.backtrack(...) below instead.
    this.applyCreditToLast(evt.reward, evt.success, evt.goal);
  }

  // Called by orchestrator when it detects "cost got worse" and decides to rollback.
  // This packages the backtracking logic into the policy.
  backtrack(input: { currentRootAfter: AstNode; goal: Goal }): { rollbackRoot: AstNode } | null {
    const last = this.history.pop();
    if (!last) return null;

    const afterCost = this.cost.cost(input.currentRootAfter, input.goal);
    const r = this.cost.reward(last.checkpointCost, afterCost);

    // On backtrack we apply extra penalty (since step was net harmful)
    const penalty = this.params?.backtrackPenalty ?? -0.5;
    const shapedReward = r + penalty;

    // Credit assignment: penalize routing decisions + leaf skill decision
    this.applyCredit(last.decisions, shapedReward, /*success*/ false);

    return { rollbackRoot: last.checkpointRoot };
  }

  // -----------------------
  // Internal tree descent
  // -----------------------
  private descendTree(args: {
    node: PolicyTreeNode;
    x: BoolVec;
    root: AstNode;
    goal: Goal;
    focusCandidates: number[][];
    skillsAll: SkillDescriptor[];
    depth: number;
    maxDepth: number;
  }): { choice: Choice | null; decisions: DecisionRecord[] } {
    const { node, x, root, goal, focusCandidates, skillsAll, depth, maxDepth } = args;
    if (depth >= maxDepth) return { choice: null, decisions: [] };

    if (node.kind === "route") {
      const { childId } = node.node.chooseChild({ x });
      const child = node.children[childId];
      if (!child) return { choice: null, decisions: [] };

      const down = this.descendTree({
        node: child,
        x,
        root,
        goal,
        focusCandidates,
        skillsAll,
        depth: depth + 1,
        maxDepth,
      });

      return {
        choice: down.choice,
        decisions: [{ kind: "route", nodeId: node.node.id, childId, x }, ...down.decisions],
      };
    }

    // leaf
    const filtered = node.skillFilter
      ? skillsAll.filter(s => node.skillFilter!(s, goal))
      : skillsAll;

    // Optionally prune focus candidates (avoid explosion)
    const maxFocus = this.params?.maxFocusPerSkill ?? 8;
    const foci = focusCandidates.slice(0, maxFocus);

    const choice = node.node.chooseSkill({
      x,
      root,
      goal,
      focusCandidates: foci,
      skills: filtered,
    });

    if (!choice) return { choice: null, decisions: [] };

    return {
      choice,
      decisions: [{ kind: "leaf", nodeId: node.node.id, skillId: choice.skill.id, x, focus: choice.focus }],
    };
  }

  // -----------------------
  // Credit assignment helpers
  // -----------------------
  private applyCreditToLast(reward: number, success: boolean, goal: Goal) {
    const last = this.history[this.history.length - 1];
    if (!last) return;
    this.applyCredit(last.decisions, reward, success);
  }

  private applyCredit(decisions: DecisionRecord[], reward: number, success: boolean) {
    for (const d of decisions) {
      if (d.kind === "route") {
        // find routing node and update
        this.visitRoutingNode(this.tree, d.nodeId, (rn) => rn.observe({ x: d.x, chosenChildId: d.childId, reward }));
      } else {
        this.visitLeafNode(this.tree, d.nodeId, (ln) => ln.observe({ x: d.x, skillId: d.skillId, reward, success }));
      }
    }
  }

  private visitRoutingNode(node: PolicyTreeNode, nodeId: string, fn: (rn: RoutingNode) => void): boolean {
    if (node.kind === "route") {
      if (node.node.id === nodeId) { fn(node.node); return true; }
      for (const child of Object.values(node.children)) {
        if (this.visitRoutingNode(child, nodeId, fn)) return true;
      }
    }
    return false;
  }

  private visitLeafNode(node: PolicyTreeNode, nodeId: string, fn: (ln: LeafNode) => void): boolean {
    if (node.kind === "leaf") {
      if (node.node.id === nodeId) { fn(node.node); return true; }
      return false;
    }
    if (node.kind === "route") {
      for (const child of Object.values(node.children)) {
        if (this.visitLeafNode(child, nodeId, fn)) return true;
      }
    }
    return false;
  }
}

