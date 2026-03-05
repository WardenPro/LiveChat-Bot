import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerIngestDomainRoutes } from '../../../../src/loaders/rest/ingestDomainRegistrar';

const ingestDomainRegistrarMocks = vi.hoisted(() => {
  return {
    createIngestRoutes: vi.fn(),
    registerDomainRoutes: vi.fn(),
  };
});

vi.mock('../../../../src/components/ingest/ingestRoutes', () => {
  return {
    createIngestRoutes: ingestDomainRegistrarMocks.createIngestRoutes,
  };
});

vi.mock('../../../../src/loaders/rest/registerDomainRoutes', () => {
  return {
    registerDomainRoutes: ingestDomainRegistrarMocks.registerDomainRoutes,
  };
});

describe('loaders/rest/ingestDomainRegistrar', () => {
  beforeEach(() => {
    ingestDomainRegistrarMocks.createIngestRoutes.mockReset();
    ingestDomainRegistrarMocks.registerDomainRoutes.mockReset();
  });

  it('registers ingest routes with the /ingest prefix', () => {
    const fastify = {} as FastifyCustomInstance;

    registerIngestDomainRoutes(fastify);

    expect(ingestDomainRegistrarMocks.registerDomainRoutes).toHaveBeenCalledWith({
      fastify,
      prefix: '/ingest',
      routes: ingestDomainRegistrarMocks.createIngestRoutes,
    });
  });
});
