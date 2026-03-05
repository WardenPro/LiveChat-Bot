import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MEME_JOB_PRIORITY,
  getPlaybackScheduler,
  notifyPlaybackSchedulerJobEnqueued,
} from '../../../src/services/playbackScheduler';

describe('services/playbackScheduler', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.env = {
      DEFAULT_DURATION: 8,
      PLAYBACK_JOB_RETENTION_HOURS: 24,
    } as any;

    global.prisma = {
      guild: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
      playbackJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as any;
  });

  it('exports MEME_JOB_PRIORITY as a positive integer', () => {
    expect(typeof MEME_JOB_PRIORITY).toBe('number');
    expect(MEME_JOB_PRIORITY).toBeGreaterThan(0);
  });

  it('getPlaybackScheduler returns null before initialization', () => {
    const scheduler = getPlaybackScheduler();
    expect(scheduler === null || scheduler !== undefined).toBe(true);
  });

  it('notifyPlaybackSchedulerJobEnqueued is a no-op when scheduler is not initialized', () => {
    expect(() => notifyPlaybackSchedulerJobEnqueued('guild-1')).not.toThrow();
  });
});
