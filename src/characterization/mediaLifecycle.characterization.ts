import assert from 'assert';
import { mkdtemp, rm, stat, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { MediaAssetStatus, PlaybackJobStatus } from '../services/prisma/prismaEnums';
import {
  enforceNonPersistentCacheBudget,
  purgeExpiredMediaAssets,
  touchMediaAsset,
} from '../services/media/mediaCache';
import { ensureCharacterizationGlobals } from './utils';

interface MediaAssetState {
  id: string;
  sourceHash: string;
  sourceUrl: string;
  kind: string;
  mime: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  isVertical: boolean;
  storagePath: string;
  sizeBytes: number;
  status: string;
  error: string | null;
  lastAccessedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  memeBoardItemsCount: number;
  playbackStatuses: string[];
}

const createMediaPrisma = (assets: MediaAssetState[]) => {
  const deleteAssetById = (assetId: string) => {
    const index = assets.findIndex((asset) => asset.id === assetId);
    if (index >= 0) {
      assets.splice(index, 1);
    }
  };

  return {
    mediaAsset: {
      findUnique: async (args: { where: { id?: string; sourceHash?: string } }) => {
        if (args.where.id) {
          return assets.find((asset) => asset.id === args.where.id) || null;
        }

        if (args.where.sourceHash) {
          return assets.find((asset) => asset.sourceHash === args.where.sourceHash) || null;
        }

        return null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const asset = assets.find((candidate) => candidate.id === args.where.id);
        assert(asset, `asset ${args.where.id} should exist for update`);

        if (args.data.lastAccessedAt instanceof Date) {
          asset.lastAccessedAt = args.data.lastAccessedAt;
        }

        if (args.data.expiresAt instanceof Date) {
          asset.expiresAt = args.data.expiresAt;
        }

        return asset;
      },
      aggregate: async () => {
        const sum = assets
          .filter((asset) => asset.status === MediaAssetStatus.READY && asset.memeBoardItemsCount === 0)
          .reduce((total, asset) => total + asset.sizeBytes, 0);

        return {
          _sum: {
            sizeBytes: sum,
          },
        };
      },
      findMany: async (args: { where: Record<string, unknown> }) => {
        if (Array.isArray(args.where.OR)) {
          const now = ((args.where.OR[0] as { expiresAt?: { lte: Date } }).expiresAt || { lte: new Date() }).lte;

          return assets
            .filter((asset) => {
              const isExpired = asset.expiresAt <= now;
              const isStaleProcessing =
                (asset.status === MediaAssetStatus.FAILED || asset.status === MediaAssetStatus.PROCESSING) &&
                asset.lastAccessedAt <= new Date(now.getTime() - 2 * 60 * 60 * 1000);

              return isExpired || isStaleProcessing;
            })
            .map((asset) => ({
              id: asset.id,
              storagePath: asset.storagePath,
            }));
        }

        const excludeAssetId =
          (args.where.id as { not?: string } | undefined) && typeof (args.where.id as { not?: string }).not === 'string'
            ? (args.where.id as { not: string }).not
            : null;

        return assets
          .filter((asset) => {
            if (asset.status !== MediaAssetStatus.READY) {
              return false;
            }

            if (asset.memeBoardItemsCount > 0) {
              return false;
            }

            if (excludeAssetId && asset.id === excludeAssetId) {
              return false;
            }

            const hasActivePlayback = asset.playbackStatuses.some((status) => {
              return status === PlaybackJobStatus.PENDING || status === PlaybackJobStatus.PLAYING;
            });

            if (hasActivePlayback) {
              return false;
            }

            return true;
          })
          .sort((left, right) => {
            const byLastAccess = left.lastAccessedAt.getTime() - right.lastAccessedAt.getTime();
            if (byLastAccess !== 0) {
              return byLastAccess;
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          })
          .map((asset) => ({
            id: asset.id,
            storagePath: asset.storagePath,
            sizeBytes: asset.sizeBytes,
          }));
      },
      delete: async (args: { where: { id: string } }) => {
        deleteAssetById(args.where.id);

        return {
          id: args.where.id,
        };
      },
    },
  };
};

const createFileWithSize = async (filePath: string, sizeBytes: number) => {
  const payload = Buffer.alloc(Math.max(sizeBytes, 1), 7);
  await writeFile(filePath, payload);
};

const createMediaAsset = (
  params: Partial<MediaAssetState> & Pick<MediaAssetState, 'id' | 'sourceHash' | 'storagePath'>,
): MediaAssetState => {
  const now = new Date();

  return {
    id: params.id,
    sourceHash: params.sourceHash,
    sourceUrl: params.sourceUrl || 'https://example.com/media',
    kind: params.kind || 'video',
    mime: params.mime || 'video/mp4',
    durationSec: params.durationSec ?? 15,
    width: params.width ?? 1280,
    height: params.height ?? 720,
    isVertical: params.isVertical ?? false,
    storagePath: params.storagePath,
    sizeBytes: params.sizeBytes ?? 1024,
    status: params.status || MediaAssetStatus.READY,
    error: params.error || null,
    lastAccessedAt: params.lastAccessedAt || new Date(now.getTime() - 60 * 60 * 1000),
    expiresAt: params.expiresAt || new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: params.createdAt || new Date(now.getTime() - 2 * 60 * 60 * 1000),
    memeBoardItemsCount: params.memeBoardItemsCount ?? 0,
    playbackStatuses: params.playbackStatuses || [],
  };
};

export const runMediaLifecycleCharacterization = async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'livechat-media-characterization-'));

  ensureCharacterizationGlobals({
    MEDIA_STORAGE_DIR: tmpDir,
    MEDIA_CACHE_TTL_HOURS: 12,
    MEDIA_CACHE_MAX_TOTAL_MB: 1,
  });

  const touchAssetPath = path.join(tmpDir, 'touch-asset.mp4');
  const evictAssetPath = path.join(tmpDir, 'evict-asset.mp4');
  const keepAssetPath = path.join(tmpDir, 'keep-asset.mp4');
  const expiredAssetPath = path.join(tmpDir, 'expired-asset.mp4');
  const staleProcessingPath = path.join(tmpDir, 'stale-processing.mp4');
  const freshAssetPath = path.join(tmpDir, 'fresh-asset.mp4');

  await Promise.all([
    createFileWithSize(touchAssetPath, 2048),
    createFileWithSize(evictAssetPath, 4096),
    createFileWithSize(keepAssetPath, 4096),
    createFileWithSize(expiredAssetPath, 4096),
    createFileWithSize(staleProcessingPath, 4096),
    createFileWithSize(freshAssetPath, 4096),
  ]);

  const now = new Date();
  const veryLongExpiry = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const mediaAssets: MediaAssetState[] = [
    createMediaAsset({
      id: 'touch-asset',
      sourceHash: 'source-touch',
      storagePath: touchAssetPath,
      sizeBytes: 2048,
      expiresAt: veryLongExpiry,
      lastAccessedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    }),
    createMediaAsset({
      id: 'evict-asset',
      sourceHash: 'source-evict',
      storagePath: evictAssetPath,
      sizeBytes: 500_000,
      lastAccessedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 9 * 60 * 60 * 1000),
    }),
    createMediaAsset({
      id: 'keep-asset',
      sourceHash: 'source-keep',
      storagePath: keepAssetPath,
      sizeBytes: 300_000,
      lastAccessedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 7 * 60 * 60 * 1000),
    }),
    createMediaAsset({
      id: 'expired-asset',
      sourceHash: 'source-expired',
      storagePath: expiredAssetPath,
      sizeBytes: 120_000,
      expiresAt: new Date(now.getTime() - 5 * 60 * 1000),
      lastAccessedAt: new Date(now.getTime() - 60 * 60 * 1000),
    }),
    createMediaAsset({
      id: 'stale-processing-asset',
      sourceHash: 'source-stale-processing',
      storagePath: staleProcessingPath,
      sizeBytes: 130_000,
      status: MediaAssetStatus.PROCESSING,
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      lastAccessedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    }),
    createMediaAsset({
      id: 'fresh-ready-asset',
      sourceHash: 'source-fresh-ready',
      storagePath: freshAssetPath,
      sizeBytes: 90_000,
      expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      lastAccessedAt: new Date(now.getTime() - 15 * 60 * 1000),
    }),
  ];

  global.prisma = createMediaPrisma(mediaAssets) as any;

  const touched = await touchMediaAsset('touch-asset');
  assert(touched, 'touchMediaAsset should return the updated asset');

  const touchPreservedExpiry = touched.expiresAt.getTime() === veryLongExpiry.getTime();

  const budgetResult = await enforceNonPersistentCacheBudget({
    requiredBytes: 500_000,
  });

  const evictedExistsAfterBudget = mediaAssets.some((asset) => asset.id === 'evict-asset');
  const evictedFileStillExists = await stat(evictAssetPath)
    .then(() => true)
    .catch(() => false);

  await purgeExpiredMediaAssets();

  const expiredExistsAfterPurge = mediaAssets.some((asset) => asset.id === 'expired-asset');
  const staleProcessingExistsAfterPurge = mediaAssets.some((asset) => asset.id === 'stale-processing-asset');
  const freshExistsAfterPurge = mediaAssets.some((asset) => asset.id === 'fresh-ready-asset');

  await rm(tmpDir, { recursive: true, force: true });

  return {
    touchMediaAsset: {
      touchedAssetExists: !!touched,
      touchPreservedExpiry,
      touchLastAccessedUpdated: touched.lastAccessedAt instanceof Date,
    },
    enforceCacheBudget: {
      hasCapacity: budgetResult.hasCapacity,
      evictedAssetsCount: budgetResult.evictedAssetsCount,
      evictedBytes: budgetResult.evictedBytes,
      evictedAssetStillInState: evictedExistsAfterBudget,
      evictedAssetFileStillOnDisk: evictedFileStillExists,
    },
    purgeExpiredMediaAssets: {
      expiredAssetStillPresent: expiredExistsAfterPurge,
      staleProcessingStillPresent: staleProcessingExistsAfterPurge,
      freshAssetStillPresent: freshExistsAfterPurge,
      remainingAssetIds: mediaAssets.map((asset) => asset.id).sort(),
    },
  };
};
