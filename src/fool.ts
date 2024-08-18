type Concept = {
  innerName: string;
  outerName?: string;
}

type Clause = {

}

function getRandomInt(min: number, max: number): number {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

enum Suit {
  Spade,
  Diamond,
  Club,
  Heart
}

class Card {
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

interface IEntity {

}

class Deck implements IEntity {
  private cards: Card[] = [];

  public initialize(count: number) {
    if (count === 36) {
      for (let i = 0; i < Suit.Heart; i++) {
        for (let j = 0; j < 9; j++) {
          this.cards.push(new Card(i as Suit, j + 6));
        }
      }
    } else {
      throw new Error('Not supported')
    }
  }
  public shuffle(): void {
    for (let i = 0; i < 1000; i++) {
      let i1 = getRandomInt(0, this.cards.length);
      let i2 = getRandomInt(0, this.cards.length);
      let c = this.cards[i1];
      this.cards[i1] = this.cards[i2];
      this.cards[i2] = c;
    }
  }

  public takeTop(): Card {
    return null;
  }
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
class WorldModel {
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
  let count = ctx["count"] as number;
  for (let i = 0; i < count; i++) {
    model.deck.
      model.giveCard(take(deck))
  }
});

language.addVerb("deal card", "deal cards", (model: WorldModel, ctx: NamedParams): void => {

  model.giveCard(model.deck, player, model.deck.takeTop());
});

interface IGame {

}
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
  private readonly dealer: IActor;

  public setup() {
    this.model = new WorldModel();
    this.model.initialize(36);

    this.model.players.push(new InteractivePlayer());
    this.model.players.push(new BotPlayer());
  }

  public start() {
    this.model.deck.shuffle();
    this.model.dealCards();
    this.model.playGame();
  }

  public isEnded(): boolean {
    return false;
  }

  public round() {

  }
}

let prg = new Game();
prg.start();
while (prg.isEnded()) {
  prg.round();
}