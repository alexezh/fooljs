export enum ActionKind {
  giveCard,
  playCard,
  takeTrick
}

export class Action {
  public readonly kind: ActionKind;
  public readonly source?: IActor | IEntity;
  public readonly target?: IActor | IEntity;
  public readonly cards: Card[] = [];
}

export class Message {
  public readonly source?: IActor | IEntity;
  public text: string;
}

export interface IActor {
  get isInteractive(): boolean;
  nextRound();
  nextGame();
  nextTurn();
  onAction(action: Action);
}

