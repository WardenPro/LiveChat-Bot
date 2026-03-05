import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerOverlayDomainRoutes } from '../../../../src/loaders/rest/overlayDomainRegistrar';

const overlayDomainRegistrarMocks = vi.hoisted(() => {
  return {
    createOverlayRoutes: vi.fn(),
    registerDomainRoutes: vi.fn(),
  };
});

vi.mock('../../../../src/components/overlay/overlayRoutes', () => {
  return {
    createOverlayRoutes: overlayDomainRegistrarMocks.createOverlayRoutes,
  };
});

vi.mock('../../../../src/loaders/rest/registerDomainRoutes', () => {
  return {
    registerDomainRoutes: overlayDomainRegistrarMocks.registerDomainRoutes,
  };
});

describe('loaders/rest/overlayDomainRegistrar', () => {
  beforeEach(() => {
    overlayDomainRegistrarMocks.createOverlayRoutes.mockReset();
    overlayDomainRegistrarMocks.registerDomainRoutes.mockReset();
  });

  it('registers overlay routes with the /overlay prefix', () => {
    const fastify = {} as FastifyCustomInstance;

    registerOverlayDomainRoutes(fastify);

    expect(overlayDomainRegistrarMocks.registerDomainRoutes).toHaveBeenCalledWith({
      fastify,
      prefix: '/overlay',
      routes: overlayDomainRegistrarMocks.createOverlayRoutes,
    });
  });
});
