import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serverMocks = vi.hoisted(() => {
  const gracefulFactory = vi.fn();
  const gracefulServer = {
    on: vi.fn(),
    setReady: vi.fn(),
  };

  return {
    fastifyFactory: vi.fn(),
    fastifyCorsPlugin: {
      name: 'fastify-cors-plugin',
    },
    gracefulFactory,
    gracefulServer,
    socketIoServer: vi.fn(),
    socketIoClose: vi.fn(),
    loadRestRoutes: vi.fn(),
    loadSocket: vi.fn(),
    loadDiscord: vi.fn(),
    loadRosetty: vi.fn(),
    loadPrismaClient: vi.fn(),
    ensureMediaStorageDir: vi.fn(),
    startMediaCachePurgeWorker: vi.fn(),
    startPlaybackJobPurgeWorker: vi.fn(),
    startPairingCodePurgeWorker: vi.fn(),
    initializePlaybackScheduler: vi.fn(),
    createHttpErrorHandler: vi.fn(),
  };
});

const GracefulServerMock = Object.assign(serverMocks.gracefulFactory, {
  SHUTTING_DOWN: 'SHUTTING_DOWN',
});

vi.mock('fastify', () => {
  return {
    default: serverMocks.fastifyFactory,
  };
});

vi.mock('@fastify/cors', () => {
  return {
    default: serverMocks.fastifyCorsPlugin,
  };
});

vi.mock('@gquittet/graceful-server', () => {
  return {
    default: GracefulServerMock,
  };
});

vi.mock('socket.io', () => {
  return {
    Server: serverMocks.socketIoServer,
  };
});

vi.mock('../../src/loaders/RESTLoader', () => {
  return {
    loadRestRoutes: serverMocks.loadRestRoutes,
  };
});

vi.mock('../../src/loaders/socketLoader', () => {
  return {
    loadSocket: serverMocks.loadSocket,
  };
});

vi.mock('../../src/loaders/DiscordLoader', () => {
  return {
    loadDiscord: serverMocks.loadDiscord,
  };
});

vi.mock('../../src/services/i18n/loader', () => {
  return {
    loadRosetty: serverMocks.loadRosetty,
  };
});

vi.mock('../../src/services/prisma/loadPrisma', () => {
  return {
    loadPrismaClient: serverMocks.loadPrismaClient,
  };
});

vi.mock('../../src/services/media/mediaCache', () => {
  return {
    ensureMediaStorageDir: serverMocks.ensureMediaStorageDir,
    startMediaCachePurgeWorker: serverMocks.startMediaCachePurgeWorker,
  };
});

vi.mock('../../src/services/playbackJobs', () => {
  return {
    startPlaybackJobPurgeWorker: serverMocks.startPlaybackJobPurgeWorker,
  };
});

vi.mock('../../src/services/pairingCodes', () => {
  return {
    startPairingCodePurgeWorker: serverMocks.startPairingCodePurgeWorker,
  };
});

vi.mock('../../src/services/playbackScheduler', () => {
  return {
    initializePlaybackScheduler: serverMocks.initializePlaybackScheduler,
  };
});

vi.mock('../../src/services/errors/runtimeErrorHandling', () => {
  return {
    createHttpErrorHandler: serverMocks.createHttpErrorHandler,
  };
});

const loadServerModule = async () => {
  vi.resetModules();
  return await import('../../src/server');
};

const createFastifyHarness = () => {
  const onCloseHooks: Array<() => Promise<void>> = [];

  const fastify = {
    server: {
      address: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
      level: 'info',
      silent: false,
    },
    decorate: vi.fn(),
    addHook: vi.fn((hookName: string, hook: () => Promise<void>) => {
      if (hookName === 'onClose') {
        onCloseHooks.push(hook);
      }
    }),
    register: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    setErrorHandler: vi.fn(),
  } as any;

  return {
    fastify,
    onCloseHooks,
  };
};

