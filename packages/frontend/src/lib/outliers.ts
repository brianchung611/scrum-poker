import { isNumericCard, type CardValue, type VoteStats } from '@scrum-poker/shared';

/** How many of the revealed votes are numeric. */
export function countNumericVotes(votes: Record<string, CardValue> | undefined): number {
  return Object.values(votes ?? {}).filter(isNumericCard).length;
}

/**
 * The highest and lowest numeric votes are flagged to prompt discussion, but only when at
 * least three numeric votes were cast and they actually disagree.
 */
export function isOutlier(
  value: CardValue | undefined,
  stats: VoteStats | undefined,
  numericCount: number,
): boolean {
  if (value === undefined || !isNumericCard(value)) return false;
  if (numericCount < 3 || !stats || stats.min === null || stats.max === null) return false;
  if (stats.min === stats.max) return false;
  const n = Number(value);
  return n === stats.min || n === stats.max;
}
