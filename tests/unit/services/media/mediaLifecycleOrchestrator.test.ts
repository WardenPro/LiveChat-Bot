import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { MediaAssetKind } from '../../../../src/services/prisma/prismaEnums';
import {
  ingestLocalMediaLifecycle,
  ingestRemoteMediaLifecycle,
  type LocalIngestionDependencies,
  type LocalIngestionParams,
  type MediaLifecycleAsset,
  type RemoteIngestionDependencies,
  type RemoteIngestionParams,
} from '../../../../src/services/media/mediaLifecycleOrchestrator';
import { MediaIngestionError } from '../../../../src/services/media/mediaErrors';

type TestAsset = MediaLifecycleAsset & {
  label: string;
};

const createAsset = (overrides: Partial<TestAsset> = {}): TestAsset => {
  return {
    id: 'asset-1',
    kind: MediaAssetKind.VIDEO,
    label: 'ready',
    ...overrides,
  };
};

const createRemoteDeps = (overrides: Partial<RemoteIngestionDependencies<TestAsset>> = {}) => {
  const deps: RemoteIngestionDependencies<TestAsset> = {
    getReadyCachedMediaAsset: vi.fn().mockResolvedValue(null),
    touchMediaAsset: vi.fn().mockResolvedValue(null),
    upsertProcessingAsset: vi.fn().mockResolvedValue(undefined),
    createTempDir: vi.fn().mockResolvedValue('/tmp/livechat-remote'),
    cleanupTempDir: vi.fn().mockResolvedValue(undefined),
    downloadSourceToTempFile: vi.fn().mockResolvedValue('/tmp/livechat-remote/input.bin'),
    normalizeAndPersistAsset: vi.fn().mockResolvedValue(createAsset()),
    markAssetFailed: vi.fn().mockResolvedValue(undefined),
    toMediaIngestionError: vi.fn().mockImplementation((error: unknown) => {
      if (error instanceof MediaIngestionError) {
        return error;
      }

      return new MediaIngestionError('DOWNLOAD_FAILED', 'Download failed');
    }),
    isYouTubeUrl: vi.fn().mockReturnValue(false),
    onCacheHit: vi.fn(),
    onCacheBypass: vi.fn(),
    onIngested: vi.fn(),
  };

  return {
    ...deps,
    ...overrides,
  };
};

const createRemoteParams = (overrides: Partial<RemoteIngestionParams> = {}): RemoteIngestionParams => {
  return {
    sourceUrl: 'https://cdn.example/video.mp4',
    sourceHash: 'hash-123',
    forceRefresh: false,
    ...overrides,
  };
};

const createLocalDeps = (overrides: Partial<LocalIngestionDependencies<TestAsset>> = {}) => {
  const deps: LocalIngestionDependencies<TestAsset> = {
    canonicalizeSourceUrl: vi.fn().mockImplementation((value: string) => `canonical:${value}`),
    buildSourceHash: vi.fn().mockImplementation((value: string) => `hash:${value}`),
    getReadyCachedMediaAsset: vi.fn().mockResolvedValue(null),
    touchMediaAsset: vi.fn().mockResolvedValue(null),
    upsertProcessingAsset: vi.fn().mockResolvedValue(undefined),
    createTempDir: vi.fn().mockResolvedValue('/tmp/livechat-local'),
    cleanupTempDir: vi.fn().mockResolvedValue(undefined),
    copySourceFileToTemp: vi.fn().mockResolvedValue('/tmp/livechat-local/input.bin'),
    normalizeAndPersistAsset: vi.fn().mockResolvedValue(createAsset({ label: 'persisted' })),
    markAssetFailed: vi.fn().mockResolvedValue(undefined),
    toMediaIngestionError: vi.fn().mockImplementation((error: unknown) => {
      if (error instanceof MediaIngestionError) {
        return error;
      }

      return new MediaIngestionError('TRANSCODE_FAILED', 'Normalization failed');
    }),
  };

  return {
    ...deps,
    ...overrides,
  };
};

const createLocalParams = (overrides: Partial<LocalIngestionParams> = {}): LocalIngestionParams => {
  return {
    filePath: '/tmp/input.bin',
    virtualSource: 'file:/tmp/input.bin',
    ...overrides,
  };
};

