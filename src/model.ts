import { AstNode } from "./ast";

export class AModel {
  readonly root: AstNode;
  readonly parent?: AModel;

  constructor(parent?: AModel) {
    this.parent = parent;
  }

  update(): AModel {
    return new AModel(this);
  }
}