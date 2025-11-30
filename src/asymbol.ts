import type { ARef, ASymbol } from "./token";

export class ASymbolCache {
  /**
 * Cache mapping aref[] to internal variable names (e.g., ?1, ?2, ?3)
 * Key: serialized aref array (using getRefText)
 * Value: internal variable name
 */
  cache: Map<string, ASymbol> = new Map();
  private nextInternalVarNum: number = 1;

  /**
   * Get or create an internal variable for the given arefs
   */
  makeSymbol(arefs: ARef[]): ASymbol {
    const key = arefs.map(r => r.symbol).join('|');

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const varName = `?${this.nextInternalVarNum}` as ASymbol;
    this.cache.set(key, varName);
    this.nextInternalVarNum++;

    return varName;
  }
}