describe('server runServer', () => {
  let fastifyHarness: ReturnType<typeof createFastifyHarness>;
  let errorHandler: ReturnType<typeof vi.fn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fastifyHarness = createFastifyHarness();
    errorHandler = vi.fn();

    global.env = {
      LOG: 'debug',
      API_URL: 'https://api.example.com',
    } as any;
    global.prisma = {
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as any;

    serverMocks.fastifyFactory.mockReset();
    serverMocks.gracefulFactory.mockReset();
    serverMocks.gracefulServer.on.mockReset();
    serverMocks.gracefulServer.setReady.mockReset();
    serverMocks.socketIoServer.mockReset();
    serverMocks.socketIoClose.mockReset();
    serverMocks.loadRestRoutes.mockReset();
    serverMocks.loadSocket.mockReset();
    serverMocks.loadDiscord.mockReset();
    serverMocks.loadRosetty.mockReset();
    serverMocks.loadPrismaClient.mockReset();
    serverMocks.ensureMediaStorageDir.mockReset();
    serverMocks.startMediaCachePurgeWorker.mockReset();
    serverMocks.startPlaybackJobPurgeWorker.mockReset();
    serverMocks.startPairingCodePurgeWorker.mockReset();
    serverMocks.initializePlaybackScheduler.mockReset();
    serverMocks.createHttpErrorHandler.mockReset();

    serverMocks.fastifyFactory.mockReturnValue(fastifyHarness.fastify);
    serverMocks.gracefulFactory.mockReturnValue(serverMocks.gracefulServer);
    serverMocks.socketIoServer.mockImplementation(function () {
      return {
        close: serverMocks.socketIoClose.mockResolvedValue(undefined),
      };
    });
    serverMocks.loadPrismaClient.mockResolvedValue(undefined);
    serverMocks.ensureMediaStorageDir.mockResolvedValue(undefined);
    serverMocks.initializePlaybackScheduler.mockResolvedValue(undefined);
    serverMocks.loadSocket.mockResolvedValue(undefined);
    serverMocks.loadRestRoutes.mockResolvedValue(undefined);
    serverMocks.loadDiscord.mockResolvedValue(undefined);
    serverMocks.createHttpErrorHandler.mockReturnValue(errorHandler);

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit-${code ?? 'unknown'}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boots Fastify with workers, routes, and graceful shutdown hooks', async () => {
    const { runServer } = await loadServerModule();
    const fastify = await runServer();

    expect(fastify).toBe(fastifyHarness.fastify);
    expect(serverMocks.fastifyFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: expect.objectContaining({
          level: 'debug',
        }),
        disableRequestLogging: true,
      }),
    );
    expect(serverMocks.loadPrismaClient).toHaveBeenCalledTimes(1);
    expect(serverMocks.ensureMediaStorageDir).toHaveBeenCalledTimes(1);
    expect(serverMocks.startMediaCachePurgeWorker).toHaveBeenCalledTimes(1);
    expect(serverMocks.startPlaybackJobPurgeWorker).toHaveBeenCalledTimes(1);
    expect(serverMocks.startPairingCodePurgeWorker).toHaveBeenCalledTimes(1);
    expect(serverMocks.initializePlaybackScheduler).toHaveBeenCalledWith(fastifyHarness.fastify);
    expect(serverMocks.loadSocket).toHaveBeenCalledWith(fastifyHarness.fastify);
    expect(serverMocks.loadRestRoutes).toHaveBeenCalledWith(fastifyHarness.fastify);
    expect(serverMocks.loadDiscord).toHaveBeenCalledWith(fastifyHarness.fastify);
    expect(serverMocks.loadRosetty).toHaveBeenCalledTimes(1);
    expect(fastifyHarness.fastify.register).toHaveBeenCalledWith(serverMocks.fastifyCorsPlugin, expect.any(Object));
    expect(fastifyHarness.fastify.setErrorHandler).toHaveBeenCalledWith(errorHandler);
    expect(serverMocks.gracefulServer.setReady).toHaveBeenCalledTimes(1);
    expect(global.logger).toBe(fastifyHarness.fastify.log);
    expect(processExitSpy).not.toHaveBeenCalled();

    expect(fastifyHarness.onCloseHooks).toHaveLength(1);
    await fastifyHarness.onCloseHooks[0]();
    expect(global.prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(serverMocks.socketIoClose).toHaveBeenCalledTimes(1);
  });

  it('exits when initial datastore bootstrap fails', async () => {
    serverMocks.loadPrismaClient.mockRejectedValueOnce(new Error('db unavailable'));
    const { runServer } = await loadServerModule();

    await expect(runServer()).rejects.toThrow('exit-1');
    expect(fastifyHarness.fastify.log.fatal).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
      }),
      '[DB] Impossible to connect to database',
    );
  });

  it('logs socket initialization failures and continues server bootstrap', async () => {
    processExitSpy.mockImplementation(((code?: number) => code as never) as any);
    serverMocks.socketIoServer.mockImplementationOnce(() => {
      throw new Error('socket init failed');
    });

    const { runServer } = await loadServerModule();
    const fastify = await runServer();

    expect(fastify).toBe(fastifyHarness.fastify);
    expect(fastifyHarness.fastify.log.fatal).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
      }),
      'Impossible to initialize socket server',
    );
    expect(serverMocks.loadRestRoutes).toHaveBeenCalledTimes(1);
    expect(serverMocks.gracefulServer.setReady).toHaveBeenCalledTimes(1);
  });
});
