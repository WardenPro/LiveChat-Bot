import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOverlaySocketEventDispatcher } from '../../../../src/loaders/socket/socketEventDispatch';
import type { OverlayConnectionState, OverlayPlaybackScheduler, OverlaySocket } from '../../../../src/loaders/socket/types';
import { MediaAssetStatus } from '../../../../src/services/prisma/prismaEnums';
import { MEME_JOB_PRIORITY } from '../../../../src/services/playbackScheduler';
import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';

const dispatchMocks = vi.hoisted(() => {
  return {
    createPlaybackJob: vi.fn(),
    executeManualStopForGuild: vi.fn(),
  };
});

vi.mock('../../../../src/services/playbackJobs', () => {
  return {
    createPlaybackJob: dispatchMocks.createPlaybackJob,
  };
});

vi.mock('../../../../src/services/manualStop', () => {
  return {
    executeManualStopForGuild: dispatchMocks.executeManualStopForGuild,
  };
});

type RegisteredHandler = (...args: any[]) => unknown;

const createSocketHarness = (overrides: Partial<OverlaySocket> = {}) => {
  const handlers = new Map<string, RegisteredHandler>();

  const socket = {
    id: 'socket-1',
    data: {
      guildId: 'guild-1',
      overlayClientId: 'client-1',
      overlayClientLabel: 'Control Tablet',
      overlaySessionMode: 'normal',
      overlayAuthorName: 'Overlay Host',
      overlayAuthorImage: 'https://cdn.example/host.png',
    },
    on: vi.fn((eventName: string, handler: RegisteredHandler) => {
      handlers.set(eventName, handler);
    }),
    ...overrides,
  } as OverlaySocket;

  return {
    socket,
    handlers,
  };
};

