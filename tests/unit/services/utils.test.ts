import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../../src/services/utils';

describe('services/utils', () => {
  beforeEach(() => {
    global.env = {
      DEFAULT_DURATION: 8,
    } as any;

    global.prisma = {
      guild: {
        findFirst: vi.fn(),
      },
    } as any;
  });

  it('caps duration by guild maxMediaTime when configured', async () => {
    global.prisma.guild.findFirst.mockResolvedValue({
      defaultMediaTime: 12,
      maxMediaTime: 10,
      displayMediaFull: true,
    });

    const duration = await getDurationFromGuildId(15, 'guild-1');
    const displayFull = await getDisplayMediaFullFromGuildId('guild-1');

    expect(duration).toBe(10);
    expect(displayFull).toBe(true);
  });

  it('falls back to guild/default duration and false display mode', async () => {
    global.prisma.guild.findFirst
      .mockResolvedValueOnce({
        defaultMediaTime: null,
        maxMediaTime: null,
      })
      .mockResolvedValueOnce({
        displayMediaFull: false,
      });

    expect(await getDurationFromGuildId(null, 'guild-2')).toBe(8);
    expect(await getDisplayMediaFullFromGuildId('guild-2')).toBe(false);
  });
});
