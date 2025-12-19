import { AstNode, MatchFuncRet } from "../ast";

let nextId = 1;

/**
 * Represents a state in the search space
 * 
 * we want cost of operation be - read values, write whole expression
 */
export class SearchState {
  id: number;
  node: AstNode;
  parent?: SearchState;
  /**
   * cost from start, computed as match cost + apply cost
   */
  gCost: number;
  /**
   * approximare cost to complete
   */
  hCost: number;
  fCost: number;  // Total (g + h)

  /**
   * number of nodes this state rewrites
   * as we make change, we read and write values. Every read/write has cost
   * for complex operations, cost is lower as we read once. Write cost has two parts - how many 
   * changed and total. Total is constant technically, but it is used to differentiate big vs small
   * equations. This way if sample has 100 nodes, operation which writes two nodes has cost 102 vs
   * two operations writing one node will have cost 201. 
   */
  changedNodes: number = 0;

  get debugStr(): string {
    return this.node.toString();
  }

  constructor(parent: SearchState | undefined, node: AstNode, gCost: number = 0) {
    this.id = nextId++;
    if (this.id === 8) {
      debugger;
    }
    this.node = node;
    this.parent = parent;
    this.gCost = gCost;
    this.hCost = node.getCost();
    this.fCost = this.gCost + this.hCost;
  }

  /**
   * clone parent of node to point to rewrite
   *
   * @param state - Parent search state
   * @param path - Path from root to the node being rewritten
   * @param orig - Original node being rewritten
   * @param rewrite - The rewrite result
   * @param stateScoreAdj - State-based score adjustment (negative = prefer this path)
   */
  static create(state: SearchState, path: AstNode[], orig: AstNode, rewrite: MatchFuncRet, stateScoreAdj: number = 0): SearchState {
    // if (nextId === 8) {
    //   debugger;
    // }
    let cur = rewrite.replace;
    for (var idx = path.length - 1; idx >= 0; idx--) {
      let parent = path[idx];
      let children: AstNode[] = [];
      for (let child of parent.children!) {
        if (child === orig) {
          children.push(cur);
        } else {
          children.push(child);
        }
      }

      let parentClone = parent.clone(children);
      orig = parent;
      cur = parentClone;
    }

    // Compute new gCost: parent's gCost + rewrite cost + state-based adjustment
    const newGCost = state.gCost + rewrite.cost + stateScoreAdj;

    return new SearchState(state, cur, newGCost);
  }

  /**
   * Reconstruct the path from start to this state
   */
  getPath(): AstNode[] {
    const path: AstNode[] = [];
    let current: SearchState | undefined = this;

    while (current) {
      path.unshift(current.node);
      current = current.parent;
    }

    return path;
  }

  /**
   * Get a unique key for this state (for visited set)
   */
  getKey(): string {
    return this.node.toString();
  }
}

