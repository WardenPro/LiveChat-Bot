import { describe, expect, it } from 'vitest';

import { divide, sum } from './sampleMath';

describe('sampleMath', () => {
  it('adds two numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('throws when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrowError('Cannot divide by zero');
  });
});
