import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaRepositoryMocks = vi.hoisted(() => {
  return {
    PrismaClient: vi.fn(),
    connect: vi.fn(),
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: prismaRepositoryMocks.PrismaClient,
  };
});

describe('repositories/prisma/loadPrisma', () => {
  beforeEach(() => {
    prismaRepositoryMocks.PrismaClient.mockReset();
    prismaRepositoryMocks.connect.mockReset();
    prismaRepositoryMocks.connect.mockResolvedValue(undefined);
    prismaRepositoryMocks.PrismaClient.mockImplementation(function () {
      return {
        $connect: prismaRepositoryMocks.connect,
      };
    });

    global.prisma = {} as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Prisma client, stores it globally, and connects', async () => {
    const { loadPrismaClient } = await import('../../../../src/repositories/prisma/loadPrisma');
    await loadPrismaClient();

    expect(prismaRepositoryMocks.PrismaClient).toHaveBeenCalledTimes(1);
    expect(prismaRepositoryMocks.connect).toHaveBeenCalledTimes(1);
    expect(global.prisma).toEqual(
      expect.objectContaining({
        $connect: prismaRepositoryMocks.connect,
      }),
    );
  });

  it('propagates connection errors from Prisma', async () => {
    const dbError = new Error('prisma connect failed');
    prismaRepositoryMocks.connect.mockRejectedValueOnce(dbError);

    const { loadPrismaClient } = await import('../../../../src/repositories/prisma/loadPrisma');

    await expect(loadPrismaClient()).rejects.toThrow(dbError);
    expect(global.prisma).toEqual(
      expect.objectContaining({
        $connect: prismaRepositoryMocks.connect,
      }),
    );
  });
});
