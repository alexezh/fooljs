import type { Action, IActor, Message } from "./actor";
import { IGame } from "./igame";

export class InteractivePlayer implements IActor {
  private readonly game: IGame;

  public constructor(game: IGame) {
    this.game = game;
  }
  
  get isInteractive(): boolean {
    return true;
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

  onMessage(msg: Message) {
    if (msg.id === "q_game_name") {
      this.game.sendMessage({ source: this, id: "a_game_name", parent: msg, text: "fool" })
    }
  }
}
