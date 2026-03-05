import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { purgeStalePairingCodes, startPairingCodePurgeWorker } from '../../../src/services/pairingCodes';

describe('services/pairingCodes', () => {
  beforeEach(() => {
    global.prisma = {} as any;
    global.logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    global.prisma = {} as any;
    vi.clearAllMocks();
  });

  it('purges used or expired pairing codes and returns deleted count', async () => {
    const deleteManySpy = vi.fn().mockResolvedValue({ count: 3 });
    global.prisma = {
      pairingCode: {
        deleteMany: deleteManySpy,
      },
    } as any;

    const deletedCount = await purgeStalePairingCodes();

    expect(deletedCount).toBe(3);
    expect(deleteManySpy).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            usedAt: {
              not: null,
            },
          },
          {
            expiresAt: {
              lte: expect.any(Date),
            },
          },
        ],
      },
    });
  });

  it('logs deleted count when purge worker removes stale codes', async () => {
    global.prisma = {
      pairingCode: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    } as any;

    startPairingCodePurgeWorker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(global.logger.info).toHaveBeenCalledWith('[PAIRING] Purged 2 expired/used pairing codes');
    expect(global.logger.error).not.toHaveBeenCalled();
  });

  it('logs failures without throwing when purge worker errors', async () => {
    const purgeFailure = new Error('delete failed');
    global.prisma = {
      pairingCode: {
        deleteMany: vi.fn().mockRejectedValue(purgeFailure),
      },
    } as any;

    startPairingCodePurgeWorker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(global.logger.error).toHaveBeenCalledWith(purgeFailure, '[PAIRING] Pairing code purge failed');
  });
});
