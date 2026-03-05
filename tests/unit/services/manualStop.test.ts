import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';
import { PlaybackJobStatus } from '../../../src/services/prisma/prismaEnums';

const manualStopMocks = vi.hoisted(() => {
  return {
    getPlaybackScheduler: vi.fn(),
  };
});

vi.mock('../../../src/services/playbackScheduler', () => {
  return {
    getPlaybackScheduler: manualStopMocks.getPlaybackScheduler,
  };
});

import { executeManualStopForGuild } from '../../../src/services/manualStop';

describe('services/manualStop', () => {
  beforeEach(() => {
    manualStopMocks.getPlaybackScheduler.mockReset();
    global.logger = {
      info: vi.fn(),
    } as any;
    global.prisma = {
      guild: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
      playbackJob: {
        updateMany: vi.fn().mockResolvedValue({
          count: 2,
        }),
      },
    } as any;
  });

  it('emits STOP, releases PLAYING jobs, and notifies scheduler', async () => {
    const onManualStop = vi.fn().mockResolvedValue(undefined);
    manualStopMocks.getPlaybackScheduler.mockReturnValue({
      onManualStop,
    });

    const emit = vi.fn();
    const fastify = {
      io: {
        to: vi.fn().mockReturnValue({
          emit,
        }),
      },
    } as unknown as FastifyCustomInstance;

    const result = await executeManualStopForGuild(fastify, ' guild-1 ', {
      logLabel: ' stop-now ',
    });

    expect(fastify.io.to).toHaveBeenCalledWith('overlay-guild-guild-1');
    expect(emit).toHaveBeenCalledWith(OVERLAY_SOCKET_EVENTS.STOP, {
      jobId: 'manual-stop',
    });
    expect(global.prisma.guild.upsert).toHaveBeenCalledWith({
      where: {
        id: 'guild-1',
      },
      create: {
        id: 'guild-1',
        busyUntil: null,
      },
      update: {
        busyUntil: null,
      },
    });
    expect(global.prisma.playbackJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          guildId: 'guild-1',
          status: PlaybackJobStatus.PLAYING,
          finishedAt: null,
        }),
        data: expect.objectContaining({
          status: PlaybackJobStatus.DONE,
          finishedAt: expect.any(Date),
        }),
      }),
    );
    expect(onManualStop).toHaveBeenCalledWith('guild-1');
    expect(result).toEqual({
      releasedCount: 2,
    });
  });

  it('returns early for empty guild IDs and skips side effects', async () => {
    const fastify = {
      io: {
        to: vi.fn(),
      },
    } as unknown as FastifyCustomInstance;

    const result = await executeManualStopForGuild(fastify, '   ');

    expect(result).toEqual({
      releasedCount: 0,
    });
    expect(global.prisma.guild.upsert).not.toHaveBeenCalled();
    expect(global.prisma.playbackJob.updateMany).not.toHaveBeenCalled();
    expect(fastify.io.to).not.toHaveBeenCalled();
  });
});
