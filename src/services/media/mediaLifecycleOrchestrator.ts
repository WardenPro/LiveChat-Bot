import { MediaAssetKind } from '../prisma/prismaEnums';
import { MediaIngestionError, type MediaIngestionErrorCode } from './mediaErrors';

export interface MediaLifecycleAsset {
  id: string;
  kind: MediaAssetKind;
}

export interface RemoteIngestionParams {
  sourceUrl: string;
  sourceHash: string;
  forceRefresh: boolean;
}

export interface RemoteIngestionDependencies<TAsset extends MediaLifecycleAsset> {
  getReadyCachedMediaAsset: (sourceHash: string) => Promise<TAsset | null>;
  touchMediaAsset: (assetId: string) => Promise<TAsset | null>;
  upsertProcessingAsset: (sourceHash: string, sourceUrl: string) => Promise<unknown>;
  createTempDir: () => Promise<string>;
  cleanupTempDir: (tmpDir: string) => Promise<void>;
  downloadSourceToTempFile: (sourceUrl: string, tmpDir: string) => Promise<string>;
  normalizeAndPersistAsset: (params: {
    sourceHash: string;
    sourceUrl: string;
    inputFilePath: string;
  }) => Promise<TAsset>;
  markAssetFailed: (sourceHash: string, error: MediaIngestionError) => Promise<unknown>;
  toMediaIngestionError: (error: unknown, fallbackCode?: MediaIngestionErrorCode) => MediaIngestionError;
  isYouTubeUrl: (sourceUrl: string) => boolean;
  onCacheHit?: (params: { sourceHash: string; sourceUrl: string }) => void;
  onCacheBypass?: (params: { sourceHash: string; sourceUrl: string }) => void;
  onIngested?: (params: {
    sourceHash: string;
    startedAtMs: number;
    downloadedAtMs: number;
    finishedAtMs: number;
  }) => void;
}

export const ingestRemoteMediaLifecycle = async <TAsset extends MediaLifecycleAsset>(
  params: RemoteIngestionParams,
  deps: RemoteIngestionDependencies<TAsset>,
): Promise<TAsset> => {
  const cached = params.forceRefresh ? null : await deps.getReadyCachedMediaAsset(params.sourceHash);

  if (cached) {
    deps.onCacheHit?.({
      sourceHash: params.sourceHash,
      sourceUrl: params.sourceUrl,
    });
    const touchedAsset = await deps.touchMediaAsset(cached.id);
    return touchedAsset || cached;
  }

  if (params.forceRefresh) {
    deps.onCacheBypass?.({
      sourceHash: params.sourceHash,
      sourceUrl: params.sourceUrl,
    });
  }

  await deps.upsertProcessingAsset(params.sourceHash, params.sourceUrl);

  const tmpDir = await deps.createTempDir();
  const startedAtMs = Date.now();

  try {
    const downloadedFilePath = await deps.downloadSourceToTempFile(params.sourceUrl, tmpDir);
    const downloadedAtMs = Date.now();

    const normalizedAsset = await deps.normalizeAndPersistAsset({
      sourceHash: params.sourceHash,
      sourceUrl: params.sourceUrl,
      inputFilePath: downloadedFilePath,
    });

    if (deps.isYouTubeUrl(params.sourceUrl) && normalizedAsset.kind === MediaAssetKind.AUDIO) {
      throw new MediaIngestionError(
        'INVALID_MEDIA',
        'YouTube source resolved to audio-only media',
        `YouTube source produced audio-only media for ${params.sourceUrl}`,
      );
    }

    const finishedAtMs = Date.now();

    deps.onIngested?.({
      sourceHash: params.sourceHash,
      startedAtMs,
      downloadedAtMs,
      finishedAtMs,
    });

    return normalizedAsset;
  } catch (error) {
    const mediaError = deps.toMediaIngestionError(error);
    await deps.markAssetFailed(params.sourceHash, mediaError);
    throw mediaError;
  } finally {
    await deps.cleanupTempDir(tmpDir);
  }
};

export interface LocalIngestionParams {
  filePath: string;
  virtualSource: string;
}

export interface LocalIngestionDependencies<TAsset extends MediaLifecycleAsset> {
  canonicalizeSourceUrl: (sourceUrl: string) => string;
  buildSourceHash: (source: string) => string;
  getReadyCachedMediaAsset: (sourceHash: string) => Promise<TAsset | null>;
  touchMediaAsset: (assetId: string) => Promise<TAsset | null>;
  upsertProcessingAsset: (sourceHash: string, sourceUrl: string) => Promise<unknown>;
  createTempDir: () => Promise<string>;
  cleanupTempDir: (tmpDir: string) => Promise<void>;
  copySourceFileToTemp: (filePath: string, tmpDir: string) => Promise<string>;
  normalizeAndPersistAsset: (params: {
    sourceHash: string;
    sourceUrl: string;
    inputFilePath: string;
  }) => Promise<TAsset>;
  markAssetFailed: (sourceHash: string, error: MediaIngestionError) => Promise<unknown>;
  toMediaIngestionError: (error: unknown, fallbackCode?: MediaIngestionErrorCode) => MediaIngestionError;
}

export const ingestLocalMediaLifecycle = async <TAsset extends MediaLifecycleAsset>(
  params: LocalIngestionParams,
  deps: LocalIngestionDependencies<TAsset>,
): Promise<TAsset> => {
  const canonicalSource = deps.canonicalizeSourceUrl(params.virtualSource);
  const sourceHash = deps.buildSourceHash(canonicalSource);

  const cached = await deps.getReadyCachedMediaAsset(sourceHash);

  if (cached) {
    const touchedAsset = await deps.touchMediaAsset(cached.id);
    return touchedAsset || cached;
  }

  await deps.upsertProcessingAsset(sourceHash, canonicalSource);

  const tmpDir = await deps.createTempDir();

  try {
    const copiedPath = await deps.copySourceFileToTemp(params.filePath, tmpDir);

    return await deps.normalizeAndPersistAsset({
      sourceHash,
      sourceUrl: canonicalSource,
      inputFilePath: copiedPath,
    });
  } catch (error) {
    const mediaError = deps.toMediaIngestionError(error, 'TRANSCODE_FAILED');
    await deps.markAssetFailed(sourceHash, mediaError);
    throw mediaError;
  } finally {
    await deps.cleanupTempDir(tmpDir);
  }
};
