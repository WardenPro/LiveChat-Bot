import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaIngestionError } from '../../../../src/services/media/mediaErrors';

const mockedEnv = vi.hoisted(() => {
  return {
    API_URL: 'http://localhost:3000',
    DATABASE_URL: 'file:./sqlite.db',
    DISCORD_CLIENT_ID: 'discord-client-id',
    DISCORD_TOKEN: 'discord-token',
    MEDIA_MAX_SIZE_MB: 25,
    MEDIA_CACHE_MAX_TOTAL_MB: 512,
    MEDIA_BOARD_MAX_TOTAL_MB: 512,
  };
});

vi.mock('../../../../src/services/env', () => {
  return {
    env: mockedEnv,
  };
});

const mocks = vi.hoisted(() => {
  return {
    resolveMediaSource: vi.fn(),
    canonicalizeSourceUrl: vi.fn((source: string) => source),
    buildSourceHash: vi.fn((source: string) => `hash:${source}`),
    ingestRemoteMediaLifecycle: vi.fn(),
    ingestLocalMediaLifecycle: vi.fn(),
  };
});

vi.mock('../../../../src/services/media/mediaSourceResolver', () => {
  return {
    resolveMediaSource: mocks.resolveMediaSource,
    canonicalizeSourceUrl: mocks.canonicalizeSourceUrl,
    buildSourceHash: mocks.buildSourceHash,
  };
});

vi.mock('../../../../src/services/media/mediaLifecycleOrchestrator', () => {
  return {
    ingestRemoteMediaLifecycle: mocks.ingestRemoteMediaLifecycle,
    ingestLocalMediaLifecycle: mocks.ingestLocalMediaLifecycle,
  };
});

import { ingestMediaFromLocalFile, ingestMediaFromSource } from '../../../../src/services/media/mediaIngestion';

describe('services/media/mediaIngestion', () => {
  beforeEach(() => {
    mocks.resolveMediaSource.mockReset();
    mocks.canonicalizeSourceUrl.mockClear();
    mocks.buildSourceHash.mockClear();
    mocks.ingestRemoteMediaLifecycle.mockReset();
    mocks.ingestLocalMediaLifecycle.mockReset();
  });

  it('returns null when source resolution cannot find a usable media source', async () => {
    mocks.resolveMediaSource.mockResolvedValue(null);

    const result = await ingestMediaFromSource({
      url: '   ',
      forceRefresh: false,
    });

    expect(result).toBeNull();
    expect(mocks.ingestRemoteMediaLifecycle).not.toHaveBeenCalled();
  });

  it('delegates resolved source ingestion and returns persisted media metadata with id', async () => {
    const persisted = {
      id: 'transient-media-123',
      sourceHash: 'hash-abc',
      sourceUrl: 'https://cdn.example/video.mp4',
      kind: 'VIDEO',
      mime: 'video/mp4',
      durationSec: 12,
      width: 1280,
      height: 720,
      isVertical: false,
      storagePath: '/tmp/livechat-media/video.mp4',
      sizeBytes: 4096,
      status: 'READY',
      error: null,
      lastAccessedAt: new Date('2026-03-05T12:00:00.000Z'),
      expiresAt: new Date('2026-03-06T12:00:00.000Z'),
      createdAt: new Date('2026-03-05T12:00:00.000Z'),
    };

    mocks.resolveMediaSource.mockResolvedValue({
      sourceUrl: 'https://cdn.example/video.mp4',
      sourceHash: 'hash-abc',
    });
    mocks.ingestRemoteMediaLifecycle.mockResolvedValue(persisted);

    const result = await ingestMediaFromSource({
      media: 'https://cdn.example/video.mp4',
      forceRefresh: true,
    });

    expect(result).toEqual(persisted);
    expect(result?.id).toBe('transient-media-123');
    expect(mocks.ingestRemoteMediaLifecycle).toHaveBeenCalledWith(
      {
        sourceUrl: 'https://cdn.example/video.mp4',
        sourceHash: 'hash-abc',
        forceRefresh: true,
      },
      expect.objectContaining({
        getReadyCachedMediaAsset: expect.any(Function),
        normalizeAndPersistAsset: expect.any(Function),
      }),
    );
  });

  it('propagates typed media errors from source resolution failures', async () => {
    const sourceError = new MediaIngestionError('UNSUPPORTED_SOURCE', 'Unsupported media source');
    mocks.resolveMediaSource.mockRejectedValue(sourceError);

    await expect(ingestMediaFromSource({ url: 'https://unsupported.example/file' })).rejects.toBe(sourceError);
    expect(mocks.ingestRemoteMediaLifecycle).not.toHaveBeenCalled();
  });

  it('delegates local-file ingestion lifecycle and returns the lifecycle result', async () => {
    const persisted = {
      id: 'transient-media-local',
      kind: 'VIDEO',
    };

    mocks.ingestLocalMediaLifecycle.mockResolvedValue(persisted);

    const result = await ingestMediaFromLocalFile('/tmp/source.mp4', 'file:/tmp/source.mp4');

    expect(result).toEqual(persisted);
    expect(mocks.ingestLocalMediaLifecycle).toHaveBeenCalledWith(
      {
        filePath: '/tmp/source.mp4',
        virtualSource: 'file:/tmp/source.mp4',
      },
      expect.objectContaining({
        canonicalizeSourceUrl: expect.any(Function),
        buildSourceHash: expect.any(Function),
        copySourceFileToTemp: expect.any(Function),
      }),
    );
  });
});
