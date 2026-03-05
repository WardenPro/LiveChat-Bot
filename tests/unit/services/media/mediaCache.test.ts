import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaAssetStatus, PlaybackJobStatus } from '../../../../src/services/prisma/prismaEnums';
import { createMediaEnvFixture } from './mediaTestFixture';

const mocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
  };
});

vi.mock('fs', () => {
  return {
    default: {
      existsSync: mocks.existsSync,
    },
    existsSync: mocks.existsSync,
  };
});

vi.mock('fs/promises', () => {
  return {
    mkdir: mocks.mkdir,
    rm: mocks.rm,
  };
});

import {
  buildMediaOutputBasePath,
  enforceNonPersistentCacheBudget,
  ensureMediaStorageDir,
  getMediaStorageDir,
  getReadyCachedMediaAsset,
  purgeExpiredMediaAssets,
  startMediaCachePurgeWorker,
  touchMediaAsset,
} from '../../../../src/services/media/mediaCache';

describe('services/media/mediaCache', () => {
  beforeEach(() => {
    global.env = createMediaEnvFixture({
      MEDIA_STORAGE_DIR: '/tmp/livechat-cache-tests',
      MEDIA_CACHE_MAX_TOTAL_MB: 1,
      MEDIA_CACHE_TTL_HOURS: 2,
    }) as any;

    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.prisma = {
      mediaAsset: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    } as any;

    mocks.existsSync.mockReset();
    mocks.mkdir.mockReset();
    mocks.rm.mockReset();

    mocks.existsSync.mockReturnValue(true);
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves storage paths and ensures media storage directory exists', async () => {
    await ensureMediaStorageDir();

    expect(getMediaStorageDir()).toBe('/tmp/livechat-cache-tests');
    expect(buildMediaOutputBasePath('abc123')).toBe('/tmp/livechat-cache-tests/abc123');
    expect(mocks.mkdir).toHaveBeenCalledWith('/tmp/livechat-cache-tests', {
      recursive: true,
    });
  });

  it('returns ready cached asset only when status, expiry, and file presence are valid', async () => {
    const readyAsset = {
      id: 'asset-ready',
      status: MediaAssetStatus.READY,
      expiresAt: new Date(Date.now() + 60_000),
      storagePath: '/tmp/cache/asset.mp4',
    };

    global.prisma.mediaAsset.findUnique.mockResolvedValueOnce(readyAsset).mockResolvedValueOnce({
      ...readyAsset,
      status: MediaAssetStatus.PROCESSING,
    });

    const found = await getReadyCachedMediaAsset('hash-ready');
    const missing = await getReadyCachedMediaAsset('hash-processing');

    expect(found).toEqual(readyAsset);
    expect(missing).toBeNull();

    mocks.existsSync.mockReturnValue(false);
    global.prisma.mediaAsset.findUnique.mockResolvedValue({
      ...readyAsset,
      expiresAt: new Date(Date.now() + 120_000),
    });

    await expect(getReadyCachedMediaAsset('hash-missing-file')).resolves.toBeNull();
  });

  it('touches cache assets and preserves an expiry date that is already farther in the future', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'));

    const preservedExpiry = new Date('2026-03-05T18:00:00.000Z');

    global.prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-touch',
      expiresAt: preservedExpiry,
    });
    global.prisma.mediaAsset.update.mockResolvedValue({
      id: 'asset-touch',
      expiresAt: preservedExpiry,
      lastAccessedAt: new Date('2026-03-05T10:00:00.000Z'),
    });

    const updated = await touchMediaAsset('asset-touch');

    expect(updated).toMatchObject({
      id: 'asset-touch',
    });
    expect(global.prisma.mediaAsset.update).toHaveBeenCalledWith({
      where: {
        id: 'asset-touch',
      },
      data: {
        lastAccessedAt: new Date('2026-03-05T10:00:00.000Z'),
        expiresAt: preservedExpiry,
      },
    });

    global.prisma.mediaAsset.findUnique.mockResolvedValue(null);
    await expect(touchMediaAsset('missing-asset')).resolves.toBeNull();

    vi.useRealTimers();
  });

  it('evicts non-persistent cache candidates until requested media fits within the budget', async () => {
    global.prisma.mediaAsset.aggregate.mockResolvedValue({
      _sum: {
        sizeBytes: 1_000_000,
      },
    });
    global.prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-a',
        storagePath: '/tmp/cache/a.mp4',
        sizeBytes: 100_000,
      },
      {
        id: 'asset-b',
        storagePath: '/tmp/cache/b.mp4',
        sizeBytes: 200_000,
      },
    ]);
    global.prisma.mediaAsset.delete.mockResolvedValue({ id: 'deleted' });

    const result = await enforceNonPersistentCacheBudget({
      requiredBytes: 200_000,
      excludeAssetId: 'asset-current',
    });

    expect(result.hasCapacity).toBe(true);
    expect(result.evictedAssetsCount).toBe(2);
    expect(result.evictedBytes).toBe(300_000);
    expect(global.prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            not: 'asset-current',
          },
          playbackJobs: {
            none: {
              status: {
                in: [PlaybackJobStatus.PENDING, PlaybackJobStatus.PLAYING],
              },
            },
          },
        }),
      }),
    );
    expect(global.prisma.mediaAsset.delete).toHaveBeenCalledTimes(2);
    expect(mocks.rm).toHaveBeenCalledTimes(2);
  });

  it('reports no capacity when eviction cannot free enough space', async () => {
    global.prisma.mediaAsset.aggregate.mockResolvedValue({
      _sum: {
        sizeBytes: 0,
      },
    });
    global.prisma.mediaAsset.findMany.mockResolvedValue([]);

    const result = await enforceNonPersistentCacheBudget({
      requiredBytes: 2_000_000,
    });

    expect(result.hasCapacity).toBe(false);
    expect(result.evictedAssetsCount).toBe(0);
  });

  it('purges expired assets and keeps deleting records even when file deletion fails', async () => {
    global.prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'expired-a',
        storagePath: '/tmp/cache/expired-a.mp4',
      },
      {
        id: 'expired-b',
        storagePath: '/tmp/cache/expired-b.mp4',
      },
    ]);

    mocks.rm.mockRejectedValueOnce(new Error('permission denied')).mockResolvedValueOnce(undefined);
    global.prisma.mediaAsset.delete.mockResolvedValue({ id: 'deleted' });

    await purgeExpiredMediaAssets();

    expect(global.prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
    expect(global.prisma.mediaAsset.delete).toHaveBeenCalledTimes(2);
    expect(global.logger.warn).toHaveBeenCalledWith('[MEDIA] Unable to remove file from cache: /tmp/cache/expired-a.mp4');
    expect(global.logger.info).toHaveBeenCalledWith('[MEDIA] Purged 2 expired media assets');
  });

  it('starts cache purge worker on a 60-second interval', () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(1 as unknown as NodeJS.Timeout);

    startMediaCachePurgeWorker();

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 1000);
  });
});
