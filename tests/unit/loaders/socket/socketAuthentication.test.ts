import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OverlaySocket, OverlaySocketClientRecord } from '../../../../src/loaders/socket/types';
import { registerOverlaySocketAuthentication } from '../../../../src/loaders/socket/socketAuthentication';

const authMocks = vi.hoisted(() => {
  return {
    resolveOverlayAuthFromToken: vi.fn(),
  };
});

vi.mock('../../../../src/services/overlayAuth', () => {
  return {
    resolveOverlayAuthFromToken: authMocks.resolveOverlayAuthFromToken,
  };
});

type RegisteredMiddleware = (socket: OverlaySocket, next: (error?: Error) => void) => Promise<void> | void;

const createFastifyHarness = () => {
  let middleware: RegisteredMiddleware | null = null;

  const use = vi.fn((candidate: RegisteredMiddleware) => {
    middleware = candidate;
  });

  const fastify = {
    io: {
      use,
    },
  } as unknown as FastifyCustomInstance;

  return {
    fastify,
    use,
    getMiddleware: () => middleware,
  };
};

const createSocket = (overrides: Partial<OverlaySocket> = {}): OverlaySocket => {
  return {
    id: 'socket-1',
    data: {},
    handshake: {
      auth: {},
      query: {},
    },
    ...overrides,
  } as OverlaySocket;
};

const createClientRecord = (overrides: Partial<OverlaySocketClientRecord> = {}): OverlaySocketClientRecord => {
  return {
    id: 'overlay-client-1',
    guildId: 'guild-1',
    label: 'Primary Overlay',
    sessionMode: 'NORMAL',
    defaultAuthorName: 'Overlay Host',
    defaultAuthorImage: 'https://cdn.example/default-host.png',
    ...overrides,
  };
};

describe('loaders/socket/socketAuthentication', () => {
  beforeEach(() => {
    global.logger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
    global.prisma = {
      overlayClient: {
        update: vi.fn().mockResolvedValue(null),
      },
    } as any;

    authMocks.resolveOverlayAuthFromToken.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.prisma = {} as any;
  });

  it('authenticates from handshake auth token and applies socket context', async () => {
    authMocks.resolveOverlayAuthFromToken.mockResolvedValue({
      kind: 'authenticated',
      token: 'auth-token',
      tokenSource: 'socket_handshake',
      client: createClientRecord({
        sessionMode: 'INVITE_READ_ONLY',
        defaultAuthorName: '  Producer  ',
        defaultAuthorImage: ' https://cdn.example/producer.png ',
      }),
    });

    const harness = createFastifyHarness();
    registerOverlaySocketAuthentication(harness.fastify);

    const middleware = harness.getMiddleware();
    if (!middleware) {
      throw new Error('Expected socket auth middleware to be registered');
    }

    const socket = createSocket({
      handshake: {
        auth: {
          token: '  auth-token  ',
          sessionMode: ' invite_read_only ',
        },
      } as OverlaySocket['handshake'],
    });
    const next = vi.fn();

    await middleware(socket, next);

    expect(authMocks.resolveOverlayAuthFromToken).toHaveBeenCalledWith('auth-token', 'socket_handshake');
    expect(socket.data).toMatchObject({
      guildId: 'guild-1',
      overlayClientId: 'overlay-client-1',
      overlayClientLabel: 'Primary Overlay',
      overlaySessionMode: 'invite_read_only',
      overlayAuthorName: 'Producer',
      overlayAuthorImage: 'https://cdn.example/producer.png',
    });
    expect(global.prisma.overlayClient.update).toHaveBeenCalledWith({
      where: {
        id: 'overlay-client-1',
      },
      data: {
        lastSeenAt: expect.any(Date),
      },
    });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to query token and client session mode when auth payload is missing', async () => {
    authMocks.resolveOverlayAuthFromToken.mockResolvedValue({
      kind: 'authenticated',
      token: 'query-token',
      tokenSource: 'socket_handshake',
      client: createClientRecord({
        sessionMode: 'INVITE_READ_ONLY',
        defaultAuthorName: '   ',
        defaultAuthorImage: null,
      }),
    });

    const harness = createFastifyHarness();
    registerOverlaySocketAuthentication(harness.fastify);

    const middleware = harness.getMiddleware();
    if (!middleware) {
      throw new Error('Expected socket auth middleware to be registered');
    }

    const socket = createSocket({
      handshake: {
        auth: {},
        query: {
          token: 'query-token',
        },
      } as OverlaySocket['handshake'],
    });
    const next = vi.fn();

    await middleware(socket, next);

    expect(authMocks.resolveOverlayAuthFromToken).toHaveBeenCalledWith('query-token', 'socket_handshake');
    expect(socket.data).toMatchObject({
      overlaySessionMode: 'invite_read_only',
    });
    expect(socket.data.overlayAuthorName).toBeUndefined();
    expect(socket.data.overlayAuthorImage).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unauthenticated sockets and skips prisma updates', async () => {
    authMocks.resolveOverlayAuthFromToken.mockResolvedValue({
      kind: 'missing_token',
    });

    const harness = createFastifyHarness();
    registerOverlaySocketAuthentication(harness.fastify);

    const middleware = harness.getMiddleware();
    if (!middleware) {
      throw new Error('Expected socket auth middleware to be registered');
    }

    const socket = createSocket();
    const next = vi.fn();

    await middleware(socket, next);

    const forwardedError = next.mock.calls[0]?.[0];
    expect(forwardedError).toBeInstanceOf(Error);
    expect((forwardedError as Error).message).toBe('missing_token');
    expect(global.prisma.overlayClient.update).not.toHaveBeenCalled();
    expect(socket.data.overlayClientId).toBeUndefined();
    expect(global.logger.warn).toHaveBeenCalledWith(
      {
        socketId: 'socket-1',
        category: 'authentication',
      },
      '[OVERLAY] Socket auth failed: missing token',
    );
  });

  it('maps unexpected auth errors to auth_error and logs with safe context', async () => {
    authMocks.resolveOverlayAuthFromToken.mockRejectedValue(new Error('database unavailable'));

    const harness = createFastifyHarness();
    registerOverlaySocketAuthentication(harness.fastify);

    const middleware = harness.getMiddleware();
    if (!middleware) {
      throw new Error('Expected socket auth middleware to be registered');
    }

    const socket = createSocket({
      handshake: {
        auth: {
          token: 'token-1',
        },
      } as OverlaySocket['handshake'],
    });
    const next = vi.fn();

    await middleware(socket, next);

    const forwardedError = next.mock.calls[0]?.[0];
    expect(forwardedError).toBeInstanceOf(Error);
    expect((forwardedError as Error).message).toBe('auth_error');
    expect(global.logger.error).toHaveBeenCalledOnce();
    expect(global.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        socketId: 'socket-1',
        category: 'unexpected',
        socketCode: 'auth_error',
      }),
      '[OVERLAY] Socket auth error',
    );
  });
});
