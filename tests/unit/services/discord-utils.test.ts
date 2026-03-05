import { describe, expect, it } from 'vitest';

describe('services/discord-utils', () => {
  it('exports an empty compatibility module', async () => {
    const module = await import('../../../src/services/discord-utils');
    expect(Object.keys(module)).toHaveLength(0);
  });
});
