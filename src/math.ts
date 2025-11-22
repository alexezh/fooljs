/**
 * computed value
 */
export interface ARef {
  token: AToken;
  arefs: ReadonlyArray<ARef>;
  value: any;
}

export interface AToken {
  id: number;
  text: string;
}

