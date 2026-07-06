export function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
