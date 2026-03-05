import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedEnv = vi.hoisted(() => {
  return {
    MEDIA_CACHE_TTL_HOURS: 24,
    MEDIA_BOARD_MAX_TOTAL_MB: 500,
  };
});

vi.mock('../../../src/services/env', () => {
  return {
    env: mockedEnv,
  };
});

import { MediaAssetStatus } from '../../../src/services/prisma/prismaEnums';
import { MediaIngestionError } from '../../../src/services/media/mediaErrors';

import {
  addToMemeBoard,
  ensurePinnedExpiry,
  listMemeBoardItems,
  releasePinnedExpiryIfUnused,
  removeMemeBoardItem,
  updateMemeBoardItem,
} from '../../../src/services/memeBoard';

describe('services/memeBoard', () => {
  beforeEach(() => {
    Object.assign(mockedEnv, {
      MEDIA_CACHE_TTL_HOURS: 24,
      MEDIA_BOARD_MAX_TOTAL_MB: 500,
    });

    global.env = mockedEnv as any;

    global.prisma = {
      mediaAsset: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      memeBoardItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
      },
    } as any;
  });

  describe('ensurePinnedExpiry', () => {
    it('updates asset expiry to a far future date', async () => {
      global.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      await ensurePinnedExpiry('asset-1');

      expect(global.prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'asset-1', status: MediaAssetStatus.READY }),
          data: expect.objectContaining({ lastAccessedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('releasePinnedExpiryIfUnused', () => {
    it('returns false when the asset still has board references', async () => {
      global.prisma.memeBoardItem.count.mockResolvedValue(2);

      const result = await releasePinnedExpiryIfUnused('asset-2');

      expect(result).toBe(false);
      expect(global.prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
    });

    it('resets expiry and returns true when no board references remain', async () => {
      global.prisma.memeBoardItem.count.mockResolvedValue(0);
      global.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await releasePinnedExpiryIfUnused('asset-3');

      expect(result).toBe(true);
      expect(global.prisma.mediaAsset.updateMany).toHaveBeenCalled();
    });
  });

  describe('addToMemeBoard', () => {
    it('returns existing item without creating a duplicate', async () => {
      const existingItem = { id: 'item-1', mediaAssetId: 'asset-1', mediaAsset: {} };
      global.prisma.memeBoardItem.findUnique.mockResolvedValue(existingItem);
      global.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await addToMemeBoard({ guildId: 'g1', mediaAssetId: 'asset-1' });

      expect(result.created).toBe(false);
      expect(result.item).toBe(existingItem);
      expect(global.prisma.memeBoardItem.create).not.toHaveBeenCalled();
    });

    it('creates a new item when capacity is available', async () => {
      global.prisma.memeBoardItem.findUnique.mockResolvedValue(null);
      global.prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'asset-2',
        sizeBytes: 1024,
        status: MediaAssetStatus.READY,
      });
      global.prisma.memeBoardItem.findMany.mockResolvedValue([]);
      global.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
      const newItem = { id: 'item-2', mediaAssetId: 'asset-2', mediaAsset: {} };
      global.prisma.memeBoardItem.create.mockResolvedValue(newItem);

      const result = await addToMemeBoard({ guildId: 'g1', mediaAssetId: 'asset-2', title: 'My Meme' });

      expect(result.created).toBe(true);
      expect(result.item).toBe(newItem);
    });

    it('throws MediaIngestionError when board storage limit is reached', async () => {
      global.prisma.memeBoardItem.findUnique.mockResolvedValue(null);
      global.prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'asset-3',
        sizeBytes: 600 * 1024 * 1024,
        status: MediaAssetStatus.READY,
      });
      global.prisma.memeBoardItem.findMany.mockResolvedValue([
        { mediaAsset: { sizeBytes: 400 * 1024 * 1024 } },
      ]);

      await expect(
        addToMemeBoard({ guildId: 'g1', mediaAssetId: 'asset-3' }),
      ).rejects.toBeInstanceOf(MediaIngestionError);
    });
  });

  describe('listMemeBoardItems', () => {
    it('returns paginated items with total count', async () => {
      global.prisma.memeBoardItem.count.mockResolvedValue(3);
      global.prisma.memeBoardItem.findMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]);

      const result = await listMemeBoardItems({ guildId: 'g1', limit: 2, offset: 0 });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('applies default limit and offset for null/invalid inputs', async () => {
      global.prisma.memeBoardItem.count.mockResolvedValue(0);
      global.prisma.memeBoardItem.findMany.mockResolvedValue([]);

      const result = await listMemeBoardItems({ guildId: 'g2', limit: null, offset: null });

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe('removeMemeBoardItem', () => {
    it('returns deleted=false when item does not exist', async () => {
      global.prisma.memeBoardItem.findFirst.mockResolvedValue(null);

      const result = await removeMemeBoardItem({ guildId: 'g1', itemId: 'missing' });

      expect(result.deleted).toBe(false);
      expect(global.prisma.memeBoardItem.delete).not.toHaveBeenCalled();
    });

    it('deletes item and releases pinned expiry when no references remain', async () => {
      global.prisma.memeBoardItem.findFirst.mockResolvedValue({ id: 'item-1', mediaAssetId: 'asset-1' });
      global.prisma.memeBoardItem.delete.mockResolvedValue(undefined);
      global.prisma.memeBoardItem.count.mockResolvedValue(0);
      global.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await removeMemeBoardItem({ guildId: 'g1', itemId: 'item-1' });

      expect(result.deleted).toBe(true);
      expect(result.releasedPinnedExpiry).toBe(true);
    });
  });

  describe('updateMemeBoardItem', () => {
    it('returns null when item does not exist', async () => {
      global.prisma.memeBoardItem.findFirst.mockResolvedValue(null);

      const result = await updateMemeBoardItem({ guildId: 'g1', itemId: 'missing', title: 'New' });

      expect(result).toBeNull();
    });

    it('updates title and message when item exists', async () => {
      global.prisma.memeBoardItem.findFirst.mockResolvedValue({ id: 'item-1' });
      const updated = { id: 'item-1', title: 'New Title', mediaAsset: {} };
      global.prisma.memeBoardItem.update.mockResolvedValue(updated);

      const result = await updateMemeBoardItem({ guildId: 'g1', itemId: 'item-1', title: 'New Title' });

      expect(result).toBe(updated);
      expect(global.prisma.memeBoardItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'New Title' }) }),
      );
    });
  });
});
