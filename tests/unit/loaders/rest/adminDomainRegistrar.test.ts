import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerAdminDomainRoutes } from '../../../../src/loaders/rest/adminDomainRegistrar';

const adminDomainRegistrarMocks = vi.hoisted(() => {
  return {
    createAdminRoutes: vi.fn(),
    registerDomainRoutes: vi.fn(),
  };
});

vi.mock('../../../../src/components/admin/adminRoutes', () => {
  return {
    createAdminRoutes: adminDomainRegistrarMocks.createAdminRoutes,
  };
});

vi.mock('../../../../src/loaders/rest/registerDomainRoutes', () => {
  return {
    registerDomainRoutes: adminDomainRegistrarMocks.registerDomainRoutes,
  };
});

describe('loaders/rest/adminDomainRegistrar', () => {
  beforeEach(() => {
    adminDomainRegistrarMocks.createAdminRoutes.mockReset();
    adminDomainRegistrarMocks.registerDomainRoutes.mockReset();
  });

  it('registers admin routes with the /admin prefix', () => {
    const fastify = {} as FastifyCustomInstance;

    registerAdminDomainRoutes(fastify);

    expect(adminDomainRegistrarMocks.registerDomainRoutes).toHaveBeenCalledWith({
      fastify,
      prefix: '/admin',
      routes: adminDomainRegistrarMocks.createAdminRoutes,
    });
  });
});
