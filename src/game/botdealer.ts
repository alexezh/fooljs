import { Message, type Action, type IActor } from "./actor";
import type { WorldModel } from "./fool";
import { IGame } from "./igame";

export interface IBotDealer extends IActor {
  activate(): void;
}

/**
 * first dealer sends number of questions to interactive player about the game
 */
export class BotDealer implements IBotDealer {
  private game: IGame;

  get isInteractive(): boolean {
    return false;
  }
  public constructor(game: IGame) {
    this.game = game;
  }

  activate(): void {
    this.game.sendMessage({ source: this, id: "q_game_name", text: "what is game name" });
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
    if (msg.parent !== msg) {
      return;
    }

    if (msg.parent.id === "q_game_name") {
      //    } else if (msg.)
    }
  }
}
