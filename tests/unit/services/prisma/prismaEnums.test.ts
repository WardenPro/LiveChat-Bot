import { describe, expect, it } from 'vitest';

import * as repositoryPrismaEnums from '../../../../src/repositories/prisma/prismaEnums';
import * as servicePrismaEnums from '../../../../src/services/prisma/prismaEnums';

describe('services/prisma/prismaEnums', () => {
  it('re-exports prisma enum constants from repositories', () => {
    expect(servicePrismaEnums.MediaAssetKind).toBe(repositoryPrismaEnums.MediaAssetKind);
    expect(servicePrismaEnums.MediaAssetStatus).toBe(repositoryPrismaEnums.MediaAssetStatus);
    expect(servicePrismaEnums.PlaybackJobStatus).toBe(repositoryPrismaEnums.PlaybackJobStatus);
  });
});
