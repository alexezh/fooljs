import { AToken, ARef, getRefText, createRefWithSources } from './token.js';

export function makeMultTerm(tokens: ARef[]): ARef {
  // Create a concatenated name with underscore prefix
  const tokenStrings = tokens.map(token => getRefText(token));
  const concatName = '_' + tokenStrings.join('');

  // Create new ARef with concatenated name and source tokens
  return createRefWithSources(concatName, tokens);
}

export function makePowerTerm(baseTokens: ARef[], powerTokens: ARef[]): ARef {
  // Create concatenated name for the power term
  const baseStrings = baseTokens.map(token => getRefText(token));
  const powerStrings = powerTokens.map(token => getRefText(token));

  // Combine base and power with ^ separator
  const concatName = '_' + baseStrings.join('') + '^' + powerStrings.join('');

  // All tokens (base + power) are source tokens
  const allSourceTokens = [...baseTokens, ...powerTokens];

  // Create new ARef with power name and all source tokens
  return createRefWithSources(concatName, allSourceTokens);
}
