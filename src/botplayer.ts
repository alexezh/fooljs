import { type Action, ActionKind, type IActor } from "./actor";

/**
 * maintains information which bot knows about player
 * when we create virtual model for prediction, can act as a player
 */
class BotPlayerModel {

}

export class BotPlayer implements IActor {
  public worldModel: WorldModel;
  private readonly hand: Card[] = [];
  private readonly playerModels: BotPlayerModel[] = [];

  get isInteractive(): boolean {
    return false;
  }

  nextRound() {
    throw new Error("Method not implemented.");
  }
  nextGame() {
    throw new Error("Method not implemented.");
  }
  public nextTurn(): void {
    Math.random();
    return this.worldModel.playCard(this, card);
  }
  public onAction(action: Action) {
    if (action.kind === ActionKind.giveCard) {
      if (action.target !== this) {
        return;
      }
      this.hand.push(...action.cards)
    } else if (action.kind === ActionKind.takeTrick) {

    }
    // if (action.card) {
    //   action.target.id
    // }
  }
}
