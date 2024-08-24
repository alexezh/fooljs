import { Action, Card, IActor, IEntity, Message, Suit } from "./actor";
import { BotDealer } from "./botdealer";
import { BotPlayer } from "./botplayer";
import { Deck } from "./deck";
import { IGame } from "./igame";
import { InteractivePlayer } from "./interactiveplayer";

type Concept = {
  innerName: string;
  outerName?: string;
}

type Clause = {

}

class Stock implements IEntity {

}

/*
 * we can say that pile, card, hand, talon, pick
 * opponent - all this can be defined as previous knowledge
 * 
 * also, world does not have rules. Only actors have rules
 * and overall rules are consensus between different actors
 * 
 * this includes going through rounds and such
 * we can have DM as actor which stays outside game and controls
 * rules. The key is that world is passive
 */
export class WorldModel {
  public readonly talon: Card[] = [];
  public readonly deck = new Deck();
  public readonly players: IActor[] = [];

  public initialize(deck: number) {
    this.deck.initialize(deck);
  }

  /**
  * actions are verbs which any card game will implement
  * a game can use only subset of verbs, but it will use some
  */

  public startGame() {

  }

  /**
   * game might be splits in rounds, called for every round
   */
  public startRound() {

  }

  public giveCard(source: IActor | IEntity, player: IActor, card: Card) {

  }

  public playCard(source: IActor | IEntity, card: Card) {

  }

  public takeTrick(source: IActor | IEntity) {

  }

  public dealCards() {

  }

  private notifyAction(action: Action) {
    for (let p of this.players) {
      p.onAction(action);
    }
  }
}


type NamedParams = Record<string, any>;

class BuiltInLanguage {
  public addVerb(id: string, prompt: string, func: (model: WorldModel, ctx: NamedParams) => void) {

  }
}

const language = new BuiltInLanguage();

// deal 6 cards
language.addVerb("dealCards", "deal N cards", (model: WorldModel, ctx: NamedParams): void => {
  if (ctx["count"] === undefined) {
    return;
  }
  // let count = ctx["count"] as number;
  // for (let i = 0; i < count; i++) {
  //   model.deck.
  //     model.giveCard(take(deck))
  // }
});

language.addVerb("deal card", "deal cards", (model: WorldModel, ctx: NamedParams): void => {

  // model.giveCard(model.deck, player, model.deck.takeTop());
});

/**
 * idea is text interface for setting up rules of game
 * rules translated into set of clauses for each bot
 * 
 * first command is dealing of cards. The format is something like
 *    deal 6 card each (assuming 1 each in the loop)
 *    take top card from stock
 *    open and put on table visible, 
 *    put the rest of stock on top (assumed closed)
 */
class Game implements IGame {
  private model: WorldModel;
  private dealer: BotDealer;
  private readonly msgQueue: Message[] = [];
  private pending: boolean = false;

  public setup() {
    this.model = new WorldModel();
    this.model.initialize(36);

    this.dealer = new BotDealer(this);
    this.model.players.push(new InteractivePlayer(this));
    this.model.players.push(new BotPlayer());
  }

  public start() {
    this.model.deck.shuffle();
    //this.model.dealCards();
    //this.model.playGame();
    this.dealer.activate();
  }

  public isEnded(): boolean {
    return false;
  }

  public round() {

  }

  public sendMessage(msg: Message): void {
    this.msgQueue.push(msg);
    if (!this.pending) {
      this.pending = true;
      while (this.msgQueue.length > 0) {
        this.deliverMessage(this.msgQueue.shift()!);
      }
      this.pending = false;
    }
  }

  private deliverMessage(msg: Message) {
    this.dealer.onMessage(msg);
    for (let p of this.model.players) {
      p.onMessage(msg);
    }
  }
}

let prg = new Game();
prg.start();
while (prg.isEnded()) {
  prg.round();
}