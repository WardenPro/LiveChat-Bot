/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import GracefulServer from '@gquittet/graceful-server';
import { Server as SocketIoServer } from 'socket.io';
import { loadRoutes } from './loaders/RESTLoader';
import { loadSocket } from './loaders/socketLoader';
import { loadDiscord } from './loaders/DiscordLoader';
import { loadRosetty } from './services/i18n/loader';
import { loadPrismaClient } from './services/prisma/loadPrisma';
import { ensureMediaStorageDir, startMediaCachePurgeWorker } from './services/media/mediaCache';
import { startPlaybackJobPurgeWorker } from './services/playbackJobs';
import { startPairingCodePurgeWorker } from './services/pairingCodes';
import { initializePlaybackScheduler } from './services/playbackScheduler';
import { createHttpErrorHandler } from './services/errors/runtimeErrorHandling';

const corsAllowedHeaders = [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'forest-context-url',
  'Set-Cookie',
  'set-cookie',
  'Cookie',
];

const loggerRedactionPaths = [
  'token',
  'tokenHash',
  'secret',
  'password',
  'credentials',
  'authorization',
  'cookie',
  '*.token',
  '*.tokenHash',
  '*.secret',
  '*.password',
  '*.credentials',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

export const runServer = async () => {
  const logLevel = env.LOG || 'info';
  // LOAD API FRAMEWORK
  // TODO(@livechat-maintainers, LC-TS-009): Remove the custom instance cast once
  // Fastify plugin decoration types are fully modeled in runtime wiring.
  // @ts-expect-error Fastify generic inference does not include our runtime decorations.
  const fastify: FastifyCustomInstance = Fastify({
    logger: {
      level: logLevel,
      redact: {
        paths: loggerRedactionPaths,
        censor: '[REDACTED]',
      },
    },
    disableRequestLogging: true,
  });

  const logger = fastify.log;
  global.logger = logger;

  //LOAD SENDIM
  const gracefulServer = GracefulServer(fastify.server);
  gracefulServer.on(GracefulServer.SHUTTING_DOWN, (err) => {
    if (err) {
      logger.debug(err);
    }
    logger.debug('Server is shutting down');
  });

  try {
    logger.info('[DB] Connected to database');
    await loadPrismaClient();
    logger.info('[BOOT] Prisma connected');
    await ensureMediaStorageDir();
    logger.info('[BOOT] Media storage ready');
    startMediaCachePurgeWorker();
    logger.info('[BOOT] Media cache worker started');
    startPlaybackJobPurgeWorker();
    logger.info('[BOOT] Playback job purge worker started');
    startPairingCodePurgeWorker();
    logger.info('[BOOT] Pairing code purge worker started');
  } catch (e) {
    logger.fatal({ err: e }, '[DB] Impossible to connect to database');
    process.exit(1);
  }

  try {
    const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
      fastify.server,
      {
        cors: {
          allowedHeaders: corsAllowedHeaders,
          origin: true,
          credentials: true,
        },
      },
    );

    fastify.decorate('io', io);

    fastify.addHook('onClose', async () => {
      await global.prisma.$disconnect();
      await io.close();
      logger.debug('Server is shutting down');
    });
    logger.info('[BOOT] Socket.IO server initialized');
  } catch (error) {
    logger.fatal({ err: error }, 'Impossible to initialize socket server');
  }

  // SERVER CONFIGURATION
  await fastify.register(FastifyCORS, {
    methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
    allowedHeaders: corsAllowedHeaders,
    origin: true,
    credentials: true,
  });
  logger.info('[BOOT] CORS registered');

  fastify.get('/', async () => {
    return {
      service: 'livechat-bot',
      status: 'ok',
    };
  });

  fastify.get('/health', async () => {
    return {
      status: 'ok',
    };
  });

  fastify.setErrorHandler(createHttpErrorHandler(logger));

  loadRosetty();
  logger.info('[BOOT] I18N loaded');
  await initializePlaybackScheduler(fastify);
  logger.info('[BOOT] Playback scheduler initialized');
  await loadSocket(fastify);
  logger.info('[BOOT] Socket loader ready');
  await loadRoutes(fastify);
  logger.info('[BOOT] REST routes ready');
  void loadDiscord(fastify).catch((error) => {
    logger.error(error, '[DISCORD] Initialization failed');
  });
  logger.info('[BOOT] Discord bootstrap started');
  gracefulServer.setReady();
  logger.info('[BOOT] Server bootstrap completed');

  return fastify;
};
