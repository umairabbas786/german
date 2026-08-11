import type { TextSolutionEntry } from './types';

export function fillBlanksForTranslate(prompt: string, answer: string): string {
  const promptNoHints = prompt.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const trimmed = (answer ?? '').trim();
  const blankPattern = /_{2,}/g;
  if (!promptNoHints.match(blankPattern)?.length) return promptNoHints;

  const parts = /\.\.\./.test(trimmed)
    ? trimmed.split(/\s*\.\.\.\s*/).map((part) => part.trim()).filter(Boolean)
    : trimmed ? [trimmed] : [];
  let index = 0;
  return promptNoHints.replace(blankPattern, () => {
    const piece = parts[index];
    if (piece !== undefined) {
      index += 1;
      return piece;
    }
    return parts[parts.length - 1] ?? '';
  });
}

const normalizeText = (value: unknown) =>
  (value ?? '').toString().toLowerCase().replace(/[\p{P}]/gu, '').trim();

const textVariants = (entry: TextSolutionEntry): string[] =>
  Array.isArray(entry) ? entry.filter((value): value is string => typeof value === 'string') : [entry];

export const textAnswerMatches = (answer: unknown, solution: TextSolutionEntry) =>
  textVariants(solution).some((variant) => normalizeText(answer) === normalizeText(variant));

export const firstCanonicalSolution = (solution: TextSolutionEntry): string =>
  textVariants(solution)[0] ?? '';

export function indicesFromAnswer(words: string[], answer: string): number[] {
  if (!answer?.trim()) return [];
  let remaining = answer.trim();
  const used = new Set<number>();
  const indices: number[] = [];

  while (remaining.length > 0) {
    const candidates = words
      .map((word, index) => ({ word, index }))
      .filter(({ index }) => !used.has(index))
      .sort((a, b) => b.word.length - a.word.length);

    let matched = false;
    for (const { word, index } of candidates) {
      if (remaining === word) {
        used.add(index);
        indices.push(index);
        remaining = '';
        matched = true;
        break;
      }
      const prefix = `${word} `;
      if (remaining.startsWith(prefix)) {
        used.add(index);
        indices.push(index);
        remaining = remaining.slice(prefix.length);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }
  return indices;
}
