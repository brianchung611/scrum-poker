import { describe, expect, it } from 'vitest';
import { computeStats } from './stats.js';

describe('computeStats', () => {
  it('computes average, median, min and max over numeric votes', () => {
    expect(computeStats(['5', '13', '2'])).toEqual({
      average: 6.67,
      median: 5,
      min: 2,
      max: 13,
    });
  });

  it('uses the middle value for an odd count and the mean of the middle two for an even count', () => {
    expect(computeStats(['1', '3', '8']).median).toBe(3);
    expect(computeStats(['1', '3', '8', '13']).median).toBe(5.5);
  });

  it('ignores non-numeric cards like ? and the coffee card', () => {
    expect(computeStats(['3', '?', '☕', '5'])).toEqual({ average: 4, median: 4, min: 3, max: 5 });
  });

  it('returns all nulls when nothing is numeric', () => {
    const none = { average: null, median: null, min: null, max: null };
    expect(computeStats([])).toEqual(none);
    expect(computeStats(['?', 'XL', '☕'])).toEqual(none);
  });

  it('handles a single vote and decimals', () => {
    expect(computeStats(['8'])).toEqual({ average: 8, median: 8, min: 8, max: 8 });
    expect(computeStats(['0.5', '1.5'])).toEqual({ average: 1, median: 1, min: 0.5, max: 1.5 });
  });

  it('does not treat look-alike strings as numbers', () => {
    expect(computeStats(['1e3', '-1', ' 2', '0x10', '1,5']).average).toBeNull();
  });
});
