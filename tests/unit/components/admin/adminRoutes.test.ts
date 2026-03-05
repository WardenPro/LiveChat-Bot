import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminRoutes } from '../../../../src/components/admin/adminRoutes';

const createApp = async () => {
  const app = Fastify();
  await app.register(createAdminRoutes(), {
    prefix: '/admin',
  });
  await app.ready();

  return app;
};

describe('components/admin/adminRoutes', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    global.env = {
      ADMIN_UI_TOKEN: 'admin-secret-token',
      ADMIN_UI_LOCAL_ONLY: false,
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects admin panel access with invalid credentials', async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'unauthorized',
      });
    } finally {
      await app.close();
    }
  });

  it('serves admin panel HTML when bearer credentials are valid', async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/',
        headers: {
          authorization: 'Bearer admin-secret-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('<title>LiveChat Admin</title>');
    } finally {
      await app.close();
    }
  });
});
