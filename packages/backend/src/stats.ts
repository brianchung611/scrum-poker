import { isNumericCard, type CardValue, type VoteStats } from '@scrum-poker/shared';

/** Stats over numeric cards only; `?` and `☕` don't count. All null if nothing numeric. */
export function computeStats(values: CardValue[]): VoteStats {
  const nums = values.filter(isNumericCard).map(Number).sort((a, b) => a - b);
  if (nums.length === 0) return { average: null, median: null, min: null, max: null };

  const mid = Math.floor(nums.length / 2);
  const median = nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  const average = nums.reduce((sum, n) => sum + n, 0) / nums.length;

  return {
    average: Math.round(average * 100) / 100,
    median,
    min: nums[0],
    max: nums[nums.length - 1],
  };
}
