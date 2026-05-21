export const NUMBER_PAIRS: [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
];

export function emptySelections(): (number | null)[] {
  return NUMBER_PAIRS.map(() => null);
}

export function isSelectionsComplete(selections: (number | null)[]): boolean {
  return selections.every((v) => v !== null);
}
