import { normalizeText } from "../source";

const leadingArticles = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "eines",
]);

function tokens(text: string): string[] {
  const words =
    normalizeText(text)
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  if (words[0] && leadingArticles.has(words[0])) return words.slice(1);
  return words;
}

/** Compares token multisets so repeated words cannot inflate the overlap. */
export function matchesFreeText(expected: string, predicted: string): boolean {
  const gold = tokens(expected);
  const answer = tokens(predicted);
  if (!gold.length || !answer.length) return false;
  const available = new Map<string, number>();
  for (const token of gold)
    available.set(token, (available.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of answer) {
    const count = available.get(token) ?? 0;
    if (count === 0) continue;
    available.set(token, count - 1);
    overlap++;
  }
  return (2 * overlap) / (gold.length + answer.length) >= 0.8;
}
