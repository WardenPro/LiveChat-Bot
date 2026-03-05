import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadRestRoutes, loadRoutes } from '../../../src/loaders/RESTLoader';

const restLoaderMocks = vi.hoisted(() => {
  return {
    registerAdminDomainRoutes: vi.fn(),
    registerOverlayDomainRoutes: vi.fn(),
    registerIngestDomainRoutes: vi.fn(),
  };
});

vi.mock('../../../src/loaders/rest/adminDomainRegistrar', () => {
  return {
    registerAdminDomainRoutes: restLoaderMocks.registerAdminDomainRoutes,
  };
});

vi.mock('../../../src/loaders/rest/overlayDomainRegistrar', () => {
  return {
    registerOverlayDomainRoutes: restLoaderMocks.registerOverlayDomainRoutes,
  };
});

vi.mock('../../../src/loaders/rest/ingestDomainRegistrar', () => {
  return {
    registerIngestDomainRoutes: restLoaderMocks.registerIngestDomainRoutes,
  };
});

describe('loaders/RESTLoader', () => {
  beforeEach(() => {
    restLoaderMocks.registerAdminDomainRoutes.mockReset();
    restLoaderMocks.registerOverlayDomainRoutes.mockReset();
    restLoaderMocks.registerIngestDomainRoutes.mockReset();
  });

  it('registers admin, overlay, and ingest domains in order', () => {
    const fastify = {} as FastifyCustomInstance;

    loadRestRoutes(fastify);

    expect(restLoaderMocks.registerAdminDomainRoutes).toHaveBeenNthCalledWith(1, fastify);
    expect(restLoaderMocks.registerOverlayDomainRoutes).toHaveBeenNthCalledWith(1, fastify);
    expect(restLoaderMocks.registerIngestDomainRoutes).toHaveBeenNthCalledWith(1, fastify);
  });

  it('keeps the legacy loadRoutes alias mapped to loadRestRoutes', () => {
    expect(loadRoutes).toBe(loadRestRoutes);
  });
});
