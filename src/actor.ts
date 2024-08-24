export enum Suit {
  Spade,
  Diamond,
  Club,
  Heart
}

export class Card {
  public readonly id: number;
  public readonly rank: number;
  public readonly suit: Suit;
  public open: boolean;

  public constructor(suit: Suit, rank: number) {
    this.rank = rank;
    this.suit = suit;
    this.id = suit * 100 + rank;
    this.open = false;
  }
}

export interface IEntity {

}

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

export type MessageId =
  "q_game_name" |
  "a_game_name";

export type Message = {
  source?: IActor | IEntity;
  id?: MessageId;
  text: string;
  parent?: Message;
}

export interface IActor {
  get isInteractive(): boolean;
  nextRound();
  nextGame();
  nextTurn();
  onAction(action: Action);
  onMessage(msg: Message);
}

export function getRandomInt(min: number, max: number): number {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

