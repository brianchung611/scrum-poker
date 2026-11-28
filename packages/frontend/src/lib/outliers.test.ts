import { describe, expect, it } from 'vitest';
import { countNumericVotes, isOutlier } from './outliers';

const stats = (min: number | null, max: number | null) => ({
  average: null,
  median: null,
  min,
  max,
});

describe('countNumericVotes', () => {
  it('counts only numeric cards and tolerates missing votes', () => {
    expect(countNumericVotes({ a: '5', b: '?', c: '☕', d: '13', e: 'XL' })).toBe(2);
    expect(countNumericVotes(undefined)).toBe(0);
  });
});

describe('isOutlier', () => {
  it('flags the highest and lowest votes when at least three numeric votes disagree', () => {
    expect(isOutlier('2', stats(2, 13), 3)).toBe(true);
    expect(isOutlier('13', stats(2, 13), 3)).toBe(true);
    expect(isOutlier('5', stats(2, 13), 3)).toBe(false);
  });

  it('does not flag with fewer than three numeric votes', () => {
    expect(isOutlier('2', stats(2, 13), 2)).toBe(false);
  });

  it('does not flag when everyone agrees', () => {
    expect(isOutlier('5', stats(5, 5), 4)).toBe(false);
  });

  it('never flags non-numeric cards, missing votes or missing stats', () => {
    expect(isOutlier('?', stats(2, 13), 3)).toBe(false);
    expect(isOutlier(undefined, stats(2, 13), 3)).toBe(false);
    expect(isOutlier('2', undefined, 3)).toBe(false);
    expect(isOutlier('2', stats(null, null), 3)).toBe(false);
  });
});
