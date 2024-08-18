import type { Action, IActor, Message } from "./actor";

export class InteractivePlayer implements IActor {
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
    if (msg.text === "what is name") {

    }
  }
}
