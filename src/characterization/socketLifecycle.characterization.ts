import assert from 'assert';

import { loadSocket } from '../loaders/socketLoader';
import { hashOverlayToken } from '../services/overlayAuth';
import { initializePlaybackScheduler } from '../services/playbackScheduler';
import { ensureCharacterizationGlobals, toValueShape } from './utils';
import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';

interface OverlayClientState {
  id: string;
  guildId: string;
  label: string;
  tokenHash: string;
  sessionMode: string;
  defaultAuthorName: string | null;
  defaultAuthorImage: string | null;
  revokedAt: Date | null;
}

class FakeOverlaySocket {
  public readonly handlers = new Map<string, Array<(payload?: unknown) => Promise<void> | void>>();
  public readonly joinedRooms = new Set<string>();
  public data: Record<string, unknown> = {};
  public disconnected = false;

  constructor(
    public readonly id: string,
    public handshake: Record<string, unknown>,
    private readonly server: FakeSocketServer,
  ) {}

  join(roomName: string) {
    this.joinedRooms.add(roomName);
    this.server.addSocketToRoom(this, roomName);
  }

  on(eventName: string, handler: (payload?: unknown) => Promise<void> | void) {
    const current = this.handlers.get(eventName) || [];
    current.push(handler);
    this.handlers.set(eventName, current);
  }

  disconnect() {
    this.disconnected = true;
    this.server.removeSocketFromAllRooms(this);
  }

  async emitClientEvent(eventName: string, payload?: unknown) {
    const handlers = this.handlers.get(eventName) || [];

    for (const handler of handlers) {
      await handler(payload);
    }
  }

  async triggerDisconnect(reason: string) {
    const disconnectingHandlers = this.handlers.get('disconnecting') || [];
    for (const handler of disconnectingHandlers) {
      await handler();
    }

    this.server.removeSocketFromAllRooms(this);

    const disconnectHandlers = this.handlers.get('disconnect') || [];
    for (const handler of disconnectHandlers) {
      await handler(reason);
    }
  }
}

class FakeSocketServer {
  public readonly middlewares: Array<
    (socket: FakeOverlaySocket, next: (error?: Error) => void) => void | Promise<void>
  > = [];
  public connectionHandler: ((socket: FakeOverlaySocket) => void) | null = null;
  public readonly emittedEvents: Array<{ room: string; eventName: string; payload: unknown }> = [];
  public readonly roomSockets = new Map<string, FakeOverlaySocket[]>();

  public readonly sockets = {
    adapter: {
      rooms: new Map<string, Set<string>>(),
    },
  };

  use(middleware: (socket: FakeOverlaySocket, next: (error?: Error) => void) => void | Promise<void>) {
    this.middlewares.push(middleware);
  }

  on(eventName: string, handler: (socket: FakeOverlaySocket) => void) {
    if (eventName === 'connection') {
      this.connectionHandler = handler;
    }
  }

  in(roomName: string) {
    return {
      fetchSockets: async () => {
        return [...(this.roomSockets.get(roomName) || [])];
      },
    };
  }

  to(roomName: string) {
    return {
      emit: (eventName: string, payload: unknown) => {
        this.emittedEvents.push({
          room: roomName,
          eventName,
          payload,
        });
      },
    };
  }

  addSocketToRoom(socket: FakeOverlaySocket, roomName: string) {
    const socketsInRoom = this.roomSockets.get(roomName) || [];
    if (!socketsInRoom.includes(socket)) {
      socketsInRoom.push(socket);
      this.roomSockets.set(roomName, socketsInRoom);
    }

    const roomMembers = this.sockets.adapter.rooms.get(roomName) || new Set<string>();
    roomMembers.add(socket.id);
    this.sockets.adapter.rooms.set(roomName, roomMembers);
  }

  removeSocketFromAllRooms(socket: FakeOverlaySocket) {
    for (const roomName of socket.joinedRooms) {
      const socketsInRoom = this.roomSockets.get(roomName) || [];
      const filtered = socketsInRoom.filter((candidate) => candidate.id !== socket.id);

      if (filtered.length > 0) {
        this.roomSockets.set(roomName, filtered);
      } else {
        this.roomSockets.delete(roomName);
      }

      const roomMembers = this.sockets.adapter.rooms.get(roomName);
      if (roomMembers) {
        roomMembers.delete(socket.id);

        if (roomMembers.size === 0) {
          this.sockets.adapter.rooms.delete(roomName);
        } else {
          this.sockets.adapter.rooms.set(roomName, roomMembers);
        }
      }
    }

    socket.joinedRooms.clear();
  }
}

const runAuthMiddleware = async (
  middleware: (socket: FakeOverlaySocket, next: (error?: Error) => void) => void | Promise<void>,
  socket: FakeOverlaySocket,
) => {
  return new Promise<Error | null>((resolve) => {
    const next = (error?: Error) => {
      resolve(error || null);
    };

    Promise.resolve(middleware(socket, next)).catch((error) => {
      resolve(error as Error);
    });
  });
};

