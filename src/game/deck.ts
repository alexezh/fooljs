import { Card, getRandomInt, Suit, type IEntity } from "./actor";

export class Deck implements IEntity {
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
    let card = this.cards.shift();
    return card!;
  }
}