describe('services/media/mediaLifecycleOrchestrator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns touched cache asset when a ready cached entry exists', async () => {
    const cached = createAsset({ id: 'cached-asset', label: 'cached' });
    const touched = createAsset({ id: 'cached-asset', label: 'touched' });

    const deps = createRemoteDeps({
      getReadyCachedMediaAsset: vi.fn().mockResolvedValue(cached),
      touchMediaAsset: vi.fn().mockResolvedValue(touched),
    });

    const result = await ingestRemoteMediaLifecycle(createRemoteParams(), deps);

    expect(result).toEqual(touched);
    expect(deps.onCacheHit).toHaveBeenCalledWith({
      sourceHash: 'hash-123',
      sourceUrl: 'https://cdn.example/video.mp4',
    });
    expect(deps.upsertProcessingAsset).not.toHaveBeenCalled();
    expect(deps.cleanupTempDir).not.toHaveBeenCalled();
  });

  it('downloads, normalizes, and reports timings on successful remote ingestion', async () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(175)
      .mockReturnValueOnce(260);

    const deps = createRemoteDeps();

    const result = await ingestRemoteMediaLifecycle(createRemoteParams({ forceRefresh: true }), deps);

    expect(result.label).toBe('ready');
    expect(deps.onCacheBypass).toHaveBeenCalledWith({
      sourceHash: 'hash-123',
      sourceUrl: 'https://cdn.example/video.mp4',
    });
    expect(deps.downloadSourceToTempFile).toHaveBeenCalledWith('https://cdn.example/video.mp4', '/tmp/livechat-remote');
    expect(deps.normalizeAndPersistAsset).toHaveBeenCalledWith({
      sourceHash: 'hash-123',
      sourceUrl: 'https://cdn.example/video.mp4',
      inputFilePath: '/tmp/livechat-remote/input.bin',
    });
    expect(deps.onIngested).toHaveBeenCalledWith({
      sourceHash: 'hash-123',
      startedAtMs: 100,
      downloadedAtMs: 175,
      finishedAtMs: 260,
    });
    expect(deps.cleanupTempDir).toHaveBeenCalledWith('/tmp/livechat-remote');

    nowSpy.mockRestore();
  });

  it('marks the asset as failed and cleans up temporary files when remote ingestion fails', async () => {
    const typedError = new MediaIngestionError('DOWNLOAD_FAILED', 'network unavailable');
    const deps = createRemoteDeps({
      downloadSourceToTempFile: vi.fn().mockRejectedValue(new Error('socket hang up')),
      toMediaIngestionError: vi.fn().mockReturnValue(typedError),
    });

    await expect(ingestRemoteMediaLifecycle(createRemoteParams(), deps)).rejects.toBe(typedError);

    expect(deps.markAssetFailed).toHaveBeenCalledWith('hash-123', typedError);
    expect(deps.cleanupTempDir).toHaveBeenCalledWith('/tmp/livechat-remote');
  });

  it('rejects audio-only YouTube ingestions with INVALID_MEDIA and still triggers cleanup', async () => {
    const deps = createRemoteDeps({
      normalizeAndPersistAsset: vi.fn().mockResolvedValue(
        createAsset({
          kind: MediaAssetKind.AUDIO,
        }),
      ),
      isYouTubeUrl: vi.fn().mockReturnValue(true),
      toMediaIngestionError: vi.fn().mockImplementation((error: unknown) => {
        if (error instanceof MediaIngestionError) {
          return error;
        }

        return new MediaIngestionError('DOWNLOAD_FAILED', 'fallback');
      }),
    });

    const pending = ingestRemoteMediaLifecycle(createRemoteParams({ sourceUrl: 'https://www.youtube.com/watch?v=demo' }), deps);

    await expect(pending).rejects.toMatchObject({
      code: 'INVALID_MEDIA',
    });

    expect(deps.markAssetFailed).toHaveBeenCalledWith(
      'hash-123',
      expect.objectContaining({
        code: 'INVALID_MEDIA',
      }),
    );
    expect(deps.cleanupTempDir).toHaveBeenCalledWith('/tmp/livechat-remote');
  });

  it('returns touched cache asset for local ingestion when a ready cache entry exists', async () => {
    const cached = createAsset({ id: 'local-cached', label: 'cached' });
    const touched = createAsset({ id: 'local-cached', label: 'touched' });

    const deps = createLocalDeps({
      getReadyCachedMediaAsset: vi.fn().mockResolvedValue(cached),
      touchMediaAsset: vi.fn().mockResolvedValue(touched),
    });

    const result = await ingestLocalMediaLifecycle(createLocalParams(), deps);

    expect(result).toEqual(touched);
    expect(deps.upsertProcessingAsset).not.toHaveBeenCalled();
    expect(deps.cleanupTempDir).not.toHaveBeenCalled();
  });

  it('marks local asset as failed with TRANSCODE_FAILED fallback and cleans up temp files', async () => {
    const typedError = new MediaIngestionError('TRANSCODE_FAILED', 'transcode failed');
    const deps = createLocalDeps({
      normalizeAndPersistAsset: vi.fn().mockRejectedValue(new Error('broken media')),
      toMediaIngestionError: vi.fn().mockReturnValue(typedError),
    });

    const pending = ingestLocalMediaLifecycle(createLocalParams(), deps);

    await expect(pending).rejects.toBe(typedError);

    expect(deps.toMediaIngestionError).toHaveBeenCalledWith(expect.any(Error), 'TRANSCODE_FAILED');
    expect(deps.markAssetFailed).toHaveBeenCalledWith('hash:canonical:file:/tmp/input.bin', typedError);
    expect(deps.cleanupTempDir).toHaveBeenCalledWith('/tmp/livechat-local');
  });
});