export const runSocketLifecycleCharacterization = async () => {
  ensureCharacterizationGlobals();

  const overlayToken = 'valid-overlay-token';
  const overlayClientState: OverlayClientState = {
    id: 'overlay-client-socket-1',
    guildId: 'guild-socket-1',
    label: 'OBS Laptop',
    tokenHash: hashOverlayToken(overlayToken),
    sessionMode: 'NORMAL',
    defaultAuthorName: 'Overlay Author',
    defaultAuthorImage: 'https://cdn.example/author.png',
    revokedAt: null,
  };

  const overlayClientUpdateCalls: Array<Record<string, unknown>> = [];
  const overlayClientHeartbeatUpdates: Array<Record<string, unknown>> = [];
  const guildUpserts: Array<Record<string, unknown>> = [];

  global.prisma = {
    playbackJob: {
      findMany: async () => [],
    },
    overlayClient: {
      findFirst: async (args: { where: { tokenHash: string; revokedAt: null } }) => {
        if (args.where.tokenHash !== overlayClientState.tokenHash || overlayClientState.revokedAt !== null) {
          return null;
        }

        return {
          ...overlayClientState,
        };
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        overlayClientUpdateCalls.push({
          where: args.where,
          data: args.data,
        });

        return {
          ...overlayClientState,
          lastSeenAt: args.data.lastSeenAt,
        };
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        overlayClientHeartbeatUpdates.push({
          where: args.where,
          data: args.data,
        });

        return {
          count: 1,
        };
      },
    },
    guild: {
      upsert: async (args: Record<string, unknown>) => {
        guildUpserts.push(args);

        return {
          id: overlayClientState.guildId,
          busyUntil: null,
        };
      },
    },
    memeBoardItem: {
      findFirst: async () => null,
    },
  } as any;

  const fakeIo = new FakeSocketServer();
  const fakeFastify = {
    io: fakeIo,
  } as unknown as FastifyCustomInstance;

  const scheduler = await initializePlaybackScheduler(fakeFastify);

  const schedulerCalls = {
    onJobEnqueued: [] as string[],
    onPlaybackState: [] as Array<Record<string, unknown>>,
    onPlaybackStopped: [] as Array<Record<string, unknown>>,
    preemptWithJob: [] as Array<Record<string, unknown>>,
  };

  scheduler.onJobEnqueued = async (guildId: string) => {
    schedulerCalls.onJobEnqueued.push(guildId);
  };

  scheduler.onPlaybackState = async (payload: {
    guildId: string;
    jobId?: string | null;
    state: string;
    remainingMs: number | null;
  }) => {
    schedulerCalls.onPlaybackState.push(payload);
  };

  scheduler.onPlaybackStopped = async (payload: { guildId: string; jobId?: string | null }) => {
    schedulerCalls.onPlaybackStopped.push(payload);
  };

  scheduler.preemptWithJob = async (payload: { guildId: string; preemptingJobId: string }) => {
    schedulerCalls.preemptWithJob.push(payload);
  };

  await loadSocket(fakeFastify);

  const middleware = fakeIo.middlewares[0];
  assert(middleware, 'socket authentication middleware should be registered');

  const missingTokenSocket = new FakeOverlaySocket('socket-missing-token', { auth: {} }, fakeIo);
  const missingTokenError = await runAuthMiddleware(middleware, missingTokenSocket);

  const validSocket = new FakeOverlaySocket(
    'socket-valid-token',
    {
      auth: {
        token: overlayToken,
        sessionMode: 'invite_read_only',
      },
      query: {},
    },
    fakeIo,
  );

  const validTokenError = await runAuthMiddleware(middleware, validSocket);
  const validTokenErrorMessage = validTokenError ? validTokenError.message : null;
  assert.strictEqual(validTokenError, null, 'valid token should pass middleware');

  assert(fakeIo.connectionHandler, 'connection handler should be registered');
  fakeIo.connectionHandler(validSocket);

  await new Promise<void>((resolve) => {
    setImmediate(() => resolve());
  });

  await validSocket.emitClientEvent(OVERLAY_SOCKET_EVENTS.HEARTBEAT, {
    clientId: overlayClientState.id,
    guildId: overlayClientState.guildId,
    appVersion: '1.0.0',
    sessionMode: 'normal',
  });

  await validSocket.triggerDisconnect('transport close');

  const peersEvents = fakeIo.emittedEvents.filter((event) => event.eventName === OVERLAY_SOCKET_EVENTS.PEERS);

  return {
    missingTokenAuth: {
      errorMessage: missingTokenError?.message || null,
    },
    validTokenAuth: {
      errorMessage: validTokenErrorMessage,
      socketDataShape: toValueShape(validSocket.data),
      overlayClientUpdateCount: overlayClientUpdateCalls.length,
    },
    peersLifecycle: {
      peersEventCount: peersEvents.length,
      firstPeersPayloadShape: peersEvents.length > 0 ? toValueShape(peersEvents[0].payload) : null,
      schedulerOnConnectCalls: schedulerCalls.onJobEnqueued.length,
    },
    heartbeatLifecycle: {
      overlayHeartbeatUpdateCount: overlayClientHeartbeatUpdates.length,
      lastSessionMode: validSocket.data.overlaySessionMode || null,
    },
    disconnectLifecycle: {
      guildBusyUntilClearedCount: guildUpserts.length,
      guildUpsertShape: guildUpserts.length > 0 ? toValueShape(guildUpserts[0]) : null,
    },
  };
};
