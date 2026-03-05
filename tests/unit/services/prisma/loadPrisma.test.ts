import { describe, expect, it } from 'vitest';

import { loadPrismaClient as repositoryLoadPrismaClient } from '../../../../src/repositories/prisma/loadPrisma';
import { loadPrismaClient as serviceLoadPrismaClient } from '../../../../src/services/prisma/loadPrisma';

describe('services/prisma/loadPrisma', () => {
  it('re-exports the repository prisma client loader', () => {
    expect(serviceLoadPrismaClient).toBe(repositoryLoadPrismaClient);
  });
});
