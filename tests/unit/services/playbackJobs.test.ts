import { beforeEach, describe, expect, it, vi } from 'vitest';

const playbackJobsMocks = vi.hoisted(() => {
  return {
    getDurationFromGuildId: vi.fn(),
    notifyPlaybackSchedulerJobEnqueued: vi.fn(),
    decodeRichOverlayPayload: vi.fn(),
  };
});

vi.mock('../../../src/services/utils', () => {
  return {
    getDurationFromGuildId: playbackJobsMocks.getDurationFromGuildId,
  };
});

vi.mock('../../../src/services/playbackScheduler', () => {
  return {
    notifyPlaybackSchedulerJobEnqueued: playbackJobsMocks.notifyPlaybackSchedulerJobEnqueued,
  };
});

vi.mock('../../../src/services/messages/richOverlayPayload', () => {
  return {
    decodeRichOverlayPayload: playbackJobsMocks.decodeRichOverlayPayload,
  };
});

import { createPlaybackJob, purgeOldPlaybackJobs, startPlaybackJobPurgeWorker } from '../../../src/services/playbackJobs';
import { PlaybackJobStatus } from '../../../src/services/prisma/prismaEnums';

describe('services/playbackJobs', () => {
  beforeEach(() => {
    playbackJobsMocks.getDurationFromGuildId.mockReset();
    playbackJobsMocks.notifyPlaybackSchedulerJobEnqueued.mockReset();
    playbackJobsMocks.decodeRichOverlayPayload.mockReset();

    global.env = {
      DEFAULT_DURATION: 8,
      PLAYBACK_JOB_RETENTION_HOURS: 24,
    } as any;

    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.prisma = {
      playbackJob: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
    } as any;
  });

  describe('createPlaybackJob', () => {
    it('creates a job with resolved duration and notifies scheduler', async () => {
      playbackJobsMocks.getDurationFromGuildId.mockResolvedValue(10);
      playbackJobsMocks.decodeRichOverlayPayload.mockReturnValue(null);

      const job = { id: 'job-1', durationSec: 10, guildId: 'g1' };
      global.prisma.playbackJob.create.mockResolvedValue(job);

      const result = await createPlaybackJob({
        guildId: 'g1',
        text: 'Hello',
        mediaAsset: { id: 'asset-1', durationSec: 10, kind: 'VIDEO' },
      });

      expect(global.prisma.playbackJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guildId: 'g1',
            text: 'Hello',
          }),
        }),
      );
      expect(playbackJobsMocks.notifyPlaybackSchedulerJobEnqueued).toHaveBeenCalledWith('g1');
      expect(result).toBe(job);
    });

    it('skips scheduler notification when skipScheduleNotify is true', async () => {
      playbackJobsMocks.getDurationFromGuildId.mockResolvedValue(8);
      playbackJobsMocks.decodeRichOverlayPayload.mockReturnValue(null);
      global.prisma.playbackJob.create.mockResolvedValue({ id: 'job-2', durationSec: 8, guildId: 'g2' });

      await createPlaybackJob({ guildId: 'g2', skipScheduleNotify: true });

      expect(playbackJobsMocks.notifyPlaybackSchedulerJobEnqueued).not.toHaveBeenCalled();
    });

    it('uses embedded start offset from rich payload to reduce duration', async () => {
      playbackJobsMocks.decodeRichOverlayPayload.mockReturnValue({ type: 'media', startOffsetSec: 3 });
      playbackJobsMocks.getDurationFromGuildId.mockResolvedValue(10);
      global.prisma.playbackJob.create.mockResolvedValue({ id: 'job-3', durationSec: 7, guildId: 'g3' });

      await createPlaybackJob({
        guildId: 'g3',
        text: '{"type":"media","startOffsetSec":3}',
        mediaAsset: { id: 'asset-3', durationSec: 10, kind: 'VIDEO' },
      });

      expect(global.prisma.playbackJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ durationSec: 7 }),
        }),
      );
    });
  });

  describe('purgeOldPlaybackJobs', () => {
    it('deletes done and failed jobs older than retention cutoff', async () => {
      global.prisma.playbackJob.deleteMany.mockResolvedValue({ count: 3 });

      await purgeOldPlaybackJobs();

      expect(global.prisma.playbackJob.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [PlaybackJobStatus.DONE, PlaybackJobStatus.FAILED] },
            finishedAt: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
      expect(global.logger.info).toHaveBeenCalledWith(expect.stringContaining('Purged 3'));
    });

    it('does not log when no jobs were purged', async () => {
      global.prisma.playbackJob.deleteMany.mockResolvedValue({ count: 0 });

      await purgeOldPlaybackJobs();

      expect(global.logger.info).not.toHaveBeenCalled();
    });
  });

  describe('startPlaybackJobPurgeWorker', () => {
    it('registers a recurring interval without throwing', () => {
      vi.useFakeTimers();

      expect(() => startPlaybackJobPurgeWorker()).not.toThrow();

      vi.useRealTimers();
    });
  });
});
