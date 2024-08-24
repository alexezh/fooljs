import type { Message } from "./actor";

export interface IGame {
  sendMessage(msg: Message): void;
}