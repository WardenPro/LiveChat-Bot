import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerDomainRoutes } from '../../../../src/loaders/rest/registerDomainRoutes';

describe('loaders/rest/registerDomainRoutes', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
    } as any;
  });

  it('registers prefixed plugin and invokes the domain routes plugin', async () => {
    const register = vi.fn();
    const fastify = {
      register,
    } as unknown as FastifyCustomInstance;
    const domainRoutesPlugin = vi.fn().mockResolvedValue(undefined);
    const routesFactory = vi.fn().mockReturnValue(domainRoutesPlugin);

    registerDomainRoutes({
      fastify,
      prefix: '/overlay/live',
      routes: routesFactory,
    });

    expect(routesFactory).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(expect.any(Function), {
      prefix: '/overlay/live',
    });

    const registerHandler = register.mock.calls[0]?.[0];
    if (!registerHandler) {
      throw new Error('Expected register handler to be present');
    }

    const scopedInstance = {} as FastifyCustomInstance;
    await registerHandler(scopedInstance);

    expect(domainRoutesPlugin).toHaveBeenCalledWith(scopedInstance);
    expect(global.logger.info).toHaveBeenCalledWith('[REST] Overlay Live Routes loaded (/overlay/live)');
  });
});
