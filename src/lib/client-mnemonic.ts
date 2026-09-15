// Derives a 5-character uppercase alphanumeric base code from a client
// name: strip everything but letters/digits, uppercase, take the first 5
// characters (padding short names with X). Deterministic and simple to
// explain to a user, e.g. "Atlas Trading Co." -> "ATLAS".
export function deriveMnemonicBase(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length >= 5) return cleaned.slice(0, 5);
  return cleaned.padEnd(5, "X");
}

// Given the base code and the set of mnemonics already in use, find a free
// 5-character code: the base itself, or the base with its last character
// replaced by a disambiguating digit (2-9), then letter (A-Z minus the
// digits already tried is unnecessary -- letters cover any remaining
// collisions at this business's scale).
export function resolveMnemonicCollision(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;

  const prefix = base.slice(0, 4);
  for (let digit = 2; digit <= 9; digit++) {
    const candidate = `${prefix}${digit}`;
    if (!taken.has(candidate)) return candidate;
  }
  for (let code = 65; code <= 90; code++) {
    const candidate = `${prefix}${String.fromCharCode(code)}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find a free client mnemonic for base "${base}"`);
}
