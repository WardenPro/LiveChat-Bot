import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOverlayConnectionState } from '../../../../src/loaders/socket/socketConnectionState';
import type { OverlayPlaybackScheduler, OverlaySocket } from '../../../../src/loaders/socket/types';
import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';

const createFastifyHarness = () => {
  const roomSizes = new Map<string, Set<string>>();
  const fetchSocketsByRoom = vi.fn(async (_roomName: string) => []);
  const emit = vi.fn();

  const fastify = {
    io: {
      in: vi.fn((roomName: string) => {
        return {
          fetchSockets: () => fetchSocketsByRoom(roomName),
        };
      }),
      to: vi.fn((roomName: string) => {
        return {
          emit: (eventName: string, payload: unknown) => emit(roomName, eventName, payload),
        };
      }),
      sockets: {
        adapter: {
          rooms: roomSizes,
        },
      },
    },
  } as unknown as FastifyCustomInstance;

  return {
    fastify,
    roomSizes,
    fetchSocketsByRoom,
    emit,
  };
};

const createSocket = (overrides: Partial<OverlaySocket> = {}): OverlaySocket => {
  return {
    id: 'socket-1',
    join: vi.fn(),
    data: {
      overlayClientId: 'client-1',
      overlayClientLabel: 'Control Room',
      overlayAuthorName: 'Director',
    },
    ...overrides,
  } as OverlaySocket;
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

describe('loaders/socket/socketConnectionState', () => {
  beforeEach(() => {
    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;
    global.prisma = {
      guild: {
        upsert: vi.fn().mockResolvedValue(null),
      },
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.prisma = {} as any;
  });

  it('broadcasts deduplicated peer payloads sorted by label and client id', async () => {
    const harness = createFastifyHarness();
    const scheduler = createPlaybackScheduler();
    const state = createOverlayConnectionState({
      fastify: harness.fastify,
      playbackScheduler: scheduler,
    });

    harness.fetchSocketsByRoom.mockResolvedValue([
      {
        data: {
          overlayClientId: 'client-b',
          overlayClientLabel: 'beta-device',
        },
      },
      {
        data: {
          overlayClientId: 'client-a',
          overlayAuthorName: 'Alpha User',
          overlayClientLabel: 'ignored-device',
        },
      },
      {
        data: {
          overlayClientId: 'client-a',
          overlayClientLabel: 'duplicate-device',
        },
      },
      {
        data: {
          overlayClientId: '   ',
          overlayClientLabel: 'no-id',
        },
      },
    ]);

    await state.broadcastPeers('guild-1');

    expect(harness.emit).toHaveBeenCalledWith('overlay-guild-guild-1', OVERLAY_SOCKET_EVENTS.PEERS, {
      guildId: 'guild-1',
      peers: [
        {
          clientId: 'client-a',
          label: 'Alpha User',
        },
        {
          clientId: 'client-b',
          label: 'beta-device',
        },
      ],
    });
  });

  it('joins room, schedules playback, and broadcasts peers on connect', async () => {
    const harness = createFastifyHarness();
    harness.roomSizes.set('overlay-guild-guild-1', new Set(['socket-1', 'socket-2']));
    harness.fetchSocketsByRoom.mockResolvedValue([]);

    const scheduler = createPlaybackScheduler();
    const state = createOverlayConnectionState({
      fastify: harness.fastify,
      playbackScheduler: scheduler,
    });
    const socket = createSocket();

    state.onConnected(socket, 'guild-1');

    expect(socket.join).toHaveBeenCalledWith('overlay-guild-guild-1');
    await vi.waitFor(() => {
      expect(scheduler.onJobEnqueued).toHaveBeenCalledWith('guild-1');
    });
    await vi.waitFor(() => {
      expect(harness.emit).toHaveBeenCalledWith('overlay-guild-guild-1', OVERLAY_SOCKET_EVENTS.PEERS, {
        guildId: 'guild-1',
        peers: [],
      });
    });
  });

  it('logs scheduler failures on connect without throwing', async () => {
    const harness = createFastifyHarness();
    const scheduler = createPlaybackScheduler({
      onJobEnqueued: vi.fn().mockRejectedValue(new Error('scheduler failed')),
    });
    const state = createOverlayConnectionState({
      fastify: harness.fastify,
      playbackScheduler: scheduler,
    });

    state.onConnected(createSocket(), 'guild-1');

    await vi.waitFor(() => {
      expect(global.logger.warn).toHaveBeenCalledWith(
        {
          err: expect.any(Error),
          guildId: 'guild-1',
        },
        '[PLAYBACK] Failed to run scheduler after overlay connect',
      );
    });
  });

  it('does not clear busy lock while peers remain connected after disconnect', async () => {
    const harness = createFastifyHarness();
    harness.roomSizes.set('overlay-guild-guild-1', new Set(['socket-2']));
    harness.fetchSocketsByRoom.mockResolvedValue([]);

    const state = createOverlayConnectionState({
      fastify: harness.fastify,
      playbackScheduler: createPlaybackScheduler(),
    });

    await state.onDisconnected(createSocket(), 'guild-1', 'transport close');

    expect(global.prisma.guild.upsert).not.toHaveBeenCalled();
    expect(harness.emit).toHaveBeenCalledWith('overlay-guild-guild-1', OVERLAY_SOCKET_EVENTS.PEERS, {
      guildId: 'guild-1',
      peers: [],
    });
  });

  it('clears guild busyUntil after last disconnect and survives peer broadcast failures', async () => {
    const harness = createFastifyHarness();
    harness.roomSizes.set('overlay-guild-guild-1', new Set());
    harness.fetchSocketsByRoom.mockRejectedValue(new Error('socket adapter unavailable'));

    const state = createOverlayConnectionState({
      fastify: harness.fastify,
      playbackScheduler: createPlaybackScheduler(),
    });

    await state.onDisconnected(createSocket(), 'guild-1', 'client namespace disconnect');

    expect(global.prisma.guild.upsert).toHaveBeenCalledWith({
      where: {
        id: 'guild-1',
      },
      create: {
        id: 'guild-1',
        busyUntil: null,
      },
      update: {
        busyUntil: null,
      },
    });
    expect(global.logger.warn).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        guildId: 'guild-1',
      },
      '[OVERLAY] Failed to broadcast peers after disconnect',
    );
  });
});
