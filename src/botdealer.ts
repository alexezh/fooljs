import type { Action, IActor } from "./actor";

/**
 * first dealer sends number of questions to interactive player about the game
 */
class BotDealer implements IActor {
  get isInteractive(): boolean {
    return false;
  }
  nextRound() {
    throw new Error("Method not implemented.");
  }
  nextGame() {
    throw new Error("Method not implemented.");
  }
  nextTurn() {
    throw new Error("Method not implemented.");
  }
  onAction(action: Action) {
    throw new Error("Method not implemented.");
  }

}