const createPlaybackScheduler = (overrides: Partial<OverlayPlaybackScheduler> = {}): OverlayPlaybackScheduler => {
  return {
    onJobEnqueued: vi.fn().mockResolvedValue(undefined),
    onPlaybackState: vi.fn().mockResolvedValue(undefined),
    onPlaybackStopped: vi.fn().mockResolvedValue(undefined),
    preemptWithJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const createConnectionState = (overrides: Partial<OverlayConnectionState> = {}): OverlayConnectionState => {
  return {
    onConnected: vi.fn(),
    onDisconnecting: vi.fn(),
    onDisconnected: vi.fn().mockResolvedValue(undefined),
    broadcastPeers: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const requireHandler = (handlers: Map<string, RegisteredHandler>, eventName: string): RegisteredHandler => {
  const handler = handlers.get(eventName);

  if (!handler) {
    throw new Error(`Expected handler to be registered for ${eventName}`);
  }

  return handler;
};

describe('loaders/socket/socketEventDispatch', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;
    global.prisma = {
      overlayClient: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      memeBoardItem: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    dispatchMocks.createPlaybackJob.mockReset();
    dispatchMocks.executeManualStopForGuild.mockReset();
    dispatchMocks.executeManualStopForGuild.mockResolvedValue({ releasedCount: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.prisma = {} as any;
  });

  it('registers overlay and disconnect lifecycle handlers', () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness();

    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    expect([...handlers.keys()].sort()).toEqual(
      [
        OVERLAY_SOCKET_EVENTS.HEARTBEAT,
        OVERLAY_SOCKET_EVENTS.ERROR,
        OVERLAY_SOCKET_EVENTS.PLAYBACK_STATE,
        OVERLAY_SOCKET_EVENTS.STOP,
        OVERLAY_SOCKET_EVENTS.MEME_TRIGGER,
        'disconnecting',
        'disconnect',
      ].sort(),
    );
  });

  it('updates overlay heartbeat state and keeps invalid session modes normalized', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness({
      data: {
        guildId: 'guild-1',
        overlayClientId: 'client-1',
        overlayClientLabel: 'Control Tablet',
        overlaySessionMode: 'normal',
      },
    });
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    const heartbeatHandler = requireHandler(handlers, OVERLAY_SOCKET_EVENTS.HEARTBEAT);
    await heartbeatHandler({
      clientId: 'client-1',
      sessionMode: 'invite_read_only',
    });

    expect(socket.data.overlaySessionMode).toBe('invite_read_only');
    expect(global.prisma.overlayClient.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'client-1',
        guildId: 'guild-1',
        revokedAt: null,
      },
      data: {
        lastSeenAt: expect.any(Date),
      },
    });

    await heartbeatHandler({
      clientId: 'client-1',
      sessionMode: 'legacy',
    });

    expect(socket.data.overlaySessionMode).toBe('normal');
  });

  it('dispatches playback-state updates with normalized payload values', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness();
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    const playbackStateHandler = requireHandler(handlers, OVERLAY_SOCKET_EVENTS.PLAYBACK_STATE);
    await playbackStateHandler({
      jobId: '  job-42  ',
      state: 'paused',
      remainingMs: -50,
    });
    await playbackStateHandler({
      jobId: '   ',
      state: 'unsupported',
      remainingMs: Number.POSITIVE_INFINITY,
    });

    expect(playbackScheduler.onPlaybackState).toHaveBeenNthCalledWith(1, {
      guildId: 'guild-1',
      jobId: 'job-42',
      state: 'paused',
      remainingMs: 0,
    });
    expect(playbackScheduler.onPlaybackState).toHaveBeenNthCalledWith(2, {
      guildId: 'guild-1',
      jobId: null,
      state: 'playing',
      remainingMs: null,
    });
  });

  it('routes manual-stop to manual stop service and other stop events to scheduler', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness();
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    const stopHandler = requireHandler(handlers, OVERLAY_SOCKET_EVENTS.STOP);
    await stopHandler({
      jobId: 'manual-stop',
    });
    await stopHandler({});

    expect(dispatchMocks.executeManualStopForGuild).toHaveBeenCalledWith(fastify, 'guild-1', {
      logLabel: 'Stop command',
    });
    expect(playbackScheduler.onPlaybackStopped).toHaveBeenCalledWith({
      guildId: 'guild-1',
      jobId: 'unknown',
    });
  });

  it('ignores meme trigger without item id and rejects unavailable media', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness();
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    const memeHandler = requireHandler(handlers, OVERLAY_SOCKET_EVENTS.MEME_TRIGGER);
    await memeHandler({
      itemId: '   ',
      trigger: 'shortcut',
    });

    global.prisma.memeBoardItem.findFirst = vi.fn().mockResolvedValue({
      id: 'item-1',
      guildId: 'guild-1',
      mediaAsset: {
        id: 'media-1',
        status: MediaAssetStatus.FAILED,
      },
    });
    await memeHandler({
      itemId: 'item-1',
      trigger: 'shortcut',
    });

    expect(dispatchMocks.createPlaybackJob).not.toHaveBeenCalled();
    expect(playbackScheduler.preemptWithJob).not.toHaveBeenCalled();
  });

  it('accepts meme trigger, creates playback job, and preempts scheduler', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness({
      data: {
        guildId: 'guild-1',
        overlayClientId: 'client-1',
        overlayClientLabel: 'Control Tablet',
        overlayAuthorName: '   ',
        overlayAuthorImage: 'https://cdn.example/operator.png',
      },
    });
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    global.prisma.memeBoardItem.findFirst = vi.fn().mockResolvedValue({
      id: 'item-ready',
      guildId: 'guild-1',
      message: '  Meme Text  ',
      createdByName: '  Meme Creator  ',
      mediaAsset: {
        id: 'media-ready',
        status: MediaAssetStatus.READY,
        kind: 'IMAGE',
      },
    });
    dispatchMocks.createPlaybackJob.mockResolvedValue({
      id: 'job-99',
    });

    const memeHandler = requireHandler(handlers, OVERLAY_SOCKET_EVENTS.MEME_TRIGGER);
    await memeHandler({
      itemId: 'item-ready',
      trigger: 'ui',
    });

    expect(global.prisma.memeBoardItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'item-ready',
        guildId: 'guild-1',
      },
      include: {
        mediaAsset: true,
      },
    });
    expect(dispatchMocks.createPlaybackJob).toHaveBeenCalledWith({
      guildId: 'guild-1',
      mediaAsset: expect.objectContaining({
        id: 'media-ready',
      }),
      text: 'Meme Text',
      showText: true,
      authorName: 'Meme Creator',
      authorImage: 'https://cdn.example/operator.png',
      priority: MEME_JOB_PRIORITY,
      skipScheduleNotify: true,
      source: 'overlay_meme_trigger_ui',
    });
    expect(playbackScheduler.preemptWithJob).toHaveBeenCalledWith({
      guildId: 'guild-1',
      preemptingJobId: 'job-99',
    });
  });

  it('forwards disconnect lifecycle events to connection state callbacks', async () => {
    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const playbackScheduler = createPlaybackScheduler();
    const connectionState = createConnectionState();
    const { socket, handlers } = createSocketHarness();
    const dispatcher = createOverlaySocketEventDispatcher({
      fastify,
      playbackScheduler,
      connectionState,
    });
    dispatcher.registerHandlers(socket, 'guild-1');

    const disconnectingHandler = requireHandler(handlers, 'disconnecting');
    const disconnectHandler = requireHandler(handlers, 'disconnect');

    disconnectingHandler();
    await disconnectHandler({
      code: 1000,
    });

    expect(connectionState.onDisconnecting).toHaveBeenCalledWith(socket, 'guild-1');
    expect(connectionState.onDisconnected).toHaveBeenCalledWith(socket, 'guild-1', '[object Object]');
  });
});
