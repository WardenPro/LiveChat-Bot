import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSocket } from '../../../src/loaders/socketLoader';

const loaderMocks = vi.hoisted(() => {
  return {
    getPlaybackScheduler: vi.fn(),
    registerOverlaySocketAuthentication: vi.fn(),
    createOverlayConnectionState: vi.fn(),
    createOverlaySocketEventDispatcher: vi.fn(),
  };
});

vi.mock('../../../src/services/playbackScheduler', () => {
  return {
    getPlaybackScheduler: loaderMocks.getPlaybackScheduler,
  };
});

vi.mock('../../../src/loaders/socket/socketAuthentication', () => {
  return {
    registerOverlaySocketAuthentication: loaderMocks.registerOverlaySocketAuthentication,
  };
});

vi.mock('../../../src/loaders/socket/socketConnectionState', () => {
  return {
    createOverlayConnectionState: loaderMocks.createOverlayConnectionState,
  };
});

vi.mock('../../../src/loaders/socket/socketEventDispatch', () => {
  return {
    createOverlaySocketEventDispatcher: loaderMocks.createOverlaySocketEventDispatcher,
  };
});

type ConnectionHandler = (socket: {
  id: string;
  data: SocketData;
  disconnect: (close?: boolean) => void;
}) => void;

const createFastifyHarness = () => {
  let connectionHandler: ConnectionHandler | null = null;

  const on = vi.fn((eventName: string, handler: ConnectionHandler) => {
    if (eventName === 'connection') {
      connectionHandler = handler;
    }
  });

  const fastify = {
    io: {
      on,
    },
  } as unknown as FastifyCustomInstance;

  return {
    fastify,
    on,
    getConnectionHandler: () => connectionHandler,
  };
};

describe('loaders/socketLoader', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
    } as any;

    loaderMocks.getPlaybackScheduler.mockReset();
    loaderMocks.registerOverlaySocketAuthentication.mockReset();
    loaderMocks.createOverlayConnectionState.mockReset();
    loaderMocks.createOverlaySocketEventDispatcher.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws when playback scheduler has not been initialized', () => {
    loaderMocks.getPlaybackScheduler.mockReturnValue(null);
    const harness = createFastifyHarness();

    expect(() => loadSocket(harness.fastify)).toThrowError('playback_scheduler_not_initialized');
    expect(loaderMocks.registerOverlaySocketAuthentication).not.toHaveBeenCalled();
  });

  it('registers auth, connection state, and event dispatcher for authenticated sockets', () => {
    const playbackScheduler = {
      onJobEnqueued: vi.fn(),
      onPlaybackState: vi.fn(),
      onPlaybackStopped: vi.fn(),
      preemptWithJob: vi.fn(),
    };
    const connectionState = {
      onConnected: vi.fn(),
      onDisconnecting: vi.fn(),
      onDisconnected: vi.fn(),
      broadcastPeers: vi.fn(),
    };
    const eventDispatcher = {
      registerHandlers: vi.fn(),
    };

    loaderMocks.getPlaybackScheduler.mockReturnValue(playbackScheduler);
    loaderMocks.createOverlayConnectionState.mockReturnValue(connectionState);
    loaderMocks.createOverlaySocketEventDispatcher.mockReturnValue(eventDispatcher);

    const harness = createFastifyHarness();
    loadSocket(harness.fastify);

    expect(loaderMocks.registerOverlaySocketAuthentication).toHaveBeenCalledWith(harness.fastify);
    expect(loaderMocks.createOverlayConnectionState).toHaveBeenCalledWith({
      fastify: harness.fastify,
      playbackScheduler,
    });
    expect(loaderMocks.createOverlaySocketEventDispatcher).toHaveBeenCalledWith({
      fastify: harness.fastify,
      playbackScheduler,
      connectionState,
    });

    const handler = harness.getConnectionHandler();
    if (!handler) {
      throw new Error('Expected connection handler to be registered');
    }

    const socket = {
      id: 'socket-1',
      data: {
        guildId: 'guild-1',
      } as SocketData,
      disconnect: vi.fn(),
    };
    handler(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(connectionState.onConnected).toHaveBeenCalledWith(socket, 'guild-1');
    expect(eventDispatcher.registerHandlers).toHaveBeenCalledWith(socket, 'guild-1');
  });

  it('disconnects sockets missing guild auth context and skips privileged handlers', () => {
    const playbackScheduler = {
      onJobEnqueued: vi.fn(),
      onPlaybackState: vi.fn(),
      onPlaybackStopped: vi.fn(),
      preemptWithJob: vi.fn(),
    };
    const connectionState = {
      onConnected: vi.fn(),
      onDisconnecting: vi.fn(),
      onDisconnected: vi.fn(),
      broadcastPeers: vi.fn(),
    };
    const eventDispatcher = {
      registerHandlers: vi.fn(),
    };

    loaderMocks.getPlaybackScheduler.mockReturnValue(playbackScheduler);
    loaderMocks.createOverlayConnectionState.mockReturnValue(connectionState);
    loaderMocks.createOverlaySocketEventDispatcher.mockReturnValue(eventDispatcher);

    const harness = createFastifyHarness();
    loadSocket(harness.fastify);

    const handler = harness.getConnectionHandler();
    if (!handler) {
      throw new Error('Expected connection handler to be registered');
    }

    const socket = {
      id: 'socket-2',
      data: {} as SocketData,
      disconnect: vi.fn(),
    };
    handler(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(connectionState.onConnected).not.toHaveBeenCalled();
    expect(eventDispatcher.registerHandlers).not.toHaveBeenCalled();
  });
});
