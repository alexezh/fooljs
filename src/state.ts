// =============================================================================
// State-based rule guidance using recursive Markov graphs
// =============================================================================
//
// States are *patterns* over expressions, not concrete ASTs.
// Each state represents a "shape" like "quadratic in standard form" or "isolated variable".
// Edges are weighted transitions: (state, rule) -> target_state with weight.
//
// The same state graph is applied recursively at every subtree, enabling:
// - Generalization across unseen expressions matching the same pattern
// - Rule ordering at any depth based on learned weights
// - Human-like abstraction: "any ax²+bx+c behaves similarly"

import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";

/**
 * A State is a named pattern over expressions.
 *
 * Example:
 *   state quad_leading1(?x) := eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)
 *
 * Any concrete equation matching this pattern is "in" this state.
 */
export class State {
  name: string;
  pattern: AstNode;
  params: string[]; // e.g., ['?x'] - the pattern variables that parameterize this state

  constructor(name: string, pattern: AstNode, params: string[] = []) {
    this.name = name;
    this.pattern = pattern;
    this.params = params;
  }

  toString(): string {
    const paramsStr = this.params.length > 0 ? `(${this.params.join(', ')})` : '';
    return `${this.name}${paramsStr} := ${this.pattern.toString()}`;
  }
}

/**
 * A Transition represents an edge in the Markov graph:
 * "If you're in state S, applying rule R tends to take you to state T with weight W"
 */
export class Transition {
  fromState: string;
  rule: string;
  toState: string;
  weight: number;

  constructor(fromState: string, rule: string, toState: string, weight: number = 1.0) {
    this.fromState = fromState;
    this.rule = rule;
    this.toState = toState;
    this.weight = weight;
  }

  toString(): string {
    return `${this.fromState} --[${this.rule}]--> ${this.toState} (weight: ${this.weight})`;
  }
}

/**
 * StateManager manages the collection of states and transitions.
 * It provides methods to:
 * - Add states and transitions
 * - Find which states match a given expression
 * - Score (state, rule) pairs based on transition weights
 */
export class StateManager {
  private states: Map<string, State> = new Map();
  private transitions: Map<string, Map<string, Transition>> = new Map(); // fromState -> rule -> Transition
  private runtime: Runtime;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  /**
   * Add a new state pattern.
   *
   * @param name - The state name (e.g., "quad_leading1")
   * @param patternStr - The pattern as a string (e.g., "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)")
   * @param params - Optional parameter list (e.g., ["?x"])
   */
  addState(name: string, patternStr: string, params: string[] = []): void {
    const pattern = this.runtime.parseExpr(patternStr);
    const state = new State(name, pattern, params);
    this.states.set(name, state);
  }

  /**
   * Add a transition between states.
   *
   * @param fromState - Source state name
   * @param rule - Rule name that triggers this transition
   * @param toState - Target state name
   * @param weight - Transition weight (default 1.0)
   */
  addTransition(fromState: string, rule: string, toState: string, weight: number = 1.0): void {
    if (!this.states.has(fromState)) {
      throw new Error(`Unknown state: ${fromState}`);
    }
    if (!this.states.has(toState)) {
      throw new Error(`Unknown state: ${toState}`);
    }

    const transition = new Transition(fromState, rule, toState, weight);

    if (!this.transitions.has(fromState)) {
      this.transitions.set(fromState, new Map());
    }
    this.transitions.get(fromState)!.set(rule, transition);
  }

  /**
   * Update the weight of an existing transition.
   * Used for learning from traces.
   *
   * @param fromState - Source state name
   * @param rule - Rule name
   * @param deltaWeight - Amount to add to current weight
   */
  updateTransitionWeight(fromState: string, rule: string, deltaWeight: number): void {
    const stateTransitions = this.transitions.get(fromState);
    if (!stateTransitions) {
      throw new Error(`No transitions from state: ${fromState}`);
    }

    const transition = stateTransitions.get(rule);
    if (!transition) {
      throw new Error(`No transition from ${fromState} via ${rule}`);
    }

    transition.weight += deltaWeight;
  }

  /**
   * Find all states whose pattern matches the given expression.
   *
   * @param expr - The expression to match against state patterns
   * @returns Array of state names that match
   */
  getActiveStates(expr: AstNode): string[] {
    const activeStates: string[] = [];

    for (const [stateName, state] of this.states) {
      const matchResult = this.runtime.matchPattern(state.pattern, expr);
      if (matchResult !== undefined) {
        activeStates.push(stateName);
      }
    }

    return activeStates;
  }

  /**
   * Compute the score for applying a rule at a given expression.
   * Score is the sum of weights from all matching states.
   *
   * @param expr - The expression where the rule would be applied
   * @param rule - The rule to score
   * @returns Total weight score
   */
  scoreRule(expr: AstNode, rule: string): number {
    const activeStates = this.getActiveStates(expr);
    let totalScore = 0;

    for (const stateName of activeStates) {
      const stateTransitions = this.transitions.get(stateName);
      if (stateTransitions) {
        const transition = stateTransitions.get(rule);
        if (transition) {
          totalScore += transition.weight;
        }
      }
    }

    return totalScore;
  }

  /**
   * Get all transitions from a given state.
   *
   * @param stateName - The state name
   * @returns Array of transitions from this state
   */
  getTransitionsFrom(stateName: string): Transition[] {
    const stateTransitions = this.transitions.get(stateName);
    if (!stateTransitions) {
      return [];
    }

    return Array.from(stateTransitions.values());
  }

  /**
   * Get the transition for a specific (state, rule) pair.
   *
   * @param stateName - The state name
   * @param rule - The rule name
   * @returns The transition, or undefined if none exists
   */
  getTransition(stateName: string, rule: string): Transition | undefined {
    const stateTransitions = this.transitions.get(stateName);
    if (!stateTransitions) {
      return undefined;
    }

    return stateTransitions.get(rule);
  }

  /**
   * Get all states.
   */
  getStates(): Map<string, State> {
    return this.states;
  }

  /**
   * Print the state graph for debugging.
   */
  printGraph(): string {
    const lines: string[] = [];
    lines.push("=== State Graph ===");

    for (const [stateName, state] of this.states) {
      lines.push(`\nState: ${state.toString()}`);

      const transitions = this.getTransitionsFrom(stateName);
      if (transitions.length > 0) {
        lines.push("  Transitions:");
        for (const trans of transitions) {
          lines.push(`    ${trans.toString()}`);
        }
      }
    }

    return lines.join('\n');
  }
}
